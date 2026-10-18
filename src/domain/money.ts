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
  }).format(toMajor(m))
}

/** Multiply a minor amount by a (possibly fractional) factor, rounding half away from zero. */
export function mulRound(m: Minor, factor: number): Minor {
  const v = m * factor
  return Math.sign(v) * Math.round(Math.abs(v))
}
