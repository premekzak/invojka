import { invoiceTotals } from './invoice'
import type { Invoice, Settings } from './schema'
import { chargesVat } from './vat'

/**
 * An estimate of a Czech sole trader's (OSVČ) income tax and social and health insurance from the money received.
 * Two regimes: an ordinary tax return with flat-rate expenses (výdajový paušál), for a main or a secondary activity,
 * or the flat-rate tax (paušální daň), one fixed monthly payment by band that doesn't depend on profit. An
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

/**
 * How the sole trader is taxed: a tax return with flat-rate expenses, the flat-rate tax regime, tax records with real
 * expenses (daňová evidence) or accounts (účetnictví). Invojka doesn't know the expenses, and accounts count revenue and
 * costs when they arise, not when paid, so those two get no estimate at all rather than a wrong one.
 */
export type TaxRegime = 'standard' | 'flat' | 'records' | 'accounts'
export const TAX_REGIMES: TaxRegime[] = ['standard', 'flat', 'records', 'accounts']

/** Whether Invojka can estimate tax and insurance for this regime. */
export function canEstimate(regime: TaxRegime): boolean {
  return regime === 'standard' || regime === 'flat'
}
export type FlatBand = 1 | 2 | 3

/** One month of the flat-rate tax, split as Finanční správa publishes it (Kč). */
export interface FlatTaxSplit { tax: number; social: number; health: number }

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
  flatTax: [FlatTaxSplit, FlatTaxSplit, FlatTaxSplit]
}

/** Per year; values checked 2026-10-18 (see docs/czech-rules.md). */
export const RATES: Record<number, YearRates> = {
  2025: {
    averageWage: 46_557, socialMinMonthly: 16_295, healthMinMonthly: 23_278.5, socialMaxYearly: 2_234_736,
    socialMinMonthlySecondary: 5_122, secondaryThreshold: 111_736,
    higherTaxFrom: 1_676_052, taxpayerCredit: 30_840,
    flatTax: [{ tax: 100, social: 5_473, health: 3_143 }, { tax: 4_963, social: 8_191, health: 3_591 }, { tax: 9_320, social: 12_527, health: 5_292 }],
  },
  // The minimum social base went back from 40 % to 35 % of the average wage with retroactive effect from 1 January 2026
  // (a June 2026 amendment), which also lowered flat-tax band 1 from 9 984 to 9 162 Kč for the whole year.
  2026: {
    averageWage: 48_967, socialMinMonthly: 17_139, healthMinMonthly: 24_483.5, socialMaxYearly: 2_350_416,
    socialMinMonthlySecondary: 5_387, secondaryThreshold: 117_521,
    higherTaxFrom: 1_762_812, taxpayerCredit: 30_840,
    flatTax: [{ tax: 100, social: 5_756, health: 3_306 }, { tax: 4_963, social: 8_191, health: 3_591 }, { tax: 9_320, social: 12_527, health: 5_292 }],
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
 * payments are left out: they repeat their proforma. Plus the income received before Invojka (`opening`) in its year.
 * Kč, plus documents that couldn't be converted.
 */
export function cashIncome(invoices: Invoice[], year: number, opening?: Settings['opening']): { income: number; missingRate: number } {
  let income = opening?.year === year ? opening.income / 100 : 0, missingRate = 0
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

/** The flat-rate tax for a band per month, in total (Kč). */
export function flatTaxMonthly(r: YearRates, band: FlatBand): number {
  const { tax, social, health } = r.flatTax[band - 1]!
  return tax + social + health
}

/**
 * The yearly income limits of bands 1–3, assuming at least 75 % of income comes from activities of this expense rate:
 * 1 M / 1.5 M / 2 M Kč, raised to 1.5 M / 2 M for 80 % and 60 % activities and to 2 M for band 1 with 80 % ones.
 */
export function flatBandLimits(expenseRate: ExpenseRate): [number, number, number] {
  return expenseRate === 80 ? [2_000_000, 2_000_000, 2_000_000]
    : expenseRate === 60 ? [1_500_000, 2_000_000, 2_000_000]
    : [1_000_000, 1_500_000, 2_000_000]
}

/**
 * The lowest flat-tax band this income fits (1–3), assuming all income comes from activities of one expense rate,
 * or undefined above 2 million Kč, where the regime isn't open.
 */
export function flatTaxBand(income: number, expenseRate: ExpenseRate): FlatBand | undefined {
  const band = flatBandLimits(expenseRate).findIndex((l) => income <= l)
  return band < 0 ? undefined : ((band + 1) as FlatBand)
}

/**
 * Whether a year's income fits the band the sole trader pays. The band is chosen by last year's income; this year's
 * income decides what happens next: over the band's limit they file "Oznámení o jiné výši paušální daně" for a higher
 * band by 10 January and pay the difference, or leave the regime; over 2 M Kč the regime ends and they file a tax return;
 * under a lower band's limit the same notice can get the overpayment back.
 */
export type FlatBandCheck =
  | { state: 'ok' }
  | { state: 'higher' | 'lower'; band: FlatBand; diff: number }
  | { state: 'out' }

export function checkFlatBand(income: number, band: FlatBand, expenseRate: ExpenseRate, r: YearRates): FlatBandCheck {
  const fits = flatTaxBand(income, expenseRate)
  if (!fits) return { state: 'out' }
  if (fits === band) return { state: 'ok' }
  const diff = Math.abs(flatTaxMonthly(r, fits) - flatTaxMonthly(r, band)) * 12
  return { state: fits > band ? 'higher' : 'lower', band: fits, diff }
}

/** The whole year's income if it goes on at this year's pace so far (`on` is yyyy-mm-dd within `year`). */
export function projectYear(incomeSoFar: number, on: string): number {
  const year = Number(on.slice(0, 4))
  const start = Date.UTC(year, 0, 1)
  const days = (Date.UTC(year + 1, 0, 1) - start) / 864e5
  const elapsed = Math.max(1, (Date.parse(`${on}T00:00:00Z`) - start) / 864e5 + 1)
  return Math.round((incomeSoFar * days) / elapsed)
}
