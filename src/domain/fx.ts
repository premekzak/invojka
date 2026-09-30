import type { Invoice } from './schema'

export type RateSource = 'cnb' | 'ecb' | 'manual'

/** CZK per 1 unit of currency, by currency, as [isoDate, rate] sorted by date. */
export type RateTable = Map<string, [string, number][]>

/** The date whose rate applies to an invoice: the tax point date (DUZP) if any, else the issue date. */
export const rateDateOf = (inv: Invoice) => inv.taxableSupplyDate ?? inv.issueDate

export const needsRate = (inv: Invoice) => inv.currency !== 'CZK' && !inv.exchangeRate

/**
 * Rate valid on `date`: the latest published rate on or before it (weekends and holidays use the previous
 * business day, as both ČNB and ECB do). Undefined if nothing was published within 10 days before.
 */
export function rateOn(table: RateTable, currency: string, date: string): number | undefined {
  const list = table.get(currency)
  if (!list?.length) return undefined
  let lo = 0, hi = list.length - 1, found = -1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (list[mid][0] <= date) { found = mid; lo = mid + 1 } else hi = mid - 1
  }
  if (found === -1) return undefined
  const gapDays = (Date.parse(date) - Date.parse(list[found][0])) / 864e5
  return gapDays <= 10 ? list[found][1] : undefined
}

export function mergeTables(...tables: RateTable[]): RateTable {
  const out: RateTable = new Map()
  for (const t of tables) {
    for (const [cur, list] of t) {
      const m = new Map(out.get(cur) ?? [])
      for (const [d, r] of list) m.set(d, r)
      out.set(cur, [...m.entries()].sort(([a], [b]) => a.localeCompare(b)))
    }
  }
  return out
}

/**
 * Parse ČNB's yearly rate file (rok.txt, downloadable from cnb.cz):
 *   Datum|1 AUD|...|100 HUF|...|1 NZD
 *   04.01.2016|17,828|...|8,543|...|16,591
 * The header can repeat mid-file when the currency list changes.
 */
export function parseCnbYear(text: string): RateTable {
  const table: RateTable = new Map()
  let cols: { code: string; amount: number }[] = []
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line) continue
    const cells = line.split('|')
    if (/^dat/i.test(cells[0])) {
      cols = cells.slice(1).map((c) => {
        const [amount, code] = c.trim().split(/\s+/)
        return { code, amount: Number(amount) }
      })
      continue
    }
    const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(cells[0])
    if (!m || !cols.length) continue
    const date = `${m[3]}-${m[2]}-${m[1]}`
    cells.slice(1).forEach((c, i) => {
      const col = cols[i]
      const v = Number(c.replace(',', '.'))
      if (!col || !Number.isFinite(v) || v <= 0) return
      const list = table.get(col.code) ?? []
      list.push([date, v / col.amount])
      table.set(col.code, list)
    })
  }
  for (const list of table.values()) list.sort(([a], [b]) => a.localeCompare(b))
  return table
}

/** Fill in missing rates (never overwrites an existing one). Returns the updated invoices only. */
export function fillRates(invoices: Invoice[], table: RateTable, source: RateSource): Invoice[] {
  const updated: Invoice[] = []
  for (const inv of invoices) {
    if (!needsRate(inv)) continue
    const rate = rateOn(table, inv.currency, rateDateOf(inv))
    if (rate) updated.push({ ...inv, exchangeRate: rate, exchangeRateSource: source })
  }
  return updated
}

/** Which currency/year combinations have to be fetched to fill the missing rates. */
export function missingRateRequests(invoices: Invoice[]): { currency: string; year: number }[] {
  const keys = new Set<string>()
  for (const inv of invoices) if (needsRate(inv) && inv.status !== 'draft') keys.add(`${inv.currency}|${rateDateOf(inv).slice(0, 4)}`)
  return [...keys].sort().map((k) => {
    const [currency, year] = k.split('|')
    return { currency, year: Number(year) }
  })
}
