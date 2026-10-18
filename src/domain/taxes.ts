import { invoiceTotals } from './invoice'
import type { Invoice } from './schema'
import { chargesVat } from './vat'

/**
 * An estimate of a Czech sole trader's (OSVČ) income tax and social and health insurance from the money received,
 * with flat-rate expenses, compared with the flat-rate tax (paušální daň), for a main or a secondary activity. An
 * estimate only: no other income, real expenses or allowances beyond the basic one. Sources and dates in
 * docs/czech-rules.md#sole-traders-taxes-and-insurance; add each new year to RATES.
 */

/** Flat-rate expenses (výdajový paušál) by the kind of activity: crafts 80 %, other trades 60 %, other 40 %, rent 30 %. */
export const EXPENSE_RATES = [80, 60, 40, 30] as const
export type ExpenseRate = (typeof EXPENSE_RATES)[number]

/**
 * Main activity (hlavní): the sole trader's own job, with minimum insurance. Secondary (vedlejší): alongside a job,
 * studies, a pension or parental leave; no social insurance up to the threshold and no health minimum.
 */
export type Activity = 'main' | 'secondary'

export interface YearRates {
  /** Average monthly wage the year's limits are derived from (Kč). */
  averageWage: number
  /** Minimum monthly assessment bases for the main activity (Kč). */
  socialMinMonthly: number
  healthMinMonthly: number
  /** Secondary activity: the minimum monthly social base, and the yearly profit up to which no social insurance is due. */
  socialMinMonthlySecondary: number
  secondaryThreshold: number
  /** Yearly social insurance ceiling (48 × the average wage, Kč). */
  socialMaxYearly: number
  /** Income tax: 15 %, 23 % above this yearly base (36 × the average wage, Kč). */
  higherTaxFrom: number
  /** Basic personal allowance (sleva na poplatníka, Kč a year). */
  taxpayerCredit: number
  /** Flat-rate tax per month for bands 1, 2, 3 (Kč). */
  flatTaxMonthly: [number, number, number]
}

/** Per year; values checked 2026-10-18 (see docs/czech-rules.md). */
export const RATES: Record<number, YearRates> = {
  2025: {
    averageWage: 46_557, socialMinMonthly: 16_295, healthMinMonthly: 23_278.5, socialMaxYearly: 2_234_736,
    socialMinMonthlySecondary: 5_122, secondaryThreshold: 111_736,
    higherTaxFrom: 1_676_052, taxpayerCredit: 30_840, flatTaxMonthly: [8_716, 16_745, 27_139],
  },
  // The minimum social base went back from 40 % to 35 % of the average wage with retroactive effect from 1 January 2026
  // (a June 2026 amendment), which also lowered flat-tax band 1 from 9 984 to 9 162 Kč for the whole year.
  2026: {
    averageWage: 48_967, socialMinMonthly: 17_139, healthMinMonthly: 24_483.5, socialMaxYearly: 2_350_416,
    socialMinMonthlySecondary: 5_387, secondaryThreshold: 117_521,
    higherTaxFrom: 1_762_812, taxpayerCredit: 30_840, flatTaxMonthly: [9_162, 16_745, 27_139],
  },
}

export const SOCIAL_RATE = 0.292
export const HEALTH_RATE = 0.135
/** The share of profit that is the assessment base: 55 % for social insurance (since 2024), 50 % for health. */
export const SOCIAL_SHARE = 0.55
export const HEALTH_SHARE = 0.5
/** Flat-rate expenses count from at most 2 million Kč of income. */
export const FLAT_EXPENSE_INCOME_CAP = 2_000_000

/**
 * Income of the year as tax records count it: money received, by the day it came in. Paid invoices and proformas
 * (an advance is income when received), less refunded credit notes; a payer's VAT isn't income. Tax documents for
 * payments are left out: they repeat their proforma. Kč, plus documents that couldn't be converted.
 */
