import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { importCsv } from '@/import/csv'
import { fixtureCustomersCsv, fixtureInvoicesCsv } from '@/import/fixture'
import { displayStatus, totalCzk } from './invoice'
import type { Invoice } from './schema'
import { countsAsRevenue, customerStats, homeStats, monthlyRevenue, yearlyRevenue } from './stats'

const fixture = importCsv(fixtureCustomersCsv, fixtureInvoicesCsv, 'nonPayer')
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)

describe('revenue stats (made-up export)', () => {
  const { invoices } = fixture

  it('sums CZK months', () => {
    const m = monthlyRevenue(invoices, 2026)
    expect(m.values).toHaveLength(12)
    expect([m.values[1], m.values[7], m.values[8]]).toEqual([1200000, 850000, 1450000])
    expect(m.values.slice(9)).toEqual([0, 0, 0])
  })

  it('covers every year, matches the CSV totals and reports foreign invoices without a rate', () => {
    const y = yearlyRevenue(invoices, 2026)
    expect(y.years[0]).toBe(2014)
    expect(y.years.at(-1)).toBe(2026)
    const czkTotal = invoices.filter((i) => i.currency === 'CZK').reduce((s, i) => s + i.recordedTotal!, 0)
    expect(sum(y.values)).toBe(czkTotal)
    expect(y.missingRate).toEqual({ count: 2, currencies: ['EUR', 'NZD'] })
  })

  it('counts converted foreign invoices', () => {
    const nzd = invoices.find((i) => i.currency === 'NZD')!
    const withRate = invoices.map((i) => (i.id === nzd.id ? { ...i, exchangeRate: 13.5 } : i))
    const before = yearlyRevenue(invoices, 2026)
    const after = yearlyRevenue(withRate, 2026)
    const idx = before.years.indexOf(Number(nzd.issueDate.slice(0, 4)))
    expect(after.values[idx]! - before.values[idx]!).toBe(Math.round(nzd.recordedTotal! * 13.5))
    expect(after.missingRate.count).toBe(1)
  })

  it('gives Home its figures', () => {
    expect(homeStats(invoices, '2026-10-17')).toEqual({
      revenue: 3500000, revenueLast: 0, countThisYear: 3, outstanding: 1450000, overdueSum: 1450000, overdueCount: 1,
    })
    // Before the due date of the open invoice it's outstanding, not overdue.
    expect(homeStats(invoices, '2026-09-10')).toMatchObject({ outstanding: 1450000, overdueCount: 0 })
  })
})

/**
 * The same money must show the same number on every screen: Home, the charts, the customer list and detail.
 * These checks hold for any data, so they run on the made-up export and, when present, on the real one.
 */
function expectConsistent(invoices: Invoice[], on: string) {
  const year = Number(on.slice(0, 4))
  const home = homeStats(invoices, on)
  const revenueInvoices = invoices.filter(countsAsRevenue)

  // Home's "this year" equals the sum of this year's chart.
  expect(home.revenue).toBe(sum(monthlyRevenue(invoices, year).values))
  expect(home.countThisYear).toBe(revenueInvoices.filter((i) => i.issueDate.startsWith(`${year}-`)).length)
  // Last year's comparison is never more than the whole of last year.
  expect(home.revenueLast).toBeLessThanOrEqual(sum(monthlyRevenue(invoices, year - 1).values))

  // All customers together, plus invoices without a customer, equal the all-time chart (up to this year).
  const upToNow = invoices.filter((i) => Number(i.issueDate.slice(0, 4)) <= year)
  const perCustomer = [...customerStats(upToNow).values()]
  const unlinked = upToNow.filter((i) => countsAsRevenue(i) && !i.customerId).reduce((s, i) => s + (totalCzk(i) ?? 0), 0)
  expect(sum(perCustomer.map((c) => c.revenue)) + unlinked).toBe(sum(yearlyRevenue(upToNow, year).values))
  expect(sum(perCustomer.map((c) => c.count))).toBe(upToNow.filter((i) => countsAsRevenue(i) && i.customerId).length)

  // Overdue is part of what's waiting to be paid, and Home counts the same invoices the "Overdue" filter shows.
  expect(home.overdueSum).toBeLessThanOrEqual(home.outstanding)
  expect(home.overdueCount).toBe(invoices.filter((i) => displayStatus(i, on) === 'overdue').length)
}

describe('every screen shows the same numbers', () => {
  it.each(['2026-10-17', '2026-09-10', '2015-06-30', '2027-01-01'])('made-up export, as of %s', (on) => {
    expectConsistent(fixture.invoices, on)
  })

  it('with drafts and cancelled invoices, which never count', () => {
    const extra = fixture.invoices.map((i, n) => ({ ...i, id: `x${n}`, number: `x${n}`, status: n % 2 ? 'draft' : 'cancelled' } as Invoice))
    const all = [...fixture.invoices, ...extra]
    expectConsistent(all, '2026-10-17')
    expect(homeStats(all, '2026-10-17')).toEqual(homeStats(fixture.invoices, '2026-10-17'))
  })

  // The owner's real export is git-ignored (client data), so this only runs on their machine.
  const real = (f: string) => new URL(`../../${f}`, import.meta.url)
  it.skipIf(!existsSync(real('customers.csv')) || !existsSync(real('invoices.csv')))('real export (local only)', () => {
    const { invoices } = importCsv(readFileSync(real('customers.csv'), 'utf8'), readFileSync(real('invoices.csv'), 'utf8'), 'nonPayer')
    for (const on of ['2026-10-17', '2020-06-30', '2014-12-31']) expectConsistent(invoices, on)
  })
})
