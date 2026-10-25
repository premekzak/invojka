import fc from 'fast-check'
import Papa from 'papaparse'
import { describe, expect, it, vi } from 'vitest'
import { serialize } from '../storage/repo'
import { accountingCsv } from './accounting'
import { checkData } from './check'
import {
  amountDue, discountLines, displayStatus, invoiceTotals, isoPlusDays, issuedStatus, newAdvanceTaxDoc, newCreditNote,
  newFinalInvoice, newInvoice, totalCzk, withKind,
} from './invoice'
import { formatMoney, mulRound, toMajor, toMinor } from './money'
import { formatNumber, nextNumber, sequenceOf } from './numbering'
import { shiftMonths } from './recurring'
import { Customer, Invoice, InvoicesFile, SCHEMA_VERSION, Settings } from './schema'
import { czechIban, spayd } from './spayd'
import { customerStats, debtors, homeStats, monthlyRevenue, periodStats, topCustomers, yearlyRevenue, yearStats, type StatsBasis } from './stats'
import { cashIncome } from './taxes'
import { computeTotals, lineBase, netFromGross, type VatMode } from './vat'
import { vatTurnover } from './vatThreshold'

/**
 * Property tests: instead of one example, each test states a rule that must hold for any input, and fast-check tries
 * hundreds of random ones (zero, negative and huge amounts, odd quantities, any date). When a rule breaks, it shrinks
 * the input to the smallest case that still fails and prints it.
 */

// 100 random cases per rule by default; `FC_RUNS=5000 npx vitest run src/domain/properties.test.ts` searches harder.
fc.configureGlobal({ numRuns: Number(process.env.FC_RUNS) || 100 })
vi.setConfig({ testTimeout: 120_000 })

// ---------------------------------------------------------------------------------------------------- generators

const RATES = [21, 12, 0] as const
const MODES: VatMode[] = ['payer', 'nonPayer', 'identifiedPerson']

/** Exact rounding half away from zero of n / d, in integers (the reference the float code must match). */
const divRound = (n: bigint, d: bigint) => {
  const neg = n < 0n !== d < 0n
  const a = n < 0n ? -n : n, b = d < 0n ? -d : d
  const q = (a * 2n + b) / (b * 2n)
  return Number(neg ? -q : q)
}

/** Any day from 2020 to the end of 2028. */
const isoDay = fc.integer({ min: 0, max: 3286 }).map((d) => isoPlusDays('2020-01-01', d))
/** Prices from −1 M to 1 M Kč in haléře; small ones more often, since rounding bites there. */
const price = fc.oneof(fc.integer({ min: -100_000_000, max: 100_000_000 }), fc.integer({ min: -1000, max: 1000 }))
/** Quantities with up to three decimals (1, 0.5 h, 2.25 m²…). */
const quantity = fc.oneof(fc.integer({ min: 0, max: 1000 }), fc.integer({ min: 0, max: 100_000 }).map((n) => n / 1000))
const text = fc.string({ unit: fc.constantFrom('a', 'Ž', ' ', ';', '"', ',', '\n', '\r', '*', '<', '&', 'ř'), maxLength: 12 })
const line = fc.record({ description: text, quantity, unit: fc.constant(''), unitPrice: price, vatRate: fc.constantFrom(...RATES) })
const positiveLine = line.map((l) => ({ ...l, unitPrice: Math.abs(l.unitPrice), quantity: Math.abs(l.quantity) || 1 }))

const settingsFor = (vatMode: VatMode) => Settings.parse({ schemaVersion: SCHEMA_VERSION, supplier: { name: 'Test' }, vatMode })
const customers: Customer[] = ['c1', 'c2', 'c3'].map((id, i) => Customer.parse({
  id, name: `Odběratel ${i + 1}`, address: { street: '', zip: '', city: '', country: i === 2 ? 'Německo' : '' },
}))

