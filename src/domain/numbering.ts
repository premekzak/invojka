/** Pattern tokens: {YYYY}, {YY}, {N…} (zero-padded sequence, width = number of N's). */
export const DEFAULT_PATTERN = '{YYYY}{NNNN}'

const escapeRe = (s: string) => s.replace(/[.*+?^$()|[\]\\]/g, '\\$&')

function toRegex(pattern: string, year: number): RegExp {
  const src = escapeRe(pattern)
    .replace('{YYYY}', String(year))
    .replace('{YY}', String(year).slice(-2))
    .replace(/\{(N+)\}/, (_, n: string) => `(\\d{${n.length},})`)
  return new RegExp(`^${src}$`)
}

export function formatNumber(pattern: string, year: number, seq: number): string {
  return pattern
    .replace('{YYYY}', String(year))
    .replace('{YY}', String(year).slice(-2))
    .replace(/\{(N+)\}/, (_, n: string) => String(seq).padStart(n.length, '0'))
}

export function nextNumber(pattern: string, year: number, existing: string[]): string {
  const re = toRegex(pattern, year)
  let max = 0
  for (const n of existing) {
    const m = re.exec(n)
    if (m) max = Math.max(max, Number(m[1]))
  }
  return formatNumber(pattern, year, max + 1)
}
