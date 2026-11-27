// Czech working days: weekends and the public holidays of zákon č. 245/2000 Sb. (docs/czech-rules.md).

/** Holidays on the same date every year, as MM-DD. */
const FIXED = ['01-01', '05-01', '05-08', '07-05', '07-06', '09-28', '10-28', '11-17', '12-24', '12-25', '12-26']

const utc = (iso: string) => new Date(`${iso}T00:00:00Z`)
const iso = (d: Date) => d.toISOString().slice(0, 10)
const plus = (isoDate: string, days: number) => iso(new Date(utc(isoDate).getTime() + days * 864e5))

/** Easter Sunday of a year in the Gregorian calendar (the anonymous "Meeus/Jones/Butcher" computus). */
export function easterSunday(year: number): string {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4), k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/** A Czech public holiday: the fixed dates, Good Friday and Easter Monday. */
export function isCzechHoliday(isoDate: string): boolean {
  if (FIXED.includes(isoDate.slice(5))) return true
  const easter = easterSunday(Number(isoDate.slice(0, 4)))
  return isoDate === plus(easter, -2) || isoDate === plus(easter, 1)
}

export type DayOff = 'saturday' | 'sunday' | 'holiday'

/** Why a date isn't a working day, or undefined when it is one. A holiday on a weekend is reported as the weekend day. */
export function dayOff(isoDate: string): DayOff | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate) || Number.isNaN(utc(isoDate).getTime())) return undefined
  const day = utc(isoDate).getUTCDay()
  return day === 6 ? 'saturday' : day === 0 ? 'sunday' : isCzechHoliday(isoDate) ? 'holiday' : undefined
}

/** The date itself when it is a working day, otherwise the first working day after it. */
export function nextWorkday(isoDate: string): string {
  let d = isoDate
  while (dayOff(d)) d = plus(d, 1)
  return d
}
