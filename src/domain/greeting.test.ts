import { expect, it } from 'vitest'
import { daySlot, pickDaily, yearTrend } from './greeting'

it('maps hours to day slots', () => {
  expect([4, 5, 9, 12, 14, 18, 22, 0].map(daySlot)).toEqual(['night', 'dawn', 'morning', 'noon', 'afternoon', 'evening', 'night', 'night'])
})

it('picks the same greeting all day and varies across days', () => {
  const opts = ['a', 'b', 'c', 'd']
  expect(pickDaily(opts, '2026-09-30', 'morning')).toBe(pickDaily(opts, '2026-09-30', 'morning'))
  const week = ['01', '02', '03', '04', '05', '06', '07'].map((d) => pickDaily(opts, `2026-10-${d}`, 'morning'))
  expect(new Set(week).size).toBeGreaterThan(1)
})

it('compares revenue with the same period last year', () => {
  expect(yearTrend(164_500, 59_500)).toEqual({ trend: 'up', pct: 176 })
  expect(yearTrend(50, 100)).toEqual({ trend: 'down', pct: 50 })
  expect(yearTrend(100, 100)).toEqual({ trend: 'same', pct: 0 })
  expect(yearTrend(100, 0)).toEqual({ trend: 'none', pct: 0 })
})
