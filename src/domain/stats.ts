import { differenceInCalendarDays, parseISO } from 'date-fns'
import { displayStatus, dueCzk, invoiceTotals, totalCzk } from './invoice'
import { mulRound } from './money'
import type { Invoice } from './schema'

/**
 * Invoices that count as revenue: issued or paid, by issue date. Every screen that shows revenue uses this,
 * so Home, the charts and the customers show the same numbers. A proforma isn't revenue: its final invoice is.
 */
export const countsAsRevenue = (inv: Invoice) =>
  // The payer's tax document for an advance isn't counted either: the final invoice carries the full amount.
  inv.kind !== 'proforma' && inv.kind !== 'advanceTaxDoc' && (inv.status === 'issued' || inv.status === 'paid')
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
    // Credit notes change the amounts but aren't invoices to count.
    const isInvoice = inv.kind !== 'creditNote'
    if (isInvoice) s.count++
    if (inv.status === 'paid') {
      if (isInvoice) s.paidCount++
      const czk = totalCzk(inv)
      if (czk !== undefined) s.paid += czk
      else s.paidUnconverted[inv.currency] = (s.paidUnconverted[inv.currency] ?? 0) + invoiceTotals(inv).total
    }
    if (inv.issueDate > s.last) s.last = inv.issueDate
    stats.set(inv.customerId, s)
  }
  return stats
}

/**
 * What each issued invoice still waits for, in CZK: what's due, less its issued credit notes, since the customer pays
 * only the difference (never below zero). A credit note for a paid invoice is a refund the supplier owes, so it lowers
 * nothing here; a written-off invoice waits for nothing. Undefined when the invoice has no exchange rate: it waits,
 * but adds 0 to the sums, as everywhere.
 */
function stillDue(invoices: Invoice[]): Map<string, number | undefined> {
  const credits = new Map<string, number>()
  for (const c of invoices) {
    if (c.kind === 'creditNote' && c.status === 'issued' && c.correctsId) credits.set(c.correctsId, (credits.get(c.correctsId) ?? 0) + (dueCzk(c) ?? 0))
  }
  const due = new Map<string, number | undefined>()
  for (const inv of invoices) {
    if (inv.kind === 'creditNote' || !counts(inv) || inv.status !== 'issued' || inv.uncollectible) continue
    const czk = dueCzk(inv)
    due.set(inv.id, czk === undefined ? undefined : Math.max(0, czk + (credits.get(inv.id) ?? 0)))
  }
  return due
}

export interface HomeStats {
  /** This year's revenue so far and the same period of last year, CZK minor units. */
  revenue: number
  revenueLast: number
  /** Invoices only; credit notes count in `revenue` but not here. */
  countThisYear: number
  /** Issued and unpaid, of which overdue, less issued credit notes for them (see `stillDue`). */
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
  const due = stillDue(invoices)
  for (const inv of invoices) {
    if (!counts(inv)) continue
    const czk = totalCzk(inv) ?? 0
    if (totalCzk(inv) === undefined) { s.missingRate.count++; currencies.add(inv.currency) }
    if (inv.issueDate.startsWith(`${year}-`)) { s.revenue += czk; if (inv.kind !== 'creditNote') s.countThisYear++ }
    if (inv.issueDate.startsWith(`${lastYear}-`) && inv.issueDate <= sameDayLastYear) s.revenueLast += czk
    // A final invoice waits only for what the advance didn't cover.
    if (due.has(inv.id)) {
      const open = due.get(inv.id)
      s.outstanding += open ?? 0
      // Credited in full, it waits for nothing, so it's no overdue task either.
      if (open !== 0 && displayStatus(inv, on) === 'overdue') { s.overdueSum += open ?? 0; s.overdueCount++ }
    }
  }
  s.missingRate.currencies = [...currencies].sort()
  return s
}

// ---------------------------------------------------------------------------------------------------- statistics page

/**
 * Which date puts an invoice into a period: its issue date (like revenue everywhere else), its DUZP (the VAT period;
 * the issue date for documents without one) or its payment date (money received, cash basis).
 */
export type StatsBasis = 'issue' | 'taxable' | 'paid'
export type StatsGrain = 'month' | 'quarter'

/** Money received for a paid document, in CZK: what was paid, so a final invoice adds only its balance. */
function receivedCzk(inv: Invoice): number | undefined {
  const paid = inv.paidAmount ?? invoiceTotals(inv).total - (inv.advanceAmount ?? 0)
  return inv.currency === 'CZK' ? paid : inv.exchangeRate ? mulRound(paid, inv.exchangeRate) : undefined
}

/** The documents counted on each basis, with their date and CZK amount (undefined without a rate). */
function basisEntries(invoices: Invoice[], basis: StatsBasis): { inv: Invoice; date: string; czk: number | undefined }[] {
  if (basis === 'paid') {
    // Money received: paid invoices, credit notes and proformas (an advance comes in on the proforma); a tax document
    // for a payment repeats its proforma.
    return invoices.filter((i) => i.status === 'paid' && i.paidDate && i.kind !== 'advanceTaxDoc')
      .map((inv) => ({ inv, date: inv.paidDate!, czk: receivedCzk(inv) }))
  }
  return invoices.filter(countsAsRevenue)
    .map((inv) => ({ inv, date: basis === 'taxable' ? inv.taxableSupplyDate ?? inv.issueDate : inv.issueDate, czk: totalCzk(inv) }))
}

export interface PeriodStats extends RevenueSeries {
  /** Documents per period (invoices only, like Home's count). */
  counts: number[]
}

