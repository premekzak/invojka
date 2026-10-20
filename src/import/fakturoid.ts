import Papa from 'papaparse'
import { nameKey, newId, normalizeIc } from '@/domain/id'
import { INVOICE_LANGS, type InvoiceLang } from '@/domain/language'
import { toMinor } from '@/domain/money'
import type { Customer, Invoice, InvoiceLine, Settings } from '@/domain/schema'
import { computeTotals, type VatMode } from '@/domain/vat'
import { ImportError, type ImportResult } from './csv'

// Importer for Fakturoid's invoice export (Faktury → export CSV). One file: each row is a document with the supplier's
// and the client's details, the totals and the VAT, but no lines. Customers are rebuilt from the rows. See docs/csv-import.md.

type Row = Record<string, string>

const REQUIRED = ['Number', 'Issued on', 'Client name', 'Total']

/** What the export tells about the user, to fill in onboarding: the supplier, a likely VAT mode, the number formats. */
export interface FakturoidResult extends ImportResult {
  supplier: Partial<Settings['supplier']>
  /** 'payer' when any document charges VAT, 'nonPayer' when the supplier has no DIČ; undefined when it can't tell. */
  vatMode?: VatMode
  /** Number formats guessed from the newest invoice and proforma. */
  numbering: Partial<Settings['numbering']>
}

/** Fakturoid writes most amounts with a decimal comma ("4598,0") but VAT with a point ("798.0"). */
const amount = (s: string | undefined) => toMinor((s ?? '').trim() || '0')

/** An ISO country code (Fakturoid's "CZ") → the name the app keeps in addresses. */
export function countryName(code: string): string {
  const c = code.trim().toUpperCase()
  if (!c || c === 'CZ') return 'Česká republika'
  try {
    return new Intl.DisplayNames(['cs'], { type: 'region' }).of(c) ?? c
  } catch {
    return c
  }
}

/** "1234567890/2010" or "19-123456789/0100" → account and bank code. */
function splitAccount(s: string): { account: string; bankCode: string } {
  const m = /^\s*([\d-]+)\s*\/\s*(\d{4})\s*$/.exec(s)
  return m ? { account: m[1], bankCode: m[2] } : { account: s.trim(), bankCode: '' }
}

const LANG: Record<string, InvoiceLang> = { cz: 'cs' }

/** The export has no line texts: the line names the original document instead, in the invoice's language. */
const lineText = (number: string, lang: InvoiceLang) =>
  lang === 'cs' || lang === 'sk' ? `Podle dokladu ${number} z Fakturoidu` : `As per document ${number} from Fakturoid`
const language = (s: string): InvoiceLang => LANG[s] ?? ((INVOICE_LANGS as readonly string[]).includes(s) ? (s as InvoiceLang) : 'en')

/**
 * One line that adds up to the document's totals. Fakturoid exports only the base and the VAT; a single rate is
 * read from their ratio, and a mix of 21 % and 12 % is split into two lines when that solves exactly.
 */
function linesFor(base: number, vat: number, total: number, vatMode: VatMode, description: string): InvoiceLine[] {
  const line = (unitPrice: number, vatRate: number): InvoiceLine => ({ description, quantity: 1, unit: '', unitPrice, vatRate })
  if (vatMode !== 'payer' || !vat) return [line(vatMode === 'payer' ? base : total, 0)]
  const fits = (lines: InvoiceLine[]) => computeTotals(lines, 'payer').total === base + vat
  for (const rate of [21, 12]) if (fits([line(base, rate)])) return [line(base, rate)]
  const base21 = Math.round((vat - 0.12 * base) / 0.09)
  const mixed = [line(base21, 21), line(base - base21, 12)]
  if (base21 > 0 && base21 < base && fits(mixed)) return mixed
  return [line(total, 0)]
}

/**
 * A number format from one number: a leading or embedded year becomes {YYYY} (or {YY} for a 6+ digit number starting
 * with the year's last two digits), the trailing digits become the sequence. "2025-0055" → "{YYYY}-{NNNN}".
 */
export function guessPattern(number: string, year: number): string | undefined {
  const m = /^(.*?)(\d+)$/.exec(number.trim())
  if (!m) return undefined
  let [, head, digits] = m
  const years = [year, year - 1, year + 1].map(String)
  const full = years.find((y) => head.includes(y))
  if (full) return `${head.replace(full, '{YYYY}')}{${'N'.repeat(digits.length)}}`
  // Year and sequence written together: "20250055" or "250055".
  if (!head || !/\d$/.test(head)) {
    const y4 = years.find((y) => digits.startsWith(y) && digits.length >= 7)
    if (y4) return `${head}{YYYY}{${'N'.repeat(digits.length - 4)}}`
    const y2 = years.map((y) => y.slice(2)).find((y) => digits.startsWith(y) && digits.length >= 6)
    if (y2) return `${head}{YY}{${'N'.repeat(digits.length - 2)}}`
  }
  return `${head.replace(/[{}]/g, '')}{${'N'.repeat(digits.length)}}`
}

