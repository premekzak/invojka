import type { Customer, Invoice } from './schema'

/**
 * Regular invoicing: a customer billed every month, quarter or year from a given day. Invojka doesn't issue or send
 * anything by itself; Home lists who is due this period, and "Vystavit" starts the usual copy of the last invoice.
 * See docs/invoicing-rules.md#regular-invoices.
 */

export type Every = 'month' | 'quarter' | 'year'
export type RecurringState =
  /** The day has come and nothing is issued for this period yet. */
  | 'due'
  /** A draft for this period exists. */
  | 'draft'
  /** An invoice for this period is issued or paid. */
  | 'done'
  /** Nothing yet, but the day hasn't come. */
  | 'upcoming'

export interface RecurringItem { customer: Customer; state: RecurringState; from: string; invoice?: Invoice; last?: Invoice }

/** The first day of the period `on` falls in, yyyy-mm-dd. */
export function periodStart(every: Every, on: string): string {
  const [y, m] = on.split('-').map(Number) as [number, number]
  const month = every === 'month' ? m : every === 'quarter' ? Math.floor((m - 1) / 3) * 3 + 1 : 1
  return `${y}-${String(month).padStart(2, '0')}-01`
}

/** The first day of the next period. */
function periodEnd(every: Every, start: string): string {
  const [y, m] = start.split('-').map(Number) as [number, number]
  const months = every === 'month' ? 1 : every === 'quarter' ? 3 : 12
  const next = m - 1 + months
  return `${y + Math.floor(next / 12)}-${String((next % 12) + 1).padStart(2, '0')}-01`
}

/** Where each regularly billed customer stands this period, the ones to act on first. */
export function recurringStatus(customers: Customer[], invoices: Invoice[], on: string): RecurringItem[] {
  const order: Record<RecurringState, number> = { due: 0, draft: 1, upcoming: 2, done: 3 }
  return customers
    .filter((c) => c.recurring && !c.archived)
    .map((customer) => {
      const { every, day } = customer.recurring!
      const start = periodStart(every, on)
      const end = periodEnd(every, start)
      const from = `${start.slice(0, 8)}${String(day).padStart(2, '0')}`
      const mine = invoices.filter((i) => i.customerId === customer.id && i.kind === 'invoice' && i.status !== 'cancelled')
      const thisPeriod = mine.filter((i) => i.issueDate >= start && i.issueDate < end)
      const issued = thisPeriod.find((i) => i.status !== 'draft')
      const draft = thisPeriod.find((i) => i.status === 'draft')
      const last = mine.filter((i) => i.status !== 'draft').sort((a, b) => b.issueDate.localeCompare(a.issueDate))[0]
      const state: RecurringState = issued ? 'done' : draft ? 'draft' : on >= from ? 'due' : 'upcoming'
      return { customer, state, from, invoice: issued ?? draft, last }
    })
    .sort((a, b) => order[a.state] - order[b.state] || a.from.localeCompare(b.from) || a.customer.name.localeCompare(b.customer.name))
}

// ---------------------------------------------------------------------------------------------------- months in text

const CS_NOMINATIVE = ['leden', 'únor', 'březen', 'duben', 'květen', 'červen', 'červenec', 'srpen', 'září', 'říjen', 'listopad', 'prosinec']
const CS_GENITIVE = ['ledna', 'února', 'března', 'dubna', 'května', 'června', 'července', 'srpna', 'září', 'října', 'listopadu', 'prosince']
const EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

/** Whole calendar months from one date to another (yyyy-mm-dd). */
export const monthsBetween = (from: string, to: string) =>
  (Number(to.slice(0, 4)) - Number(from.slice(0, 4))) * 12 + Number(to.slice(5, 7)) - Number(from.slice(5, 7))

const keepCase = (like: string, word: string) => (like[0] === like[0]!.toUpperCase() ? word[0]!.toUpperCase() + word.slice(1) : word)

/**
 * Moves the months a line names by `shift` months, so a copied "Správa kampaní za srpen 2026" becomes "za září 2026"
 * on next month's invoice. Understands Czech month names (nominative and genitive, with or without a year), English
 * ones, and "8/2026", "08/2026" or "2026-08". A name without a year moves alone; with one, the year rolls over too.
 */
export function shiftMonths(text: string, shift: number): string {
  if (!shift) return text
  const move = (month: number, year?: number) => {
    const n = month + shift
    return { month: ((n % 12) + 12) % 12, year: year === undefined ? undefined : year + Math.floor(n / 12) }
  }
  // Longest names first, so "červenec" isn't read as "červen" + "ec".
  const cs = [...CS_NOMINATIVE.map((w, i) => [w, i, CS_NOMINATIVE] as const), ...CS_GENITIVE.map((w, i) => [w, i, CS_GENITIVE] as const)]
    .sort((a, b) => b[0].length - a[0].length)
  const csRe = new RegExp(`(?<![\\p{L}])(${cs.map(([w]) => w).join('|')})(?![\\p{L}])(\\s+(\\d{4}))?`, 'giu')
  let out = text.replace(csRe, (all, word: string, _y, year?: string) => {
    const found = cs.find(([w]) => w === word.toLowerCase())
    if (!found) return all
    const [, i, list] = found
    const m = move(i, year ? Number(year) : undefined)
    return keepCase(word, list[m.month]!) + (year ? ` ${m.year}` : '')
  })
  out = out.replace(new RegExp(`\\b(${EN.join('|')})\\b(\\s+(\\d{4}))?`, 'g'), (_all, word: string, _y, year?: string) => {
    const m = move(EN.indexOf(word), year ? Number(year) : undefined)
    return EN[m.month]! + (year ? ` ${m.year}` : '')
  })
  out = out.replace(/\b(\d{1,2})\/(\d{4})\b/g, (all, mm: string, yyyy: string) => {
    if (Number(mm) < 1 || Number(mm) > 12) return all
    const m = move(Number(mm) - 1, Number(yyyy))
    // A leading zero stays only where the text had one ("08/2026" → "09/2026", "12/2026" → "1/2027").
    return `${String(m.month + 1).padStart(mm.startsWith('0') ? 2 : 1, '0')}/${m.year}`
  })
  out = out.replace(/\b(\d{4})-(\d{2})\b(?!-\d)/g, (all, yyyy: string, mm: string) => {
    if (Number(mm) < 1 || Number(mm) > 12) return all
    const m = move(Number(mm) - 1, Number(yyyy))
    return `${m.year}-${String(m.month + 1).padStart(2, '0')}`
  })
  return out
}
