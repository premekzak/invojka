import { totalCzk } from './invoice'
import type { Invoice } from './schema'

/** Invoices that count as revenue: issued or paid, by issue date. */
const counts = (inv: Invoice) => inv.status === 'issued' || inv.status === 'paid'

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