/** A document in any state: kind, status, currency with or without a rate, dates and payments. */
const anyInvoice = fc.record({
  kind: fc.constantFrom('invoice', 'invoice', 'invoice', 'creditNote', 'proforma', 'advanceTaxDoc'),
  status: fc.constantFrom('draft', 'issued', 'issued', 'paid', 'paid', 'cancelled'),
  vatMode: fc.constantFrom(...MODES),
  reverseCharge: fc.boolean(),
  customer: fc.integer({ min: 0, max: 2 }),
  issueDate: isoDay,
  dueIn: fc.integer({ min: 0, max: 60 }),
  paidIn: fc.integer({ min: 0, max: 120 }),
  taxableShift: fc.option(fc.integer({ min: -40, max: 40 })),
  currency: fc.constantFrom('CZK', 'CZK', 'EUR', 'USD'),
  rate: fc.option(fc.integer({ min: 1500, max: 3000 }).map((n) => n / 100)),
  lines: fc.array(line, { minLength: 1, maxLength: 4 }),
  advance: fc.option(fc.integer({ min: 0, max: 50_000_00 })),
  partial: fc.option(fc.integer({ min: 0, max: 50_000_00 })),
  uncollectible: fc.boolean(),
}).map((r): Invoice => {
  const c = customers[r.customer]!
  const paid = r.status === 'paid'
  return {
    ...newInvoice(settingsFor(r.vatMode), [], c, r.issueDate),
    kind: r.kind,
    // A tax document for a payment is paid the moment it's issued.
    status: r.kind === 'advanceTaxDoc' && r.status === 'issued' ? 'paid' : r.status,
    vatMode: r.vatMode,
    reverseCharge: r.vatMode !== 'nonPayer' && r.reverseCharge,
    dueDate: isoPlusDays(r.issueDate, r.dueIn),
    taxableSupplyDate: r.vatMode === 'payer' && r.taxableShift !== null ? isoPlusDays(r.issueDate, r.taxableShift) : undefined,
    paidDate: paid || (r.kind === 'advanceTaxDoc' && r.status === 'issued') ? isoPlusDays(r.issueDate, r.paidIn) : undefined,
    paidAmount: paid && r.partial !== null ? r.partial : undefined,
    currency: r.currency,
    exchangeRate: r.currency !== 'CZK' && r.rate !== null ? r.rate : undefined,
    lines: r.lines,
    advanceAmount: r.kind === 'invoice' && r.advance !== null ? r.advance : undefined,
    uncollectible: r.status === 'issued' && r.uncollectible ? isoPlusDays(r.issueDate, r.dueIn + 30) : undefined,
  }
})
// Each credit note corrects another document of the list.
const invoices = fc.array(anyInvoice, { maxLength: 30 })
  .map((list) => list.map((inv, i) => (inv.kind === 'creditNote' && list.length > 1 ? { ...inv, correctsId: list[(i + 1) % list.length]!.id } : inv)))
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)

// ---------------------------------------------------------------------------------------------------- money and VAT