/** Revenue of one year per month (12) or quarter (4) on the chosen basis, CZK minor units. */
export function periodStats(invoices: Invoice[], year: number, basis: StatsBasis, grain: StatsGrain): PeriodStats {
  const size = grain === 'month' ? 12 : 4
  const values = new Array<number>(size).fill(0)
  const counts = new Array<number>(size).fill(0)
  const currencies = new Set<string>()
  let missing = 0
  for (const { inv, date, czk } of basisEntries(invoices, basis)) {
    if (!date.startsWith(`${year}-`)) continue
    const month = Number(date.slice(5, 7)) - 1
    const k = grain === 'month' ? month : Math.floor(month / 3)
    if (czk === undefined) { missing++; currencies.add(inv.currency); continue }
    values[k] += czk
    if (inv.kind === 'invoice') counts[k]++
  }
  return { values, counts, missingRate: { count: missing, currencies: [...currencies].sort() } }
}

export interface CustomerRank {
  customerId: string
  name: string
  /** CZK minor units on the chosen basis in the year. */
  revenue: number
  /** Share of the year's total, 0–1. */
  share: number
  count: number
  /** Average days from issue to payment of the invoices paid in the year, undefined when none. */
  daysToPay?: number
}

/** The year's biggest customers on the chosen basis, with their share and how fast they pay. */
export function topCustomers(invoices: Invoice[], year: number, basis: StatsBasis): CustomerRank[] {
  const by = new Map<string, CustomerRank & { days: number[] }>()
  let total = 0
  for (const { inv, date, czk } of basisEntries(invoices, basis)) {
    if (!date.startsWith(`${year}-`) || czk === undefined || !inv.customerId) continue
    const r = by.get(inv.customerId) ?? { customerId: inv.customerId, name: inv.customerSnapshot.name, revenue: 0, share: 0, count: 0, days: [] }
    r.revenue += czk
    total += czk
    if (inv.kind === 'invoice') r.count++
    by.set(inv.customerId, r)
  }
  // How fast they pay: invoices paid this year, whatever the basis.
  for (const inv of invoices) {
    if (inv.kind !== 'invoice' || inv.status !== 'paid' || !inv.paidDate?.startsWith(`${year}-`) || !inv.customerId) continue
    by.get(inv.customerId)?.days.push(differenceInCalendarDays(parseISO(inv.paidDate), parseISO(inv.issueDate)))
  }
  return [...by.values()]
    .map(({ days, ...r }) => ({ ...r, share: total ? r.revenue / total : 0, daysToPay: days.length ? Math.round(days.reduce((a, b) => a + b, 0) / days.length) : undefined }))
    .sort((a, b) => b.revenue - a.revenue)
}

export interface Debtor { customerId: string | null; name: string; overdue: number; count: number; oldestDays: number }

/** Customers with overdue invoices as of `on`, the most owed first (CZK minor units of what's still due, as on Home). */
export function debtors(invoices: Invoice[], on: string): Debtor[] {
  const by = new Map<string, Debtor>()
  const due = stillDue(invoices)
  for (const inv of invoices) {
    if (!due.has(inv.id) || due.get(inv.id) === 0 || displayStatus(inv, on) !== 'overdue') continue
    const key = inv.customerId ?? inv.customerSnapshot.name
    const d = by.get(key) ?? { customerId: inv.customerId, name: inv.customerSnapshot.name, overdue: 0, count: 0, oldestDays: 0 }
    d.overdue += due.get(inv.id) ?? 0
    d.count++
    d.oldestDays = Math.max(d.oldestDays, differenceInCalendarDays(parseISO(on), parseISO(inv.dueDate)))
    by.set(key, d)
  }
  return [...by.values()].sort((a, b) => b.overdue - a.overdue)
}

/** The year's revenue (by issue date) in each invoice currency, in that currency's minor units. */
export function revenueByCurrency(invoices: Invoice[], year: number): { currency: string; amount: number; czk?: number }[] {
  const by = new Map<string, { amount: number; czk?: number }>()
  for (const inv of invoices) {
    if (!countsAsRevenue(inv) || !inv.issueDate.startsWith(`${year}-`)) continue
    const r = by.get(inv.currency) ?? { amount: 0, czk: 0 }
    r.amount += invoiceTotals(inv).total
    const czk = totalCzk(inv)
    r.czk = czk === undefined || r.czk === undefined ? undefined : r.czk + czk
    by.set(inv.currency, r)
  }
  return [...by.entries()].map(([currency, r]) => ({ currency, ...r })).sort((a, b) => (b.czk ?? 0) - (a.czk ?? 0))
}

/** Revenue per year on the chosen basis, every year from the first document to `lastYear` (gaps as 0). */
export function yearStats(invoices: Invoice[], basis: StatsBasis, lastYear: number): { years: number[] } & PeriodStats {
  const entries = basisEntries(invoices, basis)
  const first = entries.reduce((m, e) => Math.min(m, Number(e.date.slice(0, 4))), lastYear)
  const years = Array.from({ length: lastYear - first + 1 }, (_, i) => first + i)
  const values = new Array<number>(years.length).fill(0)
  const counts = new Array<number>(years.length).fill(0)
  const currencies = new Set<string>()
  let missing = 0
  for (const { inv, date, czk } of entries) {
    const k = Number(date.slice(0, 4)) - first
    if (k < 0 || k >= years.length) continue
    if (czk === undefined) { missing++; currencies.add(inv.currency); continue }
    values[k] += czk
    if (inv.kind === 'invoice') counts[k]++
  }
  return { years, values, counts, missingRate: { count: missing, currencies: [...currencies].sort() } }
}
