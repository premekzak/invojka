import { addDays, differenceInCalendarDays, format, parseISO } from 'date-fns'
import { newId, today } from './id'
import { nextNumber } from './numbering'
import type { Customer, Invoice, Settings } from './schema'
import { computeTotals, type Totals } from './vat'

/** What the user sees. "overdue" is derived, never stored. */
export type DisplayStatus = 'draft' | 'issued' | 'overdue' | 'paid' | 'cancelled'

export function displayStatus(inv: Invoice, on = today()): DisplayStatus {
  if (inv.status === 'issued' && inv.dueDate < on) return 'overdue'
  return inv.status
}

export const invoiceTotals = (inv: Invoice): Totals => computeTotals(inv.lines, inv.vatMode, inv.reverseCharge)

export const daysOverdue = (inv: Invoice, on = today()) => differenceInCalendarDays(parseISO(on), parseISO(inv.dueDate))

/** Total in CZK for analytics: CZK as is, other currencies via the stored exchange rate (undefined if missing). */
export function totalCzk(inv: Invoice): number | undefined {
  const total = invoiceTotals(inv).total
  if (inv.currency === 'CZK') return total
  return inv.exchangeRate ? Math.round(total * inv.exchangeRate) : undefined
}

export const isoPlusDays = (iso: string, days: number) => format(addDays(parseISO(iso), days), 'yyyy-MM-dd')

export const snapshotOf = (c: Customer): Invoice['customerSnapshot'] => ({ name: c.name, ic: c.ic, dic: c.dic, address: { ...c.address } })

/** True when the customer's details differ from what the invoice printed (field by field, so key order doesn't matter). */
export function snapshotDiffers(snap: Invoice['customerSnapshot'], c: Customer): boolean {
  const now = snapshotOf(c)
  return now.name !== snap.name || now.ic !== snap.ic || now.dic !== snap.dic ||
    (['street', 'zip', 'city', 'country'] as const).some((k) => now.address[k] !== snap.address[k])
}

/**
 * A new draft. With a customer, it starts from that customer's latest invoice (same lines, currency and language),
 * since most invoices repeat the previous one.
 */
export function newInvoice(settings: Settings, invoices: Invoice[], customer?: Customer, on = today()): Invoice {
  const number = nextNumber(settings.numbering.pattern, on, invoices.map((i) => i.number))
  const last = customer && latestFor(invoices, customer.id)
  const vatRate = settings.vatMode === 'payer' ? settings.defaultVatRate : 0
  return {
    id: newId(),
    number,
    variableSymbol: number.replace(/\D/g, ''),
    orderNumber: '',
    customerId: customer?.id ?? null,
    customerSnapshot: customer ? snapshotOf(customer) : { name: '', ic: '', dic: '', address: { street: '', zip: '', city: '', country: '' } },
    issueDate: on,
    dueDate: isoPlusDays(on, settings.defaults.dueDays),
    taxableSupplyDate: settings.vatMode === 'payer' ? on : undefined,
    currency: last?.currency ?? customer?.defaultCurrency ?? settings.defaults.currency,
    language: last?.language ?? customer?.defaultLanguage ?? settings.defaults.invoiceLanguage,
    vatMode: settings.vatMode,
    reverseCharge: customer?.reverseCharge ?? false,
    lines: last
      ? last.lines.map((l) => ({ ...l, vatRate: settings.vatMode === 'payer' ? l.vatRate || vatRate : 0 }))
      : [{ description: '', quantity: 1, unit: settings.defaults.unit, unitPrice: 0, vatRate }],
    note: settings.defaults.note,
    status: 'draft',
  }
}

/**
 * A draft fitted to the supplier's current VAT mode, after it changed in settings. Issued invoices keep the mode
 * they were issued with; drafts follow, like they follow customer edits. Prices are net, so a payer's draft gains VAT.
 */
export function withVatMode(inv: Invoice, settings: Settings): Invoice {
  if (inv.status !== 'draft' || inv.vatMode === settings.vatMode) return inv
  const payer = settings.vatMode === 'payer'
  return {
    ...inv,
    vatMode: settings.vatMode,
    taxableSupplyDate: payer ? inv.taxableSupplyDate ?? inv.issueDate : undefined,
    reverseCharge: settings.vatMode === 'nonPayer' ? false : inv.reverseCharge,
    lines: inv.lines.map((l) => ({ ...l, vatRate: payer ? l.vatRate || settings.defaultVatRate : 0 })),
  }
}

export function latestFor(invoices: Invoice[], customerId: string): Invoice | undefined {
  let best: Invoice | undefined
  for (const i of invoices) if (i.customerId === customerId && (!best || i.issueDate > best.issueDate)) best = i
  return best
}