describe('money and VAT, for any amounts', () => {
  it('a VAT rate rounds exactly like integer arithmetic does, half away from zero', () => {
    fc.assert(fc.property(price, fc.constantFrom(...RATES), (base, rate) => {
      expect(mulRound(base, rate / 100)).toBe(divRound(BigInt(base) * BigInt(rate), 100n))
    }))
  })

  it('a line price times a decimal quantity rounds exactly too', () => {
    fc.assert(fc.property(price, fc.integer({ min: 0, max: 100_000 }), (unitPrice, thousandths) => {
      expect(lineBase({ unitPrice, quantity: thousandths / 1000, vatRate: 0 })).toBe(divRound(BigInt(unitPrice) * BigInt(thousandths), 1000n))
    }))
  })

  it('rounding is symmetric, so a credit note is the exact mirror of its invoice', () => {
    fc.assert(fc.property(price, quantity, (m, f) => {
      expect(mulRound(-m, f)).toBe(-mulRound(m, f) || 0)
    }))
  })

  it('never prints "-0,00 Kč", not even for a credit note of a free line', () => {
    fc.assert(fc.property(fc.array(line, { minLength: 1, maxLength: 4 }), (lines) => {
      const s = settingsFor('payer')
      const original: Invoice = { ...newInvoice(s, [], customers[0], '2026-03-01'), lines: [...lines, { ...lines[0]!, unitPrice: 0 }], status: 'issued' }
      const credit = newCreditNote(s, [original], original, '2026-04-01')
      const shown = [...credit.lines.flatMap((l) => [l.unitPrice, lineBase(l)]), ...Object.values(invoiceTotals(credit)).filter((v) => typeof v === 'number')]
      for (const m of shown) expect(formatMoney(m as number, 'CZK')).not.toMatch(/^-0,00/)
    }))
  })

  it('crowns typed in come back as the same haléře', () => {
    fc.assert(fc.property(price, (m) => {
      expect(toMinor(toMajor(m))).toBe(m)
      expect(toMinor(toMajor(m).toFixed(2).replace('.', ','))).toBe(m)
    }))
  })

  it('totals add up: base + VAT = total, per rate and overall, and line order does not matter', () => {
    fc.assert(fc.property(fc.array(line, { minLength: 1, maxLength: 8 }), fc.constantFrom(...MODES), fc.boolean(), (lines, mode, rc) => {
      const t = computeTotals(lines, mode, rc)
      expect(t.base).toBe(sum(lines.map(lineBase)))
      expect(t.total).toBe(t.base + t.vat)
      expect(sum(t.byRate.map((r) => r.base))).toBe(t.base)
      expect(sum(t.byRate.map((r) => r.vat))).toBe(t.vat)
      for (const r of t.byRate) expect(r.total).toBe(r.base + r.vat)
      expect(new Set(t.byRate.map((r) => r.rate)).size).toBe(t.byRate.length)
      if (mode !== 'payer' || rc) expect(t.vat).toBe(0)
      expect(computeTotals([...lines].reverse(), mode, rc)).toEqual(t)
    }))
  })

  it('a gross amount splits into base and VAT that add back up, give or take a haléř', () => {
    fc.assert(fc.property(fc.integer({ min: 0, max: 100_000_000 }), fc.constantFrom(...RATES), (gross, rate) => {
      const base = netFromGross(gross, rate)
      expect(Math.abs(base + mulRound(base, rate / 100) - gross)).toBeLessThanOrEqual(1)
    }))
  })

  it('a percentage discount lowers the base by that share, and 100 % brings it to zero', () => {
    fc.assert(fc.property(fc.array(positiveLine, { minLength: 1, maxLength: 5 }), fc.integer({ min: 1, max: 100 }), (lines, percent) => {
      const inv = { ...newInvoice(settingsFor('payer'), [], customers[0], '2026-05-01'), lines }
      const before = invoiceTotals(inv)
      const after = invoiceTotals({ ...inv, lines: [...lines, ...discountLines(inv, percent, 'Sleva')] })
      // One rounding per rate.
      expect(Math.abs(after.base - before.base * (1 - percent / 100))).toBeLessThanOrEqual(before.byRate.length)
      if (percent === 100) expect(after).toMatchObject({ base: 0, vat: 0, total: 0 })
    }))
  })
})

// ---------------------------------------------------------------------------------------------------- numbering

const PATTERNS = ['{YYYY}{NNNN}', 'FV{YYYY}/{NNN}', '{YY}{MM}{NN}', 'F-{YY}-{N}', '{YYYY}.{NNNN}', 'D{YYYY}{NNNN}', '{YYYY}-{MM}-{NNN}']

describe('numbering, for any pattern and dates', () => {
  it('never gives a number that is already taken, and each period counts up from 1', () => {
    fc.assert(fc.property(fc.constantFrom(...PATTERNS), fc.array(isoDay, { minLength: 1, maxLength: 40 }), fc.array(text, { maxLength: 5 }),
      (pattern, days, junk) => {
        const taken: string[] = [...junk]
        for (const day of days.sort()) {
          const n = nextNumber(pattern, day, taken)
          expect(taken).not.toContain(n)
          taken.push(n)
        }
        const given = taken.slice(junk.length)
        expect(new Set(given).size).toBe(given.length)
      }))
  })

  it('reads back the sequence it wrote, even past the padding', () => {
    fc.assert(fc.property(fc.constantFrom(...PATTERNS), isoDay, fc.integer({ min: 1, max: 99_999 }), (pattern, day, seq) => {
      expect(sequenceOf(pattern, day, formatNumber(pattern, day, seq))).toBe(seq)
    }))
  })
})

// ---------------------------------------------------------------------------------------------------- documents

