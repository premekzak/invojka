import { displayStatus, invoiceTotals, totalCzk } from './invoice'
import type { Invoice } from './schema'

/**
 * Invoices that count as revenue: issued or paid, by issue date. Every screen that shows revenue uses this,
 * so Home, the charts and the customers show the same numbers.
 */
export const countsAsRevenue = (inv: Invoice) => inv.status === 'issued' || inv.status === 'paid'
const counts = countsAsRevenue

export interface RevenueSeries {
  /** CZK minor units. */
  values: number[]
  /** Revenue invoices left out because they're in another currency without an exchange rate. */
  missingRate: { count: number; currencies: string[] }
}

function collect(invoices: Invoice[], keyOf: (inv: Invoice) => number | undefined, size: number): RevenueSeries {
  const values = new Array<number>(size).fill(0)
  const currencies = new Set<string>()
  let count = 0
  for (const inv of invoices) {
    if (!counts(inv)) continue
    const k = keyOf(inv)
    if (k === undefined) continue
    const czk = totalCzk(inv)
    if (czk === undefined) {
      count++
      currencies.add(inv.currency)
      continue
    }
    values[k] += czk
  }
  return { values, missingRate: { count, currencies: [...currencies].sort() } }
}

/** Revenue per month (index 0 = January) of one year. */
export const monthlyRevenue = (invoices: Invoice[], year: number) =>
  collect(invoices, (inv) => (inv.issueDate.startsWith(`${year}-`) ? Number(inv.issueDate.slice(5, 7)) - 1 : undefined), 12)

/** Revenue per year, every year from the first invoice to `lastYear` (gaps included as 0). */
export function yearlyRevenue(invoices: Invoice[], lastYear: number): { years: number[] } & RevenueSeries {
  const first = invoices.filter(counts).reduce((m, i) => Math.min(m, Number(i.issueDate.slice(0, 4))), lastYear)
  const years = Array.from({ length: lastYear - first + 1 }, (_, i) => first + i)
  const res = collect(invoices, (inv) => {
    const y = Number(inv.issueDate.slice(0, 4))
    return y >= first && y <= lastYear ? y - first : undefined
  }, years.length)
  return { years, ...res }
}

export interface CustomerStats {
  /** Issued and paid invoices. */
  count: number
  /** Paid invoices only (the owner's choice: a customer shows what they actually paid). */
  paidCount: number
  /** CZK minor units of the paid invoices that can be converted. */
  paid: number
  /** Paid invoices without an exchange rate, summed in their own currency (minor units), so they never show as 0 Kč. */
  paidUnconverted: Record<string, number>
  /** Issue date of the latest issued or paid invoice, '' when none. */
  last: string
}

export const emptyCustomerStats = (): CustomerStats => ({ count: 0, paidCount: 0, paid: 0, paidUnconverted: {}, last: '' })

/** Per-customer figures for the customer list and detail, keyed by customer id. */
export function customerStats(invoices: Invoice[]): Map<string, CustomerStats> {
  const stats = new Map<string, CustomerStats>()
  for (const inv of invoices) {
    if (!inv.customerId || !counts(inv)) continue
    const s = stats.get(inv.customerId) ?? emptyCustomerStats()
    s.count++
    if (inv.status === 'paid') {
      s.paidCount++
      const czk = totalCzk(inv)
      if (czk !== undefined) s.paid += czk
      else s.paidUnconverted[inv.currency] = (s.paidUnconverted[inv.currency] ?? 0) + invoiceTotals(inv).total
    }
    if (inv.issueDate > s.last) s.last = inv.issueDate
    stats.set(inv.customerId, s)
  }
  return stats
}

export interface HomeStats {
  /** This year's revenue so far and the same period of last year, CZK minor units. */
  revenue: number
  revenueLast: number
  countThisYear: number
  /** Issued and unpaid, of which overdue. */
  outstanding: number
  overdueSum: number
  overdueCount: number
  /** Revenue invoices of any year in another currency without an exchange rate; they add nothing above. */
  missingRate: RevenueSeries['missingRate']
}

/** The figures in Home's summary and tasks, as of `on` (yyyy-mm-dd). */
export function homeStats(invoices: Invoice[], on: string): HomeStats {
  const year = on.slice(0, 4)
  const lastYear = String(Number(year) - 1)
  const sameDayLastYear = `${lastYear}${on.slice(4)}`
  const s: HomeStats = { revenue: 0, revenueLast: 0, countThisYear: 0, outstanding: 0, overdueSum: 0, overdueCount: 0, missingRate: { count: 0, currencies: [] } }
  const currencies = new Set<string>()
  for (const inv of invoices) {
    if (!counts(inv)) continue
    const czk = totalCzk(inv) ?? 0
    if (totalCzk(inv) === undefined) { s.missingRate.count++; currencies.add(inv.currency) }
    if (inv.issueDate.startsWith(`${year}-`)) { s.revenue += czk; s.countThisYear++ }
    if (inv.issueDate.startsWith(`${lastYear}-`) && inv.issueDate <= sameDayLastYear) s.revenueLast += czk
    if (inv.status === 'issued') {
      s.outstanding += czk
      if (displayStatus(inv, on) === 'overdue') { s.overdueSum += czk; s.overdueCount++ }
    }
  }
  s.missingRate.currencies = [...currencies].sort()
  return s
}
