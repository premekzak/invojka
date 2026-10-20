import { describe, expect, it } from 'vitest'
import type { Invoice } from './schema'
import { isCzechCountry, VAT_LIMIT, VAT_LIMIT_IMMEDIATE, vatThresholdLevel, vatTurnover } from './vatThreshold'

const inv = (p: { amount: number; date?: string; country?: string; status?: Invoice['status']; currency?: string; rate?: number }): Invoice => ({
  id: Math.random().toString(36), number: '1', variableSymbol: '', orderNumber: '', customerId: null,
  customerSnapshot: { name: 'Zákazník', ic: '', dic: '', address: { street: '', zip: '', city: '', country: p.country ?? '' } },
  issueDate: p.date ?? '2026-03-01', dueDate: '2026-03-15', currency: p.currency ?? 'CZK', exchangeRate: p.rate,
  language: 'cs', paymentMethod: 'bank', kind: 'invoice', correctionReason: '', reminders: [], privateNote: '', tags: [], vatMode: 'nonPayer', reverseCharge: false, note: '', status: p.status ?? 'issued',
  lines: [{ description: 'Práce', quantity: 1, unit: '', unitPrice: p.amount, vatRate: 0 }],
})

describe('VAT registration turnover', () => {
  it('recognises Czech customers, including an empty country', () => {
    for (const c of ['', 'Česká republika', 'Česko', 'Czech Republic', 'Czechia', 'CZ', 'ČR']) expect(isCzechCountry(c)).toBe(true)
    for (const c of ['Slovensko', 'New Zealand', 'Nový Zéland', 'Germany']) expect(isCzechCountry(c)).toBe(false)
  })

  it('counts Czech customers of one year, keeps foreign ones apart and skips drafts and cancelled invoices', () => {
    const t = vatTurnover([
      inv({ amount: 100_000_00 }),
      inv({ amount: 50_000_00, status: 'paid', country: 'Česká republika' }),
      inv({ amount: 30_000_00, country: 'New Zealand', currency: 'NZD', rate: 1 }),
      inv({ amount: 7_000_00, status: 'draft' }),
      inv({ amount: 9_000_00, status: 'cancelled' }),
      inv({ amount: 11_000_00, date: '2025-12-31' }),
      inv({ amount: 5_000_00, currency: 'EUR' }),
    ], 2026)
    expect(t).toEqual({ domestic: 150_000_00, foreign: 30_000_00, missingRate: { count: 1, currencies: ['EUR'] } })
  })

  it('adds the turnover invoiced before Invojka, in its year only', () => {
    const opening = { year: 2026, income: 0, turnover: 80_000_00 }
    expect(vatTurnover([inv({ amount: 100_000_00 })], 2026, opening).domestic).toBe(180_000_00)
    expect(vatTurnover([], 2025, opening).domestic).toBe(0)
  })

  it('warns from 80 % of the limit and tells the two limits apart', () => {
    expect(vatThresholdLevel(VAT_LIMIT * 0.8 - 1)).toBe('ok')
    expect(vatThresholdLevel(VAT_LIMIT * 0.8)).toBe('near')
    expect(vatThresholdLevel(VAT_LIMIT)).toBe('near')
    expect(vatThresholdLevel(VAT_LIMIT + 1)).toBe('over')
    expect(vatThresholdLevel(VAT_LIMIT_IMMEDIATE)).toBe('over')
    expect(vatThresholdLevel(VAT_LIMIT_IMMEDIATE + 1)).toBe('overImmediate')
  })
})