describe('credit notes, proformas and advances, for any lines', () => {
  it('a new credit note cancels its invoice to the haléř', () => {
    fc.assert(fc.property(fc.array(line, { minLength: 1, maxLength: 6 }), fc.constantFrom(...MODES), fc.boolean(), (lines, mode, rc) => {
      const s = settingsFor(mode)
      const original: Invoice = { ...newInvoice(s, [], customers[0], '2026-03-01'), lines, reverseCharge: mode !== 'nonPayer' && rc, status: 'issued' }
      const credit = { ...newCreditNote(s, [original], original, '2026-04-01'), status: 'issued' as const, correctionReason: 'x' }
      const a = invoiceTotals(original), b = invoiceTotals(credit)
      expect([b.base, b.vat, b.total]).toEqual([-a.base || 0, -a.vat || 0, -a.total || 0])
      expect(homeStats([original, credit], '2026-12-31').revenue).toBe(0)
    }))
  })

  it('a final invoice deducts what was paid on the proforma and never asks for less than nothing', () => {
    fc.assert(fc.property(fc.array(positiveLine, { minLength: 1, maxLength: 4 }), fc.constantFrom(...MODES), fc.option(fc.integer({ min: 0, max: 300_000_00 })),
      (lines, mode, paid) => {
        const s = settingsFor(mode)
        const proforma: Invoice = {
          ...withKind(newInvoice(s, [], customers[0], '2026-06-01'), 'proforma', s, []),
          lines, status: 'paid', paidDate: '2026-06-05', paidAmount: paid ?? undefined,
        }
        const final = newFinalInvoice(s, [proforma], proforma, '2026-06-20')
        const total = invoiceTotals(proforma).total
        expect(invoiceTotals(final).total).toBe(total)
        expect(amountDue(final)).toBe(total - Math.min(paid ?? total, total))
        expect(amountDue(final)).toBeGreaterThanOrEqual(0)
        const issued = { ...final, ...issuedStatus(final, [proforma], '2026-06-20') }
        expect(issued.status).toBe(amountDue(final) > 0 ? 'issued' : 'paid')
        expect(checkData({ settings: s, customers, invoices: [proforma, issued] }).filter((i) => i.level === 'error')).toEqual([])
      }))
  })

  it("a payer's tax document for an advance adds up to the money received, give or take a haléř", () => {
    fc.assert(fc.property(fc.array(positiveLine, { minLength: 1, maxLength: 4 }), fc.integer({ min: 1, max: 100 }), (lines, percent) => {
      const s = settingsFor('payer')
      const draft = withKind(newInvoice(s, [], customers[0], '2026-06-01'), 'proforma', s, [])
      const total = invoiceTotals({ ...draft, lines }).total
      fc.pre(total > 0)
      const received = Math.round((total * percent) / 100)
      const proforma: Invoice = { ...draft, lines, status: 'paid', paidDate: '2026-06-05', paidAmount: received }
      const doc = newAdvanceTaxDoc(s, [proforma], proforma, '2026-06-10')
      expect(Math.abs(invoiceTotals(doc).total - received)).toBeLessThanOrEqual(1)
      for (const l of doc.lines) expect(l.unitPrice).toBeGreaterThanOrEqual(0)
    }))
  })
})

// ---------------------------------------------------------------------------------------------------- the same number everywhere

