import { describe, expect, it } from 'vitest'
import { fillRates, missingRateRequests, parseCnbYear, rateOn } from './fx'
import type { Invoice } from './schema'

// Excerpt in the real rok.txt format (values from the 2016 file).
const CNB = `Datum|1 AUD|100 HUF|1 NZD
10.03.2016|18,012|8,701|16,610
11.03.2016|17,950|8,695|16,322
14.03.2016|18,100|8,690|16,307
`

describe('ČNB yearly file', () => {
  const t = parseCnbYear(CNB)
  it('parses dates, decimal commas and per-100 amounts', () => {
    expect(t.get('NZD')).toEqual([['2016-03-10', 16.61], ['2016-03-11', 16.322], ['2016-03-14', 16.307]])
    expect(t.get('HUF')![0][1]).toBeCloseTo(0.08701)
  })
  it('uses the previous business day on weekends', () => {
    expect(rateOn(t, 'NZD', '2016-03-13')).toBe(16.322) // Sunday → Friday
    expect(rateOn(t, 'NZD', '2016-03-14')).toBe(16.307)
    expect(rateOn(t, 'NZD', '2016-03-01')).toBeUndefined()
    expect(rateOn(t, 'USD', '2016-03-14')).toBeUndefined()
  })
})

const inv = (p: Partial<Invoice>) => ({ id: p.number, currency: 'NZD', issueDate: '2016-03-13', status: 'paid', ...p }) as Invoice

it('fills only missing rates and never overwrites', () => {
  const t = parseCnbYear(CNB)
  const res = fillRates([inv({ number: 'a' }), inv({ number: 'b', exchangeRate: 15 }), inv({ number: 'c', currency: 'CZK' })], t, 'cnb')
  expect(res).toHaveLength(1)
  expect(res[0]).toMatchObject({ number: 'a', exchangeRate: 16.322, exchangeRateSource: 'cnb' })
})

it('groups the needed downloads by currency and year', () => {
  expect(missingRateRequests([inv({ number: 'a' }), inv({ number: 'b', issueDate: '2016-05-01' }), inv({ number: 'c', issueDate: '2017-01-05', currency: 'EUR' })]))
    .toEqual([{ currency: 'EUR', year: 2017 }, { currency: 'NZD', year: 2016 }])
})
