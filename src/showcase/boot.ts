import { anonymize, type DemoData } from '@/domain/demo'
import { nextNumber } from '@/domain/numbering'
import { SCHEMA_VERSION, Settings } from '@/domain/schema'
import { computeTotals } from '@/domain/vat'
import { useStore } from '@/state/store'
import { MemoryAdapter } from '@/storage/memory'
import { showcaseHistory } from './history'

/**
 * The showcase build (`npm run build:showcase`, docs/development.md): the app opens straight on made-up data in memory,
 * with no folder to pick. Every change stays in the tab and is gone after a reload.
 */
export async function bootShowcase() {
  const placeholder = Settings.parse({
    schemaVersion: SCHEMA_VERSION, vatMode: 'nonPayer',
    supplier: {
      name: 'x', ic: '12345678', email: 'x@example.com', phone: '1', registration: 'x',
      bank: { account: '1', bankCode: '1', swift: 'x' },
    },
  })
  const today = new Date()
  const data = withThingsToCheck(anonymize({ settings: placeholder, ...showcaseHistory(today) }), isoDate(today))
  const s = useStore.getState()
  await s.open(new MemoryAdapter('faktury'))
  s.saveSettings(data.settings)
  s.replaceAll(data)
  await useStore.getState().flush()
  useStore.getState().setPhase({ kind: 'ready' })
}

const isoDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/**
 * Gives Home's "things to check" table something to show (the owner, 2026-10-18): this year's turnover near the VAT
 * limit, two regular customers not yet billed this month, a paid proforma waiting for its invoice, foreign invoices
 * without a rate and customers without an e-mail. Overdue invoices come from the history already.
 */
export function withThingsToCheck({ settings, customers, invoices }: DemoData, on: string): DemoData {
  const year = on.slice(0, 4), month = on.slice(0, 7)
  const total = (inv: (typeof invoices)[number]) => computeTotals(inv.lines, inv.vatMode, inv.reverseCharge).total

  // About 85 % of the 2 000 000 Kč limit by the end of the year at this pace.
  let out = invoices.map((inv) => {
    if (!inv.issueDate.startsWith(year) || inv.currency !== 'CZK') return inv
    const lines = inv.lines.map((l) => ({ ...l, unitPrice: Math.round((l.unitPrice * 1.7) / 1000) * 1000 }))
    const next = { ...inv, lines }
    return inv.paidAmount === undefined ? next : { ...next, paidAmount: total(next) }
  })

  // The two most recent foreign invoices are still waiting for their rate.
  const foreign = out.filter((i) => i.currency !== 'CZK').sort((a, b) => b.issueDate.localeCompare(a.issueDate)).slice(0, 2).map((i) => i.id)
  out = out.map((i) => (foreign.includes(i.id) ? { ...i, exchangeRate: undefined, exchangeRateSource: undefined } : i))

  // A recently paid proforma, not settled by an invoice yet.
  const czech = (id?: string | null) => customers.find((c) => c.id === id && (!c.address.country || /česk/i.test(c.address.country)))
  const recent = new Date(new Date(on).getTime() - 60 * 86_400_000).toISOString().slice(0, 10)
  const proforma = out.filter((i) => i.issueDate >= recent && i.status === 'paid' && czech(i.customerId))
    .sort((a, b) => b.issueDate.localeCompare(a.issueDate))[0]
  if (proforma) {
    const number = nextNumber(settings.numbering.proformaPattern, proforma.issueDate, out.map((i) => i.number))
    out = out.map((i) => (i.id === proforma.id ? { ...i, kind: 'proforma' as const, number, variableSymbol: number.replace(/\D/g, '') } : i))
  }

  // Regular customers: the biggest one is done for this month; two others are due.
  const billedThisMonth = new Set(out.filter((i) => i.issueDate.startsWith(month)).map((i) => i.customerId))
  const count = new Map<string, number>()
  for (const i of out) if (i.customerId) count.set(i.customerId, (count.get(i.customerId) ?? 0) + 1)
  const byCount = customers.filter((c) => czech(c.id)).sort((a, b) => (count.get(b.id) ?? 0) - (count.get(a.id) ?? 0))
  const done = byCount.find((c) => billedThisMonth.has(c.id))
  const due = byCount.filter((c) => !billedThisMonth.has(c.id) && c.id !== proforma?.customerId).slice(0, 2)
  const regular = new Set([done?.id, ...due.map((c) => c.id)])

  // Three of the smaller customers have no e-mail yet.
  const noEmail = new Set(byCount.slice(-3).map((c) => c.id))
  const outCustomers = customers.map((c) => ({
    ...c,
    ...(regular.has(c.id) ? { recurring: { every: 'month' as const, day: 1 } } : {}),
    ...(noEmail.has(c.id) ? { email: '', cc: [] } : {}),
  }))
  return { settings, customers: outCustomers, invoices: out }
}