describe('every screen shows the same number, for any mix of documents', () => {
  it("the months of a year add up to Home's revenue and to the year in the yearly chart", () => {
    fc.assert(fc.property(invoices, fc.integer({ min: 2020, max: 2028 }), (list, year) => {
      const months = monthlyRevenue(list, year)
      expect(sum(months.values)).toBe(homeStats(list, `${year}-12-31`).revenue)
      const yearly = yearlyRevenue(list, 2028)
      const i = yearly.years.indexOf(year)
      if (i >= 0) expect(yearly.values[i]).toBe(sum(months.values))
    }))
  })

  it('on the statistics page, months, quarters and the yearly chart agree on every basis', () => {
    fc.assert(fc.property(invoices, fc.integer({ min: 2020, max: 2028 }), fc.constantFrom<StatsBasis>('issue', 'taxable', 'paid'), (list, year, basis) => {
      const m = periodStats(list, year, basis, 'month')
      const q = periodStats(list, year, basis, 'quarter')
      expect(sum(q.values)).toBe(sum(m.values))
      expect(sum(q.counts)).toBe(sum(m.counts))
      expect(q.missingRate).toEqual(m.missingRate)
      const y = yearStats(list, basis, 2028)
      const i = y.years.indexOf(year)
      if (i >= 0) expect([y.values[i], y.counts[i]]).toEqual([sum(m.values), sum(m.counts)])
      // By issue date, the statistics page is the same as everywhere else.
      if (basis === 'issue') expect(sum(m.values)).toBe(sum(monthlyRevenue(list, year).values))
      // All customers together are the year's total (every generated document has a customer).
      expect(sum(topCustomers(list, year, basis).map((c) => c.revenue))).toBe(sum(m.values))
    }))
  })

  it("the VAT limit counts the same revenue as the charts, split into Czech and foreign customers", () => {
    fc.assert(fc.property(invoices, fc.integer({ min: 2020, max: 2028 }), (list, year) => {
      const t = vatTurnover(list, year)
      const m = monthlyRevenue(list, year)
      expect(t.domestic + t.foreign).toBe(sum(m.values))
      expect(t.missingRate).toEqual(m.missingRate)
    }))
  })

  it("Home's overdue figures match the list of debtors, and nothing paid, drafted or written off is overdue", () => {
    fc.assert(fc.property(invoices, isoDay, (list, on) => {
      const home = homeStats(list, on)
      const d = debtors(list, on)
      expect(sum(d.map((x) => x.count))).toBe(home.overdueCount)
      expect(sum(d.map((x) => x.overdue))).toBe(home.overdueSum)
      expect(home.overdueSum).toBeLessThanOrEqual(home.outstanding)
      for (const inv of list) {
        const st = displayStatus(inv, on)
        if (st === 'overdue') expect(inv.status === 'issued' && !inv.uncollectible && inv.kind !== 'creditNote').toBe(true)
      }
    }))
  })

  it("the customers' paid totals add up to all paid revenue", () => {
    fc.assert(fc.property(invoices, (list) => {
      const paid = list.filter((i) => i.status === 'paid' && i.kind !== 'proforma' && i.kind !== 'advanceTaxDoc')
      const stats = [...customerStats(list).values()]
      expect(sum(stats.map((s) => s.paid))).toBe(sum(paid.map((i) => totalCzk(i) ?? 0)))
    }))
  })

  it("a non-payer's tax income is the money received on the statistics page, to the crown", () => {
    fc.assert(fc.property(invoices.map((l) => l.map((i) => ({ ...i, vatMode: 'nonPayer' as const, reverseCharge: false, taxableSupplyDate: undefined }))),
      fc.integer({ min: 2020, max: 2028 }), (list, year) => {
        const received = sum(periodStats(list, year, 'paid', 'month').values)
        expect(Math.abs(cashIncome(list, year).income * 100 - received)).toBeLessThanOrEqual(50 + list.length)
      }))
  })
})

// ---------------------------------------------------------------------------------------------------- files and exports

