import { LOCALES, type InvoiceLang } from './language'

// Money is always an integer number of minor units (haléře, cents).
export type Minor = number

export const CURRENCIES = ['CZK', 'EUR', 'USD', 'GBP', 'NZD'] as const
export type Currency = (typeof CURRENCIES)[number]

export function toMinor(major: number | string): Minor {
  const n = typeof major === 'string' ? Number(major.replace(/\s/g, '').replace(',', '.')) : major
  if (!Number.isFinite(n)) throw new Error(`Invalid amount: ${major}`)
  return Math.round(n * 100)
}

export const toMajor = (m: Minor) => m / 100

export function formatMoney(m: Minor, currency: string, locale: InvoiceLang = 'cs', whole = false): string {
  return new Intl.NumberFormat(LOCALES[locale], {
    style: 'currency', currency, ...(whole && { maximumFractionDigits: 0, minimumFractionDigits: 0 }),
  }).format(toMajor(m) || 0) // `|| 0`: a −0 would print as "-0,00 Kč"
}

/**
 * Multiply a minor amount by a (possibly fractional) factor, rounding half away from zero. The factor is taken as the
 * decimal it is written as (35.23, 0.21, 24.335), and the product is computed in integers: in floating point
 * 450 × 35.23 is 15853.4999…, which would round down a haléř that is exactly half.
 */
export function mulRound(m: Minor, factor: number): Minor {
  const s = String(Math.abs(factor))
  if (!Number.isInteger(m) || s.includes('e')) {
    const v = m * factor
    return Math.sign(v) * Math.round(Math.abs(v)) || 0 // never −0, which prints with a minus sign
  }
  const dot = s.indexOf('.')
  const digits = dot < 0 ? s : s.slice(0, dot) + s.slice(dot + 1)
  const scale = dot < 0 ? 0 : s.length - dot - 1
  const sign = Math.sign(m) * Math.sign(factor)
  const n = Math.abs(m) * Number(digits)
  if (Number.isSafeInteger(n) && scale <= 15) {
    const d = 10 ** scale
    let q = Math.floor(n / d), r = n - q * d
    if (r < 0) { q--; r += d }
    return sign * (2 * r >= d ? q + 1 : q) || 0
  }
  const d = 10n ** BigInt(scale)
  const big = BigInt(Math.abs(m)) * BigInt(digits)
  return sign * Number((big * 2n + d) / (2n * d)) || 0
}