function parse(text: string): Row[] {
  const clean = text.replace(/^﻿/, '')
  if (!clean.trim()) throw new ImportError('empty', 'invoices')
  const res = Papa.parse<Row>(clean, { header: true, skipEmptyLines: true })
  if (res.errors.length) throw new ImportError('notCsv', 'invoices', `row ${res.errors[0].row}: ${res.errors[0].message}`)
  const columns = (res.meta.fields ?? []).map((f) => f.trim())
  if (!REQUIRED.every((c) => columns.includes(c))) throw new ImportError('unknownFormat', 'invoices')
  return res.data.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k.trim(), (v ?? '').trim()])))
}

/** Whether a CSV text looks like Fakturoid's invoice export (to point the user to the right source). */
export const isFakturoidCsv = (text: string) => REQUIRED.every((c) => text.slice(0, 2000).split(/\r?\n/)[0]?.includes(c))

export function importFakturoid(csv: string, vatMode: VatMode, makeId = newId): FakturoidResult {
  const rows = parse(csv)
  const warnings: string[] = []
  // Newest first, so a customer and the supplier get the latest details.
  rows.sort((a, b) => (b['Issued on'] ?? '').localeCompare(a['Issued on'] ?? ''))

  // Fakturoid's own client id ("Subject") identifies a customer even after a rename; the name is the fallback.
  const customers: Customer[] = []
  const bySubject = new Map<string, Customer>()
  const byKey = new Map<string, Customer>()
  const merges = new Map<string, Set<string>>()
  const customerFor = (r: Row): Customer => {
    const name = r['Client name']
    const key = r['Subject'] || nameKey(name)
    const ic = normalizeIc(r['Client registration no'] ?? '')
    const address = {
      street: [r['Client street'], r['Client street2']].filter(Boolean).join(', '),
      zip: r['Client zip'] ?? '', city: r['Client city'] ?? '', country: countryName(r['Client country'] ?? ''),
    }
    const known = bySubject.get(key) ?? (r['Subject'] ? undefined : byKey.get(nameKey(name)))
    if (known) {
      if (known.name !== name) (merges.get(known.id) ?? merges.set(known.id, new Set()).get(known.id)!).add(name)
      known.ic ||= ic
      known.dic ||= r['Client vat no'] ?? ''
      known.email ||= r['Client email'] ?? ''
      known.phone ||= r['Client phone'] ?? ''
      if (!known.address.street && !known.address.city) known.address = address
      return known
    }
    const c: Customer = {
      id: makeId(), name, ic, dic: r['Client vat no'] ?? '', address,
      email: r['Client email'] ?? '', cc: [], phone: r['Client phone'] ?? '', web: '', contactName: '',
      reverseCharge: r['Transferred tax liability'] === 'true', note: '', archived: false,
    }
    customers.push(c)
    bySubject.set(key, c)
    byKey.set(nameKey(name), c)
    return c
  }

  const ids = new Map<string, string>()
  for (const r of rows) ids.set(r['Id'] || r['Number'], makeId())
  const byFakturoidId = new Map(rows.map((r) => [r['Id'], r]))

  const invoices: Invoice[] = []
  for (const r of rows) {
    const number = r['Number']
    const issueDate = r['Issued on']
    const dueDate = r['Due on'] || issueDate
    if (!/^\d{4}-\d{2}-\d{2}$/.test(issueDate ?? '') || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) { warnings.push(`${number}: invalid dates, skipped`); continue }
    const customer = customerFor(r)
    const total = amount(r['Total'])
    const base = amount(r['Subtotal'])
    const vat = amount(r['Vat'])
    const proforma = r['Proforma'] === 'true'
    const taxDoc = r['Tax document'] === 'true'
    const related = r['Related'] ? byFakturoidId.get(r['Related']) : undefined
    // A negative document is a credit note when it points to the invoice it corrects; otherwise it stays a negative
    // invoice (a refund or a discount), since a credit note needs its original.
    const corrects = total < 0 && related && related['Proforma'] !== 'true' ? related : undefined
    const kind: Invoice['kind'] = taxDoc ? 'advanceTaxDoc' : proforma ? 'proforma' : corrects ? 'creditNote' : 'invoice'
    const lang = language(r['Language'] ?? '')
    const status = r['Status']
    const paid = status === 'paid' || !!r['Paid on']
    const currency = r['Currency'] || 'CZK'
    const rate = Number((r['Exchange rate'] ?? '').replace(',', '.'))
    const reverseCharge = r['Transferred tax liability'] === 'true'

    // A final invoice settled by a paid proforma points to it (Related); its money came with the proforma.
    const advance = kind === 'invoice' && related?.['Proforma'] === 'true' ? related : undefined
    const advanceAmount = advance ? Math.min(amount(advance['Total']), total) : undefined

    invoices.push({
      id: ids.get(r['Id'] || number)!,
      kind,
      number,
      variableSymbol: r['Variable symbol'] || number.replace(/\D/g, ''),
      orderNumber: r['Order number'] ?? '',
      customerId: customer.id,
      customerSnapshot: {
        name: r['Client name'], ic: normalizeIc(r['Client registration no'] ?? ''), dic: r['Client vat no'] ?? '',
        address: {
          street: [r['Client street'], r['Client street2']].filter(Boolean).join(', '),
          zip: r['Client zip'] ?? '', city: r['Client city'] ?? '', country: countryName(r['Client country'] ?? ''),
        },
      },
      issueDate,
      dueDate,
      taxableSupplyDate: vatMode === 'payer' && r['Taxable fulfillment due'] ? r['Taxable fulfillment due'] : undefined,
      paidDate: paid ? (r['Paid on'] || undefined) : undefined,
      paidAmount: paid ? total - (advanceAmount ?? 0) : undefined,
      currency,
      exchangeRate: currency !== 'CZK' && rate > 0 ? rate : undefined,
      exchangeRateSource: currency !== 'CZK' && rate > 0 ? 'cnb' : undefined,
      language: lang,
      paymentMethod: r['Payment method'] === 'cash' ? 'cash' : r['Payment method'] === 'cod' ? 'cod' : 'bank',
      vatMode,
      reverseCharge,
      lines: linesFor(base, vat, total, vatMode, lineText(number, lang)),
      recordedTotal: total,
      note: '',
      correctsId: corrects ? ids.get(corrects['Id']) : undefined,
      correctsNumber: corrects?.['Number'],
      correctionReason: corrects ? lineText(corrects['Number'], lang) : '',
      advanceId: advance ? ids.get(advance['Id']) : taxDoc && related ? ids.get(related['Id']) : undefined,
      advanceNumber: advance?.['Number'],
      advanceAmount,
      status: status === 'cancelled' ? 'cancelled' : paid ? 'paid' : 'issued',
      uncollectible: status === 'uncollectible' ? (r['Cancelled at'] || issueDate).slice(0, 10) : undefined,
      privateNote: '',
      tags: [],
      sentAt: r['Sent at'] ? r['Sent at'].slice(0, 10) : undefined,
      reminders: r['Reminder sent at'] ? [r['Reminder sent at'].slice(0, 10)] : [],
    })
    if (paid && !r['Paid on']) warnings.push(`${number}: marked paid without a payment date`)
  }

  const newest = rows[0]
  const bank = splitAccount(newest?.['Bank account'] ?? '')
  const supplier: Partial<Settings['supplier']> = newest ? {
    name: newest['Your name'] ?? '', ic: normalizeIc(newest['Your registration no'] ?? ''), dic: newest['Your vat no'] ?? '',
    address: {
      street: [newest['Your street'], newest['Your street2']].filter(Boolean).join(', '),
      zip: newest['Your zip'] ?? '', city: newest['Your city'] ?? '', country: countryName(newest['Your country'] ?? ''),
    },
    bank: { ...bank, iban: (newest['Iban'] ?? '').replace(/\s/g, ''), swift: newest['Swift bic'] ?? '' },
  } : {}

  const year = Number((newest?.['Issued on'] ?? '').slice(0, 4)) || new Date().getFullYear()
  const newestOf = (k: Invoice['kind']) => invoices.find((i) => i.kind === k)?.number
  const pattern = (n?: string) => (n ? guessPattern(n, year) : undefined)
  const main = pattern(newestOf('invoice'))
  // A series Fakturoid shares with the invoices (its credit notes often do) keeps Invojka's own default.
  const numbering: Partial<Settings['numbering']> = Object.fromEntries(Object.entries({
    pattern: main,
    proformaPattern: pattern(newestOf('proforma')),
    creditNotePattern: pattern(newestOf('creditNote')),
    advanceTaxDocPattern: pattern(newestOf('advanceTaxDoc')),
  }).filter(([k, v]) => v && (k === 'pattern' || v !== main)))

  const charged = rows.some((r) => amount(r['Vat']) !== 0)
  return {
    customers,
    invoices,
    merges: customers.filter((c) => merges.has(c.id)).map((c) => ({ kept: c.name, merged: [...merges.get(c.id)!] })),
    createdFromInvoices: [],
    warnings,
    supplier,
    vatMode: charged ? 'payer' : !supplier.dic ? 'nonPayer' : undefined,
    numbering,
  }
}