describe('files and exports, for any text in names and descriptions', () => {
  it('invoices saved to JSON load back the same', () => {
    fc.assert(fc.property(invoices, (list) => {
      const back = InvoicesFile.parse(JSON.parse(serialize('invoices', list))).invoices
      expect(back).toEqual(list)
    }))
  })

  it("the accountant's CSV has one row per document, the same columns in every row and the right amounts", () => {
    fc.assert(fc.property(fc.array(fc.tuple(anyInvoice, text), { maxLength: 10 }), (pairs) => {
      const list = pairs.map(([inv, name], i) => ({ ...inv, number: `F${i};"${name}`, customerSnapshot: { ...inv.customerSnapshot, name } }))
      const csv = accountingCsv(list)
      expect(csv.startsWith('﻿')).toBe(true)
      const rows = Papa.parse<string[]>(csv.slice(1), { delimiter: ';' }).data.filter((r) => r.length > 1)
      expect(rows.length).toBe(list.length + 1)
      for (const r of rows) expect(r.length).toBe(rows[0]!.length)
      list.forEach((inv, i) => {
        const r = rows[i + 1]!
        expect(r[0]).toBe(inv.number)
        expect(r[7]).toBe(inv.customerSnapshot.name)
        expect(toMinor(r[15]!)).toBe(invoiceTotals(inv).total)
      })
    }))
  })

  it('QR Platba keeps its fields apart and its amount exact', () => {
    fc.assert(fc.property(fc.integer({ min: 1, max: 999_999_999 }), text, fc.string({ maxLength: 12 }), (amount, message, vs) => {
      const s = spayd({ iban: 'CZ65 0800 0000 1920 0014 5399', amount, currency: 'CZK', vs, message, dueDate: '2026-10-22' })
      const parts = s.split('*')
      expect(parts.slice(0, 2)).toEqual(['SPD', '1.0'])
      for (const p of parts.slice(2)) expect(p).toMatch(/^[A-Z-]+:/)
      expect(parts.find((p) => p.startsWith('AM:'))).toBe(`AM:${(amount / 100).toFixed(2)}`)
      const x = parts.find((p) => p.startsWith('X-VS:'))
      if (x) expect(x).toMatch(/^X-VS:\d{1,10}$/)
    }))
  })

  it('a Czech account number becomes a valid IBAN', () => {
    fc.assert(fc.property(fc.option(fc.integer({ min: 1, max: 999_999 })), fc.integer({ min: 1, max: 9_999_999_999 }), fc.integer({ min: 100, max: 9999 }),
      (prefix, number, bank) => {
        const iban = czechIban(prefix === null ? String(number) : `${prefix}-${number}`, String(bank))
        expect(iban).toMatch(/^CZ\d{22}$/)
        const digits = iban.slice(4) + '1235' + iban.slice(2, 4)
        expect(BigInt(digits) % 97n).toBe(1n)
      }))
  })
})

// ---------------------------------------------------------------------------------------------------- copied lines

const CS_NOM = ['leden', 'únor', 'březen', 'duben', 'květen', 'červen', 'červenec', 'srpen', 'září', 'říjen', 'listopad', 'prosinec']
const CS_GEN = ['ledna', 'února', 'března', 'dubna', 'května', 'června', 'července', 'srpna', 'září', 'října', 'listopadu', 'prosince']
const EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

describe('months in copied lines, for any month and shift', () => {
  const mod = (n: number) => ((n % 12) + 12) % 12
  const month = fc.integer({ min: 0, max: 11 })
  const year = fc.integer({ min: 2000, max: 2090 })
  const shift = fc.integer({ min: -30, max: 30 })

  it('moves every way of writing a month by the right amount, rolling the year over', () => {
    fc.assert(fc.property(month, year, shift, (m, y, s) => {
      const t = m + s, ny = y + Math.floor(t / 12), nm = mod(t)
      expect(shiftMonths(`Správa za ${CS_NOM[m]} ${y}`, s)).toBe(`Správa za ${CS_NOM[nm]} ${ny}`)
      expect(shiftMonths(`${EN[m]} ${y} retainer`, s)).toBe(`${EN[nm]} ${ny} retainer`)
      expect(shiftMonths(`období ${y}-${String(m + 1).padStart(2, '0')}`, s)).toBe(`období ${ny}-${String(nm + 1).padStart(2, '0')}`)
      expect(shiftMonths(`za ${m + 1}/${y}`, s)).toBe(`za ${nm + 1}/${ny}`)
    }))
  })

  it('keeps a month written in the genitive in the genitive ("do srpna" → "do září")', () => {
    // září is the same in both cases, so a genitive září can't be told from a nominative one.
    fc.assert(fc.property(month.filter((m) => m !== 8), shift, (m, s) => {
      expect(shiftMonths(`od 1. ${CS_GEN[m]}`, s)).toBe(`od 1. ${CS_GEN[mod(m + s)]}`)
    }))
  })
})

// ---------------------------------------------------------------------------------------------------- a random year of work

/**
 * A simulated user: a random sequence of the things the app lets you do (new invoice, issue, pay, cancel, credit note,
 * proforma, final invoice, tax document for an advance), on dates that move forward. Whatever the order, the data must
 * pass the health check without errors, and the number series must stay unique.
 */
