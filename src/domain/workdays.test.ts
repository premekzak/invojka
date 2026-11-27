import { describe, expect, it } from 'vitest'
import { dayOff, easterSunday, isCzechHoliday, nextWorkday } from './workdays'

describe('workdays', () => {
  it('finds Easter Sunday', () => {
    expect(easterSunday(2025)).toBe('2025-04-20')
    expect(easterSunday(2026)).toBe('2026-04-05')
    expect(easterSunday(2027)).toBe('2027-03-28')
  })
  it('knows the Czech holidays, fixed and around Easter', () => {
    expect(isCzechHoliday('2026-04-03')).toBe(true) // Good Friday
    expect(isCzechHoliday('2026-04-06')).toBe(true) // Easter Monday
    expect(isCzechHoliday('2026-09-28')).toBe(true)
    expect(isCzechHoliday('2026-11-17')).toBe(true)
    expect(isCzechHoliday('2026-11-18')).toBe(false)
  })
  it('says why a date is not a working day', () => {
    expect(dayOff('2026-12-12')).toBe('saturday')
    expect(dayOff('2026-12-13')).toBe('sunday')
    expect(dayOff('2026-12-25')).toBe('holiday')
    expect(dayOff('2026-12-11')).toBeUndefined()
    expect(dayOff('')).toBeUndefined()
  })
  it('moves to the next working day, over a weekend and holidays', () => {
    expect(nextWorkday('2026-12-11')).toBe('2026-12-11')
    expect(nextWorkday('2026-12-12')).toBe('2026-12-14')
    expect(nextWorkday('2026-12-24')).toBe('2026-12-28') // Thu 24, Fri 25 holidays, then the weekend
    expect(nextWorkday('2026-04-03')).toBe('2026-04-07') // Good Friday to the Tuesday after Easter Monday
  })
})
