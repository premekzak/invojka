import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { importCsv } from '@/import/csv'
import { monthlyRevenue, yearlyRevenue } from './stats'

const read = (f: string) => readFileSync(new URL(`../../${f}`, import.meta.url), 'utf8')
const { invoices } = importCsv(read('customers.csv'), read('invoices.csv'), 'nonPayer')

describe('revenue stats on the real data', () => {
  it('sums CZK months and reports foreign invoices without a rate', () => {
    const m = monthlyRevenue(invoices, 2026)
    expect(m.values).toHaveLength(12)
    // September 2026: only 20260008 (14 500 Kč, issued 6 Sep).
    expect(m.values[8]).toBe(1450000)
    expect(m.values.slice(9)).toEqual([0, 0, 0])
  })

  it('covers every year and matches the CSV totals', () => {
    const y = yearlyRevenue(invoices, 2026)
    expect(y.years[0]).toBe(2014)
    expect(y.years.at(-1)).toBe(2026)
    const czkTotal = invoices.filter((i) => i.currency === 'CZK').reduce((s, i) => s + i.recordedTotal!, 0)
    expect(y.values.reduce((a, b) => a + b, 0)).toBe(czkTotal)
    expect(y.missingRate.count).toBe(70)
    expect(y.missingRate.currencies).toEqual(['EUR', 'NZD'])
  })

  it('counts converted foreign invoices', () => {
    const nzd = invoices.find((i) => i.currency === 'NZD')!
    const y = Number(nzd.issueDate.slice(0, 4))
    const withRate = invoices.map((i) => (i.id === nzd.id ? { ...i, exchangeRate: 13.5 } : i))
    const before = yearlyRevenue(invoices, 2026)
    const after = yearlyRevenue(withRate, 2026)
    const idx = before.years.indexOf(y)
    expect(after.values[idx] - before.values[idx]).toBe(Math.round(nzd.recordedTotal! * 13.5))
    expect(after.missingRate.count).toBe(69)
  })
})
