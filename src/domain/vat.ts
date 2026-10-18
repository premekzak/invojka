import { mulRound, type Minor } from './money'

export type VatMode = 'payer' | 'nonPayer' | 'identifiedPerson'
export const VAT_RATES = [21, 12, 0] as const

export interface LineInput { quantity: number; unitPrice: Minor; vatRate: number }
export interface RateSummary { rate: number; base: Minor; vat: Minor; total: Minor }
export interface Totals { base: Minor; vat: Minor; total: Minor; byRate: RateSummary[] }

export const lineBase = (l: LineInput): Minor => mulRound(l.unitPrice, l.quantity)

/** Whether VAT is charged on this invoice at all. */
export const chargesVat = (mode: VatMode, reverseCharge: boolean) => mode === 'payer' && !reverseCharge

/**
 * Prices are net (without VAT). VAT is computed per rate from the summed base
 * (the way Czech accounting software does it), rounded to whole minor units.
 */
export function computeTotals(lines: LineInput[], mode: VatMode, reverseCharge = false): Totals {
  const vatOn = chargesVat(mode, reverseCharge)
  const groups = new Map<number, Minor>()
  for (const l of lines) {
    const rate = vatOn ? l.vatRate : 0
    groups.set(rate, (groups.get(rate) ?? 0) + lineBase(l))
  }
  const byRate = [...groups.entries()]
    .sort(([a], [b]) => b - a)
    .map(([rate, base]) => {
      const vat = mulRound(base, rate / 100)
      return { rate, base, vat, total: base + vat }
    })
  const base = byRate.reduce((s, r) => s + r.base, 0)
  const vat = byRate.reduce((s, r) => s + r.vat, 0)
  return { base, vat, total: base + vat, byRate }
}

/**
 * The net base whose VAT at `rate` brings it to exactly `gross` (an advance received with VAT included). The VAT act
 * computes it as gross − gross / 1.21; the base is rounded, then nudged by a haléř if the computed VAT doesn't add up.
 */
export function netFromGross(gross: Minor, rate: number): Minor {
  const guess = Math.round(gross / (1 + rate / 100))
  for (const base of [guess, guess - 1, guess + 1]) if (base + mulRound(base, rate / 100) === gross) return base
  return guess
}
