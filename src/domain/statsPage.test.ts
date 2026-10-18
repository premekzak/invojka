import { describe, expect, it } from 'vitest'
import { newInvoice } from './invoice'
import { SCHEMA_VERSION, Settings, type Invoice } from './schema'
import { debtors, periodStats, revenueByCurrency, topCustomers, yearStats } from './stats'

const settings = Settings.parse({ schemaVersion: SCHEMA_VERSION, supplier: { name: 'T' }, vatMode: 'nonPayer' })
const doc = (customerId: string, issueDate: string, amount: number, patch: Partial<Invoice> = {}): Invoice => ({
  ...newInvoice(settings, [], undefined, issueDate), customerId, status: 'issued', dueDate: issueDate,
  customerSnapshot: { name: `Firma ${customerId}`, ic: '', dic: '', address: { street: '', zip: '', city: '', country: '' } },
  lines: [{ description: 'x', quantity: 1, unit: '', unitPrice: amount, vatRate: 0 }], ...patch,
})

const invoices = [
  doc('a', '2026-01-15', 100_00, { status: 'paid', paidDate: '2026-02-04' }),
  doc('a', '2026-03-31', 200_00, { taxableSupplyDate: '2026-04-01', status: 'paid', paidDate: '2026-04-10' }),
  doc('b', '2026-05-01', 700_00, { dueDate: '2026-05-15' }),
  doc('b', '2026-06-01', 50_00, { dueDate: '2026-06-15' }),
  doc('c', '2026-12-30', 300_00, { currency: 'EUR', exchangeRate: 25, status: 'paid', paidDate: '2027-01-05' }),
  doc('d', '2026-07-01', 40_00, { currency: 'NZD' }),
  doc('a', '2026-08-01', 999_00, { status: 'draft' }),
  doc('a', '2026-08-02', 999_00, { status: 'cancelled' }),
  doc('e', '2026-09-01', 500_00, { kind: 'proforma', status: 'paid', paidDate: '2026-09-03' }),
]

describe('statistics', () => {
  it('counts revenue by issue date, DUZP or payment date, per month or quarter', () => {
    const issue = periodStats(invoices, 2026, 'issue', 'quarter')
    expect(issue.values).toEqual([300_00, 750_00, 0, 7500_00])
    expect(issue.counts).toEqual([2, 2, 0, 1])
    expect(issue.missingRate).toEqual({ count: 1, currencies: ['NZD'] })
    // DUZP moves the March invoice into April; documents without a DUZP use the issue date.
    expect(periodStats(invoices, 2026, 'taxable', 'quarter').values).toEqual([100_00, 950_00, 0, 7500_00])
    // Money received: the January invoice paid in February, the March one in April, the advance on the proforma in
    // September; the EUR one only in 2027.
    const paid = periodStats(invoices, 2026, 'paid', 'month')
    expect(paid.values[1]).toBe(100_00)
    expect(paid.values[3]).toBe(200_00)
    expect(paid.values[8]).toBe(500_00)
    expect(paid.values.reduce((a, b) => a + b, 0)).toBe(800_00)
  })

  it('ranks customers with their share and days to pay', () => {
    const top = topCustomers(invoices, 2026, 'issue')
    expect(top.map((r) => [r.customerId, r.revenue, r.count])).toEqual([['c', 7500_00, 1], ['b', 750_00, 2], ['a', 300_00, 2]])
    expect(top[0]!.share).toBeCloseTo(7500 / 8550)
    expect(top.find((r) => r.customerId === 'a')!.daysToPay).toBe(Math.round((20 + 10) / 2))
    expect(top.find((r) => r.customerId === 'b')!.daysToPay).toBeUndefined()
  })

  it('lists debtors by what is overdue, with the oldest days', () => {
    // On 1 July only b's two invoices are overdue (the NZD one falls due that day).
    expect(debtors(invoices, '2026-07-01')).toEqual([{ customerId: 'b', name: 'Firma b', overdue: 750_00, count: 2, oldestDays: 47 }])
    // A day later the NZD one is overdue too, but without a rate it adds nothing in CZK, so it comes last.
    expect(debtors(invoices, '2026-07-02').map((d) => [d.customerId, d.overdue, d.count])).toEqual([['b', 750_00, 2], ['d', 0, 1]])
  })

  it('sums the year by currency', () => {
    expect(revenueByCurrency(invoices, 2026)).toEqual([
      { currency: 'EUR', amount: 300_00, czk: 7500_00 },
      { currency: 'CZK', amount: 1050_00, czk: 1050_00 },
      { currency: 'NZD', amount: 40_00, czk: undefined },
    ])
  })
})

describe('statistics by year', () => {
  it('cover every year from the first document, on each basis', () => {
    const old = doc('a', '2023-05-01', 50_00, { status: 'paid', paidDate: '2024-01-10' })
    const y = yearStats([old, ...invoices], 'issue', 2026)
    expect(y.years).toEqual([2023, 2024, 2025, 2026])
    expect(y.values).toEqual([50_00, 0, 0, 8550_00])
    expect(y.counts).toEqual([1, 0, 0, 5])
    // By payment the old one counts in 2024, and the EUR one paid in January 2027 is after the last year.
    expect(yearStats([old, ...invoices], 'paid', 2026).values).toEqual([50_00, 0, 800_00])
  })
})