describe('a random sequence of everyday actions', () => {
  type Action = { do: 'new' | 'issue' | 'pay' | 'cancel' | 'credit' | 'proforma' | 'final' | 'taxDoc' | 'delete'; pick: number; days: number; lines: Invoice['lines'] }
  const action = fc.record({
    do: fc.constantFrom('new', 'new', 'issue', 'issue', 'pay', 'cancel', 'credit', 'proforma', 'final', 'taxDoc', 'delete'),
    pick: fc.nat(),
    days: fc.integer({ min: 0, max: 20 }),
    lines: fc.array(positiveLine, { minLength: 1, maxLength: 3 }),
  }) as fc.Arbitrary<Action>

  it('never leaves the data broken', () => {
    fc.assert(fc.property(fc.constantFrom(...MODES), fc.array(action, { maxLength: 40 }), (mode, actions) => {
      const s = settingsFor(mode)
      let list: Invoice[] = []
      let on = '2026-01-05'
      const replace = (inv: Invoice) => { list = list.map((i) => (i.id === inv.id ? inv : i)) }
      const pick = <T>(xs: T[], n: number) => (xs.length ? xs[n % xs.length] : undefined)
      for (const a of actions) {
        on = isoPlusDays(on, a.days)
        const customer = customers[a.pick % customers.length]!
        const reason = { correctionReason: 'Sleva', lines: undefined }
        switch (a.do) {
          case 'new': list.push({ ...newInvoice(s, list, customer, on), lines: a.lines.map((l) => ({ ...l, description: l.description.trim() || 'Práce', vatRate: mode === 'payer' ? l.vatRate : 0 })) }); break
          case 'proforma': list.push({ ...withKind(newInvoice(s, list, customer, on), 'proforma', s, list), lines: a.lines.map((l) => ({ ...l, description: 'Záloha', vatRate: mode === 'payer' ? l.vatRate : 0 })) }); break
          case 'issue': {
            const d = pick(list.filter((i) => i.status === 'draft'), a.pick)
            if (d) replace({ ...d, ...issuedStatus(d, list, on) })
            break
          }
          case 'pay': {
            const d = pick(list.filter((i) => i.status === 'issued'), a.pick)
            if (d) replace({ ...d, status: 'paid', paidDate: on, paidAmount: amountDue(d) })
            break
          }
          case 'cancel': {
            const d = pick(list.filter((i) => i.status === 'issued'), a.pick)
            if (d) replace({ ...d, status: 'cancelled' })
            break
          }
          case 'delete': {
            const d = pick(list.filter((i) => i.status === 'draft'), a.pick)
            if (d) list = list.filter((i) => i.id !== d.id)
            break
          }
          case 'credit': {
            const d = pick(list.filter((i) => i.kind === 'invoice' && (i.status === 'issued' || i.status === 'paid')), a.pick)
            if (d) list.push({ ...newCreditNote(s, list, d, on), correctionReason: reason.correctionReason })
            break
          }
          case 'final': {
            const p = pick(list.filter((i) => i.kind === 'proforma' && i.status === 'paid' && !list.some((f) => f.advanceId === i.id && f.kind === 'invoice')), a.pick)
            if (p) list.push(newFinalInvoice(s, list, p, on))
            break
          }
          case 'taxDoc': {
            const p = pick(list.filter((i) => i.kind === 'proforma' && i.status === 'paid' && !list.some((f) => f.advanceId === i.id)), a.pick)
            if (p && mode === 'payer') list.push(newAdvanceTaxDoc(s, list, p, on))
            break
          }
        }
      }
      const issues = checkData({ settings: s, customers, invoices: list })
      expect(issues.filter((i) => i.level === 'error')).toEqual([])
      // Home never says more is overdue than is waiting at all.
      const home = homeStats(list, on)
      expect(home.overdueSum).toBeLessThanOrEqual(home.outstanding)
      // Warnings a correct app never causes (gaps from deleted drafts, credit notes and the like are allowed).
      expect(issues.filter((i) => ['invoice.paidAmount', 'invoice.advanceOverTotal', 'invoice.noTaxableDate', 'invoice.taxableDateNonPayer', 'invoice.variableSymbol'].includes(i.code))).toEqual([])
    }))
  })
})
