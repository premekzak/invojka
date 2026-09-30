import { today } from '@/domain/id'
import type { RateTable } from '@/domain/fx'

// ECB reference rates via Frankfurter (frankfurter.dev), a free service that allows browser requests.
// ČNB's own API can't be called from a browser (no CORS), so official ČNB rates come from its rok.txt file instead.
// A request carries only the currency code and a date range, never any invoice data.

const API = 'https://api.frankfurter.dev/v1'

/** Daily CZK rates for one currency over one year (up to today). */
export async function fetchEcbYear(currency: string, year: number): Promise<RateTable> {
  const end = `${year}-12-31` < today() ? `${year}-12-31` : today()
  // Start a week early so 1–2 January can fall back to the last rate of the previous year.
  const url = `${API}/${year - 1}-12-24..${end}?from=${encodeURIComponent(currency)}&to=CZK`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${currency} ${year}: HTTP ${res.status}`)
  const json = (await res.json()) as { rates: Record<string, { CZK?: number }> }
  const list = Object.entries(json.rates)
    .filter(([, r]) => typeof r.CZK === 'number')
    .map(([d, r]) => [d, r.CZK!] as [string, number])
    .sort(([a], [b]) => a.localeCompare(b))
  return new Map([[currency, list]])
}

/** The ECB rate for one currency on one date (latest published on or before it). */
export async function fetchEcbRate(currency: string, date: string): Promise<number | undefined> {
  const from = new Date(Date.parse(date) - 10 * 864e5).toISOString().slice(0, 10)
  const res = await fetch(`${API}/${from}..${date}?from=${encodeURIComponent(currency)}&to=CZK`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const json = (await res.json()) as { rates: Record<string, { CZK?: number }> }
  const days = Object.keys(json.rates).filter((d) => d <= date).sort()
  return days.length ? json.rates[days.at(-1)!].CZK : undefined
}
