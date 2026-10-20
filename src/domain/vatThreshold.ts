import { totalCzk } from './invoice'
import type { Invoice, Settings } from './schema'
import { countsAsRevenue } from './stats'

/**
 * VAT registration limits (zákon o DPH § 6, since 2025), CZK minor units. Over the first in a calendar year, a business
 * becomes a VAT payer from 1 January of the next year; over the second, from the day after it was exceeded.
 */
export const VAT_LIMIT = 200_000_000
export const VAT_LIMIT_IMMEDIATE = 253_650_000
/** From this share of the limit on, Home warns that it's getting close. */
export const VAT_NEAR = 0.8

/** An empty country counts as Czech: most customers in a Czech app are, and the onboarding fills in "Česká republika". */
export const isCzechCountry = (country: string) => !country.trim() || /česk|czech|^\s*(cz|čr|cr)\s*$/i.test(country)

export interface VatTurnover {
  /** Invoices to Czech customers, CZK minor units; this is what counts towards the limit. */
  domestic: number
  /** Invoices to foreign customers, CZK minor units; services to foreign businesses are supplied abroad and don't count. */
  foreign: number
  /** Invoices in another currency without an exchange rate, left out of both sums. */
  missingRate: { count: number; currencies: string[] }
}

/**
 * Turnover for the VAT registration limit in one calendar year, from issued and paid invoices by issue date, plus the
 * turnover invoiced before Invojka (`opening`) in its year.
 */
export function vatTurnover(invoices: Invoice[], year: number, opening?: Settings['opening']): VatTurnover {
  const t: VatTurnover = { domestic: opening?.year === year ? opening.turnover : 0, foreign: 0, missingRate: { count: 0, currencies: [] } }
  const currencies = new Set<string>()
  for (const inv of invoices) {
    if (!countsAsRevenue(inv) || !inv.issueDate.startsWith(`${year}-`)) continue
    const czk = totalCzk(inv)
    if (czk === undefined) { t.missingRate.count++; currencies.add(inv.currency); continue }
    if (isCzechCountry(inv.customerSnapshot.address.country)) t.domestic += czk
    else t.foreign += czk
  }
  t.missingRate.currencies = [...currencies].sort()
  return t
}

export type VatThresholdLevel = 'ok' | 'near' | 'over' | 'overImmediate'

export const vatThresholdLevel = (domestic: number): VatThresholdLevel =>
  domestic > VAT_LIMIT_IMMEDIATE ? 'overImmediate'
  : domestic > VAT_LIMIT ? 'over'
  : domestic >= VAT_LIMIT * VAT_NEAR ? 'near'
  : 'ok'