export function cashIncome(invoices: Invoice[], year: number): { income: number; missingRate: number } {
  let income = 0, missingRate = 0
  for (const inv of invoices) {
    if (inv.status !== 'paid' || !inv.paidDate?.startsWith(`${year}-`) || inv.kind === 'advanceTaxDoc') continue
    const totals = invoiceTotals(inv)
    let paid = inv.paidAmount ?? totals.total - (inv.advanceAmount ?? 0)
    if (chargesVat(inv.vatMode, inv.reverseCharge) && totals.total) paid = (paid * totals.base) / totals.total
    const rate = inv.currency === 'CZK' ? 1 : inv.exchangeRate
    if (!rate) { missingRate++; continue }
    income += (paid * rate) / 100
  }
  return { income: Math.round(income), missingRate }
}

export interface Estimate {
  income: number
  expenses: number
  profit: number
  tax: number
  social: number
  health: number
  total: number
}

// Rounds up whole crowns; the tiny offset keeps float noise from adding a crown, and `|| 0` turns -0 into 0.
const ceil = (n: number) => Math.ceil(n - 1e-9) || 0

export interface EstimateOptions {
  activity: Activity
  /** Whether the basic personal allowance is claimed here; with a secondary activity it's usually claimed at work. */
  taxpayerCredit: boolean
}

/** Tax and insurance for a year's income with flat-rate expenses (all Kč, whole crowns). */
export function estimate(income: number, expenseRate: ExpenseRate, r: YearRates,
  { activity, taxpayerCredit }: EstimateOptions = { activity: 'main', taxpayerCredit: true }): Estimate {
  const expenses = Math.round(Math.min(income, FLAT_EXPENSE_INCOME_CAP) * expenseRate / 100)
  const profit = Math.max(0, income - expenses)
  // Income tax: the base rounded down to whole hundreds, 15 % and 23 % above the limit, less the basic allowance.
  const base = Math.floor(profit / 100) * 100
  const tax = Math.max(0, ceil(Math.min(base, r.higherTaxFrom) * 0.15 + Math.max(0, base - r.higherTaxFrom) * 0.23) - (taxpayerCredit ? r.taxpayerCredit : 0))
  // Insurance: a share of the profit, at least the yearly minimum, social at most its ceiling. A secondary activity pays
  // no social insurance up to the threshold, a lower minimum above it, and no health minimum.
  const main = activity === 'main'
  const socialDue = main || profit > r.secondaryThreshold
  const socialMin = 12 * (main ? r.socialMinMonthly : r.socialMinMonthlySecondary)
  const socialBase = socialDue ? Math.min(Math.max(ceil(profit * SOCIAL_SHARE), socialMin), r.socialMaxYearly) : 0
  const healthBase = Math.max(ceil(profit * HEALTH_SHARE), main ? ceil(12 * r.healthMinMonthly) : 0)
  const social = ceil(socialBase * SOCIAL_RATE)
  const health = ceil(healthBase * HEALTH_RATE)
  return { income, expenses, profit, tax, social, health, total: tax + social + health }
}

/**
 * The flat-tax band this income would fall into (1–3), assuming all income comes from activities of one expense rate,
 * or undefined above 2 million Kč, where the regime isn't open.
 */
export function flatTaxBand(income: number, expenseRate: ExpenseRate): 1 | 2 | 3 | undefined {
  const limits: [number, number, number] = expenseRate === 80 ? [2_000_000, 2_000_000, 2_000_000]
    : expenseRate === 60 ? [1_500_000, 2_000_000, 2_000_000]
    : [1_000_000, 1_500_000, 2_000_000]
  const band = limits.findIndex((l) => income <= l)
  return band < 0 ? undefined : ((band + 1) as 1 | 2 | 3)
}

/** The whole year's income if it goes on at this year's pace so far (`on` is yyyy-mm-dd within `year`). */
export function projectYear(incomeSoFar: number, on: string): number {
  const year = Number(on.slice(0, 4))
  const start = Date.UTC(year, 0, 1)
  const days = (Date.UTC(year + 1, 0, 1) - start) / 864e5
  const elapsed = Math.max(1, (Date.parse(`${on}T00:00:00Z`) - start) / 864e5 + 1)
  return Math.round((incomeSoFar * days) / elapsed)
}
