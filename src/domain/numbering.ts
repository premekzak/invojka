/**
 * Pattern tokens: {YYYY}, {YY}, {MM}, {N…} (zero-padded sequence, width = number of N's).
 * The sequence restarts every year, or every month when the pattern contains {MM}.
 */
export const DEFAULT_PATTERN = '{YYYY}{NNNN}'

const escapeRe = (s: string) => s.replace(/[.*+?^$()|[\]\\]/g, '\\$&')

/** Fills the date tokens for the period of `isoDate` (yyyy-mm-dd). */
function fillDate(pattern: string, isoDate: string): string {
  const [year, month] = isoDate.split('-')
  return pattern.replace('{YYYY}', year).replace('{YY}', year.slice(-2)).replace('{MM}', month)
}

function toRegex(pattern: string, isoDate: string): RegExp {
  // The braces of the sequence token survive escaping, so it is still found after the dates are filled in.
  const src = escapeRe(fillDate(pattern, isoDate)).replace(/\{(N+)\}/, (_, n: string) => `(\\d{${n.length},})`)
  return new RegExp(`^${src}$`)
}

export function formatNumber(pattern: string, isoDate: string, seq: number): string {
  return fillDate(pattern, isoDate).replace(/\{(N+)\}/, (_, n: string) => String(seq).padStart(n.length, '0'))
}

/** The next free number for an invoice issued on `isoDate`: the highest number of the same period, plus one. */
export function nextNumber(pattern: string, isoDate: string, existing: string[]): string {
  const re = toRegex(pattern, isoDate)
  let max = 0
  for (const n of existing) {
    const m = re.exec(n)
    if (m) max = Math.max(max, Number(m[1]))
  }
  return formatNumber(pattern, isoDate, max + 1)
}

/** The sequence part of `number` if it follows `pattern` for the period of `isoDate`, else undefined. */
export function sequenceOf(pattern: string, isoDate: string, number: string): number | undefined {
  const m = toRegex(pattern, isoDate).exec(number)
  return m ? Number(m[1]) : undefined
}

/** The numbering period of `isoDate`: a month when the pattern contains {MM}, otherwise a year. */
export const periodOf = (pattern: string, isoDate: string) => (pattern.includes('{MM}') ? isoDate.slice(0, 7) : isoDate.slice(0, 4))
