import { describe, expect, it } from 'vitest'
import { newInvoice } from './invoice'
import { SCHEMA_VERSION, Settings, type Invoice } from './schema'
import { cashIncome, estimate, flatTaxBand, projectYear, RATES } from './taxes'

const r = RATES[2026]!

describe('sole trader estimate', () => {
  it('pays the yearly minimums and no income tax on a small income', () => {
    const e = estimate(300_000, 60, r)
    expect(e).toMatchObject({ expenses: 180_000, profit: 120_000, tax: 0 })
    // Minimum bases: 12 × 17 139 Kč (social), 12 × 24 483,50 Kč (health).
    expect(e.social).toBe(Math.ceil(205_668 * 0.292)) // 60 056 Kč, 5 005 Kč a month
    expect(e.health).toBe(Math.ceil(293_802 * 0.135)) // 39 664 Kč, 3 306 Kč a month
  })

  it('works out a typical 60 % trade: 1 000 000 Kč income', () => {
    const e = estimate(1_000_000, 60, r)
    expect(e).toMatchObject({ expenses: 600_000, profit: 400_000 })
    expect(e.tax).toBe(400_000 * 0.15 - 30_840) // 29 160
    expect(e.social).toBe(Math.ceil(220_000 * 0.292)) // 55 % of the profit is above the minimum
    expect(e.health).toBe(Math.ceil(293_802 * 0.135)) // 50 % of the profit (200 000) is below the minimum
    expect(e.total).toBe(e.tax + e.social + e.health)
  })

  it('caps flat-rate expenses at 2 million of income, taxes above the limit at 23 % and caps social insurance', () => {
    const e = estimate(6_000_000, 60, r)
    expect(e.expenses).toBe(1_200_000)
    expect(e.profit).toBe(4_800_000)
    expect(e.tax).toBe(Math.ceil(1_762_812 * 0.15 + (4_800_000 - 1_762_812) * 0.23) - 30_840)
    expect(e.social).toBe(Math.ceil(2_350_416 * 0.292))
  })

  it('works out a secondary activity: no social insurance up to the threshold, no health minimum', () => {
    const secondary = { activity: 'secondary' as const, taxpayerCredit: false }
    const small = estimate(200_000, 60, r, secondary) // profit 80 000 Kč, below 117 521 Kč
    expect(small).toMatchObject({ profit: 80_000, social: 0, health: Math.ceil(40_000 * 0.135), tax: 80_000 * 0.15 })
    const above = estimate(400_000, 60, r, secondary) // profit 160 000 Kč: 55 % is 88 000, above the minimum 12 × 5 387
    expect(above.social).toBe(Math.ceil(88_000 * 0.292))
    const justAbove = estimate(300_000, 60, r, secondary) // profit 120 000 Kč: 55 % is 66 000, above the minimum 64 644
    expect(justAbove.social).toBe(Math.ceil(66_000 * 0.292))
    const atMinimum = estimate(295_000, 60, r, secondary) // profit 118 000 Kč: 55 % is 64 900 > 64 644
    expect(atMinimum.social).toBe(Math.ceil(64_900 * 0.292))
    // With the allowance claimed here (a student, for example) the small one pays no income tax.
    expect(estimate(200_000, 60, r, { activity: 'secondary', taxpayerCredit: true }).tax).toBe(0)
  })

  it('finds the flat-tax band by income and expense rate', () => {
    expect(flatTaxBand(900_000, 40)).toBe(1)
    expect(flatTaxBand(1_200_000, 40)).toBe(2)
    expect(flatTaxBand(1_200_000, 60)).toBe(1)
    expect(flatTaxBand(1_800_000, 60)).toBe(2)
    expect(flatTaxBand(1_800_000, 80)).toBe(1)
    expect(flatTaxBand(1_999_999, 30)).toBe(3)
    expect(flatTaxBand(2_000_001, 80)).toBeUndefined()
  })

  it('projects the year at the pace so far', () => {
    expect(projectYear(100_000, '2026-12-31')).toBe(100_000)
    expect(projectYear(100_000, '2026-07-02')).toBe(Math.round(100_000 * 365 / 183))
  })
})

describe('income as tax records count it', () => {
  const settings = Settings.parse({ schemaVersion: SCHEMA_VERSION, supplier: { name: 'T' }, vatMode: 'nonPayer' })
  const doc = (patch: Partial<Invoice>): Invoice => ({
    ...newInvoice(settings, [], undefined, '2026-01-10'), status: 'paid', paidDate: '2026-02-01',
    lines: [{ description: 'x', quantity: 1, unit: '', unitPrice: 10_000_00, vatRate: 0 }], ...patch,
  })

  it('counts money received in the year, by payment date, in CZK and without VAT', () => {
    const { income, missingRate } = cashIncome([
      doc({}),
      doc({ paidAmount: 4_000_00 }), // partly paid
      doc({ paidDate: '2025-12-30' }), // last year
      doc({ status: 'issued', paidDate: undefined }), // not paid
      doc({ currency: 'EUR', exchangeRate: 25, lines: [{ description: 'x', quantity: 1, unit: '', unitPrice: 100_00, vatRate: 0 }] }),
      doc({ currency: 'NZD' }), // no rate
      doc({ kind: 'proforma' }), // an advance is income when it comes in
      doc({ kind: 'invoice', advanceId: 'p', advanceAmount: 10_000_00, paidAmount: 0 }), // its final invoice adds nothing more
      doc({ kind: 'advanceTaxDoc' }), // repeats the proforma
      doc({ kind: 'creditNote', paidAmount: -1_000_00, lines: [{ description: 'x', quantity: 1, unit: '', unitPrice: -1_000_00, vatRate: 0 }] }),
      doc({ vatMode: 'payer', lines: [{ description: 'x', quantity: 1, unit: '', unitPrice: 10_000_00, vatRate: 21 }], paidAmount: 12_100_00 }),
    ], 2026)
    expect(income).toBe(10_000 + 4_000 + 2_500 + 10_000 - 1_000 + 10_000)
    expect(missingRate).toBe(1)
  })
})
