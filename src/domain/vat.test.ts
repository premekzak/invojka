import { describe, expect, it } from 'vitest'
import { computeTotals } from './vat'

const l = (unitPrice: number, quantity = 1, vatRate = 21) => ({ unitPrice, quantity, vatRate })

describe('computeTotals', () => {
  it('ignores VAT for non-payers', () => {
    const t = computeTotals([l(1450000, 1, 21)], 'nonPayer')
    expect(t).toMatchObject({ base: 1450000, vat: 0, total: 1450000 })
    expect(t.byRate).toEqual([{ rate: 0, base: 1450000, vat: 0, total: 1450000 }])
  })
  it('groups by rate and rounds per rate', () => {
    const t = computeTotals([l(333, 3, 21), l(1000, 1, 12), l(1, 1, 21)], 'payer')
    expect(t.byRate).toEqual([
      { rate: 21, base: 1000, vat: 210, total: 1210 },
      { rate: 12, base: 1000, vat: 120, total: 1120 },
    ])
    expect(t.total).toBe(2330)
  })
  it('handles fractional quantities', () => {
    expect(computeTotals([l(125050, 1.5, 21)], 'payer').base).toBe(187575)
  })
  it('zeroes VAT under reverse charge', () => {
    expect(computeTotals([l(10000, 1, 21)], 'payer', true).vat).toBe(0)
  })
})
