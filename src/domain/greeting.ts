/** Time-of-day slots for the Home greeting. */
export type DaySlot = 'dawn' | 'morning' | 'noon' | 'afternoon' | 'evening' | 'night'

export function daySlot(hour: number): DaySlot {
  if (hour >= 5 && hour < 9) return 'dawn'
  if (hour >= 9 && hour < 12) return 'morning'
  if (hour >= 12 && hour < 14) return 'noon'
  if (hour >= 14 && hour < 18) return 'afternoon'
  if (hour >= 18 && hour < 22) return 'evening'
  return 'night'
}

/** Picks one option per day and slot: stable while you work, different tomorrow. */
export function pickDaily<T>(options: readonly T[], date: string, slot: DaySlot): T {
  let h = 0
  for (const ch of date + slot) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return options[h % options.length]!
}

export type Trend = 'up' | 'down' | 'same' | 'none'

/** Year-to-date change against the same period last year, rounded to whole percent. */
export function yearTrend(revenue: number, revenueLast: number): { trend: Trend; pct: number } {
  if (revenueLast <= 0) return { trend: 'none', pct: 0 }
  const pct = Math.round((revenue / revenueLast - 1) * 100)
  return { trend: pct > 0 ? 'up' : pct < 0 ? 'down' : 'same', pct: Math.abs(pct) }
}
