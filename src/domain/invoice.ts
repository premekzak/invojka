import { addDays, differenceInCalendarDays, format, parseISO } from 'date-fns'
import { newId, today } from './id'
import { mulRound } from './money'
import { nextNumber } from './numbering'
import { monthsBetween, shiftMonths } from './recurring'
import type { Customer, Invoice, InvoiceKind, Settings } from './schema'
import { computeTotals, netFromGross, type Totals } from './vat'

/** What the user sees. "overdue" is derived, never stored. */
export type DisplayStatus = 'draft' | 'issued' | 'overdue' | 'paid' | 'cancelled' | 'uncollectible'

export function displayStatus(inv: Invoice, on = today()): DisplayStatus {
  // Written off: still issued, but nobody waits for it any more.
  if (inv.status === 'issued' && inv.uncollectible) return 'uncollectible'
  // A credit note isn't a debt of the customer, so it's never "overdue".
  if (inv.status === 'issued' && inv.kind !== 'creditNote' && inv.dueDate < on) return 'overdue'
  return inv.status
}

export const invoiceTotals = (inv: Invoice): Totals => computeTotals(inv.lines, inv.vatMode, inv.reverseCharge)

/** What is still to be paid: the total, less an advance already paid on a proforma. */
export const amountDue = (inv: Invoice) => invoiceTotals(inv).total - (inv.advanceAmount ?? 0)

/** The number series of each kind of document. */
export const patternFor = (settings: Settings, kind: InvoiceKind) =>
  kind === 'creditNote' ? settings.numbering.creditNotePattern
  : kind === 'proforma' ? settings.numbering.proformaPattern
  : kind === 'advanceTaxDoc' ? settings.numbering.advanceTaxDocPattern
  : settings.numbering.pattern

export const daysOverdue = (inv: Invoice, on = today()) => differenceInCalendarDays(parseISO(on), parseISO(inv.dueDate))

/** An amount of the invoice's currency in CZK: as is, or via the stored exchange rate (undefined if missing). */
const inCzk = (inv: Invoice, amount: number) =>
  inv.currency === 'CZK' ? amount : inv.exchangeRate ? Math.round(amount * inv.exchangeRate) : undefined

/** Total in CZK for analytics: CZK as is, other currencies via the stored exchange rate (undefined if missing). */
export const totalCzk = (inv: Invoice) => inCzk(inv, invoiceTotals(inv).total)

/** The amount still due, in CZK (see `amountDue`). */
export const dueCzk = (inv: Invoice) => inCzk(inv, amountDue(inv))

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
 * since most invoices repeat the previous one; the months its lines name move on with the date ("za srpen" → "za září").
 */
/**
 * How far a copied line's months move: the calendar months since the last invoice, but only up to a year. An older
 * invoice isn't a monthly template any more, and moving "prosinec 2017" seven years on would only confuse.
 */
export const copyShift = (lastIssued: string, on: string) => {
  const months = monthsBetween(lastIssued, on)
  return months > 0 && months <= 12 ? months : 0
}

/** Numbers taken in the invoice series: the invoices' own, and the last one issued before Invojka (`continueFrom`). */
export const usedNumbers = (settings: Settings, invoices: Invoice[]) =>
  [...invoices.map((i) => i.number), ...(settings.numbering.continueFrom ? [settings.numbering.continueFrom] : [])]

export function newInvoice(settings: Settings, invoices: Invoice[], customer?: Customer, on = today()): Invoice {
  const number = nextNumber(settings.numbering.pattern, on, usedNumbers(settings, invoices))
  const last = customer && latestFor(invoices, customer.id)
  const vatRate = settings.vatMode === 'payer' ? settings.defaultVatRate : 0
  return {
    id: newId(),
    kind: 'invoice',
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
    paymentMethod: last?.paymentMethod ?? settings.defaults.paymentMethod,
    vatMode: settings.vatMode,
    reverseCharge: customer?.reverseCharge ?? false,
    lines: last
      ? last.lines.map((l) => ({ ...l, description: shiftMonths(l.description, copyShift(last.issueDate, on)), vatRate: settings.vatMode === 'payer' ? l.vatRate || vatRate : 0 }))
      : [{ description: '', quantity: 1, unit: settings.defaults.unit, unitPrice: 0, vatRate }],
    note: settings.defaults.note,
    correctionReason: '',
    privateNote: '',
    tags: [],
    reminders: [],
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
  // A credit note's negative lines or a proforma's advance are no template for the next invoice.
  for (const i of invoices) if (i.kind === 'invoice' && i.customerId === customerId && (!best || i.issueDate > best.issueDate)) best = i
  return best
}

/**
 * A draft switched to another kind of document (invoice ⇄ proforma) before it's issued: it takes the next number of
 * that kind's series, and a proforma has no DUZP because it isn't a tax document.
 */
export function withKind(inv: Invoice, kind: InvoiceKind, settings: Settings, invoices: Invoice[]): Invoice {
  const number = nextNumber(patternFor(settings, kind), inv.issueDate, usedNumbers(settings, invoices.filter((i) => i.id !== inv.id)))
  return {
    ...inv,
    kind,
    number,
    variableSymbol: number.replace(/\D/g, '').slice(-10),
    taxableSupplyDate: kind === 'proforma' || inv.vatMode !== 'payer' ? undefined : inv.taxableSupplyDate ?? inv.issueDate,
  }
}

/**
 * The final invoice for a paid proforma: the same customer, lines, currency, language and payment method, dated today,
 * with the advance deducted. When the advance covers it all, issuing it marks it paid (see `issuedStatus`).
 */
export function newFinalInvoice(settings: Settings, invoices: Invoice[], proforma: Invoice, on = today()): Invoice {
  const number = nextNumber(settings.numbering.pattern, on, usedNumbers(settings, invoices))
  const total = invoiceTotals(proforma).total
  // A payer deducts what the tax document for the advance says, base and VAT per rate (see `newAdvanceTaxDoc`).
  const taxDoc = advanceTaxDocOf(invoices, proforma.id)
  const taxTotals = taxDoc && invoiceTotals(taxDoc)
  // The money received is deducted as such; the tax document's base and VAT can differ from it by a rounding haléř.
  const advance = Math.min(proforma.paidAmount ?? taxTotals?.total ?? total, total)
  return {
    ...proforma,
    id: newId(),
    kind: 'invoice',
    number,
    variableSymbol: number.replace(/\D/g, '').slice(-10),
    issueDate: on,
    dueDate: isoPlusDays(on, settings.defaults.dueDays),
    taxableSupplyDate: proforma.vatMode === 'payer' ? on : undefined,
    paidDate: undefined,
    paidAmount: undefined,
    recordedTotal: undefined,
    advanceId: proforma.id,
    advanceNumber: proforma.number,
    advanceAmount: advance,
    advanceTaxDocNumber: taxDoc?.number,
    advanceVat: taxTotals?.byRate.map(({ rate, base, vat }) => ({ rate, base, vat })),
    status: 'draft',
    sentAt: undefined,
    reminders: [],
    exportedAt: undefined,
  }
}

/** The final invoice that settles a proforma, if there is one. */
export const finalInvoiceOf = (invoices: Invoice[], proformaId: string) =>
  invoices.find((i) => i.kind === 'invoice' && i.advanceId === proformaId && i.status !== 'cancelled')

/**
 * A draft credit note for an issued invoice: its own number series, the same customer, currency, rate and VAT mode,
 * and the original lines with negative prices, so "cancel it all" is the starting point and the user edits it down to
 * the actual difference. Dated today, which is also the DUZP of the correction (§ 42(3) of the VAT act).
 */
export function newCreditNote(settings: Settings, invoices: Invoice[], original: Invoice, on = today()): Invoice {
  const number = nextNumber(settings.numbering.creditNotePattern, on, invoices.map((i) => i.number))
  return {
    ...original,
    id: newId(),
    kind: 'creditNote',
    number,
    variableSymbol: number.replace(/\D/g, '').slice(-10),
    issueDate: on,
    dueDate: isoPlusDays(on, settings.defaults.dueDays),
    taxableSupplyDate: original.vatMode === 'payer' ? on : undefined,
    paidDate: undefined,
    paidAmount: undefined,
    lines: original.lines.map((l) => ({ ...l, unitPrice: -l.unitPrice })),
    recordedTotal: undefined,
    note: '',
    correctsId: original.id,
    correctsNumber: original.number,
    correctionReason: '',
    status: 'draft',
    sentAt: undefined,
    reminders: [],
    exportedAt: undefined,
  }
}

/** Credit notes that correct an invoice, oldest first. */
export const creditNotesOf = (invoices: Invoice[], id: string) =>
  invoices.filter((i) => i.kind === 'creditNote' && i.correctsId === id).sort((a, b) => a.issueDate.localeCompare(b.issueDate))

/**
 * The status an invoice gets when issued: a final invoice whose advance covers it all is paid at once, on the day the
 * advance came in.
 */
export function issuedStatus(inv: Invoice, invoices: Invoice[], on = today()): Pick<Invoice, 'status' | 'paidDate' | 'paidAmount'> {
  // A tax document for a received payment records money that has already come in.
  if (inv.kind === 'advanceTaxDoc') return { status: 'paid', paidDate: inv.taxableSupplyDate ?? on, paidAmount: invoiceTotals(inv).total }
  if (!inv.advanceId || amountDue(inv) > 0) return { status: 'issued' }
  const proforma = invoices.find((i) => i.id === inv.advanceId)
  return { status: 'paid', paidDate: proforma?.paidDate ?? on, paidAmount: 0 }
}

const ADVANCE_RECEIVED = { cs: 'Přijatá záloha', en: 'Advance received', de: 'Erhaltene Anzahlung', sk: 'Prijatá záloha' } as const

/** The VAT payer's tax document for a proforma's advance, if there is one. */
export const advanceTaxDocOf = (invoices: Invoice[], proformaId: string) =>
  invoices.find((i) => i.kind === 'advanceTaxDoc' && i.advanceId === proformaId && i.status !== 'cancelled')

/** A VAT payer has 15 days from receiving an advance to issue its tax document (§ 28(8) of the VAT act). */
export const ADVANCE_TAX_DOC_DAYS = 15
export const advanceTaxDocDeadline = (proforma: Invoice) => isoPlusDays(proforma.paidDate ?? proforma.issueDate, ADVANCE_TAX_DOC_DAYS)

/**
 * The tax document for a paid proforma's advance (daňový doklad k přijaté platbě), VAT payers only: the received
 * amount with VAT included, split over the proforma's VAT rates in proportion and turned into net lines, so the base
 * and VAT add up to the money received exactly. Its DUZP is the day the money came in.
 */
export function newAdvanceTaxDoc(settings: Settings, invoices: Invoice[], proforma: Invoice, on = today()): Invoice {
  const number = nextNumber(settings.numbering.advanceTaxDocPattern, on, invoices.map((i) => i.number))
  const totals = invoiceTotals(proforma)
  const received = proforma.paidAmount ?? totals.total
  const subject = proforma.lines.map((l) => l.description.trim()).filter(Boolean).join('; ')
  const lang = proforma.language
  let left = received
  const lines = totals.byRate.map((r, i) => {
    // The last rate takes what's left after the others' base and VAT, so rounding can be off by a haléř at most there.
    const gross = i === totals.byRate.length - 1 ? left : Math.round((received * r.total) / (totals.total || 1))
    const unitPrice = netFromGross(gross, r.rate)
    left -= unitPrice + mulRound(unitPrice, r.rate / 100)
    const description = `${ADVANCE_RECEIVED[lang]}${subject ? ` – ${subject}` : ''}`
    return { description, quantity: 1, unit: '', unitPrice, vatRate: r.rate }
  })
  return {
    ...proforma,
    id: newId(),
    kind: 'advanceTaxDoc',
    number,
    variableSymbol: proforma.variableSymbol,
    issueDate: on,
    dueDate: on,
    taxableSupplyDate: proforma.paidDate ?? on,
    paidDate: undefined,
    paidAmount: undefined,
    lines,
    recordedTotal: undefined,
    note: '',
    advanceId: proforma.id,
    advanceNumber: proforma.number,
    advanceAmount: undefined,
    status: 'draft',
    sentAt: undefined,
    reminders: [],
    exportedAt: undefined,
  }
}

/**
 * A new draft that copies this invoice: the same customer, lines (their months moved on, as when copying the last
 * invoice), currency, language, payment method and tags, with the next number and today's dates.
 */
export function duplicateInvoice(settings: Settings, invoices: Invoice[], original: Invoice, on = today()): Invoice {
  const fresh = newInvoice(settings, invoices, undefined, on)
  return {
    ...fresh,
    customerId: original.customerId,
    customerSnapshot: original.customerSnapshot,
    currency: original.currency,
    language: original.language,
    paymentMethod: original.paymentMethod,
    reverseCharge: original.reverseCharge,
    orderNumber: '',
    note: original.note,
    tags: original.tags,
    lines: original.lines.map((l) => ({ ...l, description: shiftMonths(l.description, copyShift(original.issueDate, on)),
      vatRate: settings.vatMode === 'payer' ? l.vatRate || settings.defaultVatRate : 0 })),
  }
}

/**
 * Lines that take `percent` off the invoice, one per VAT rate so the VAT is lowered at the right rate: "Sleva 10 %"
 * with a negative price of that share of the rate's base (only the positive lines count).
 */
export function discountLines(inv: Invoice, percent: number, label: string): Invoice['lines'] {
  const byRate = new Map<number, number>()
  for (const l of inv.lines) {
    const base = mulRound(l.unitPrice, l.quantity)
    if (base > 0) byRate.set(l.vatRate, (byRate.get(l.vatRate) ?? 0) + base)
  }
  return [...byRate.entries()].map(([vatRate, base]) => ({
    description: `${label} ${percent} %`, quantity: 1, unit: '', unitPrice: -mulRound(base, percent / 100), vatRate,
  }))
}

export type HistoryEvent = { date: string; type: 'issued' | 'sent' | 'reminded' | 'paid' | 'exported' | 'uncollectible' | 'corrected' | 'settled' | 'taxDoc'; number?: string; id?: string }

/**
 * What happened to a document, oldest first, from what it records (issue, send, reminder, payment, export, write-off
 * dates) and the documents that refer to it (credit notes, the final invoice, the tax document for its advance).
 */
export function invoiceHistory(inv: Invoice, invoices: Invoice[]): HistoryEvent[] {
  const out: HistoryEvent[] = []
  if (inv.status !== 'draft') out.push({ date: inv.issueDate, type: 'issued' })
  if (inv.sentAt) out.push({ date: inv.sentAt.slice(0, 10), type: 'sent' })
  for (const r of inv.reminders) out.push({ date: r, type: 'reminded' })
  if (inv.status === 'paid' && inv.paidDate) out.push({ date: inv.paidDate, type: 'paid' })
  if (inv.uncollectible) out.push({ date: inv.uncollectible, type: 'uncollectible' })
  if (inv.exportedAt) out.push({ date: inv.exportedAt.slice(0, 10), type: 'exported' })
  for (const o of invoices) {
    if (o.status === 'draft' || o.status === 'cancelled') continue
    if (o.kind === 'creditNote' && o.correctsId === inv.id) out.push({ date: o.issueDate, type: 'corrected', number: o.number, id: o.id })
    if (o.kind === 'invoice' && o.advanceId === inv.id) out.push({ date: o.issueDate, type: 'settled', number: o.number, id: o.id })
    if (o.kind === 'advanceTaxDoc' && o.advanceId === inv.id) out.push({ date: o.issueDate, type: 'taxDoc', number: o.number, id: o.id })
  }
  return out.sort((a, b) => a.date.localeCompare(b.date))
}

/**
 * Customers worth a call: invoiced at least twice, the last time between `months` months (default three) and two years
 * ago, longest silence first. Older ones have moved on; archived and regular customers (Home lists those) are left out.
 */
export function longUninvoiced(customers: Customer[], invoices: Invoice[], on: string, months = 3): { customer: Customer; last: string }[] {
  const limit = isoPlusDays(on, -Math.round(months * 30.4))
  const since = isoPlusDays(on, -730)
  const lastBy = new Map<string, { last: string; count: number }>()
  for (const i of invoices) {
    if (!i.customerId || i.kind !== 'invoice' || i.status === 'draft' || i.status === 'cancelled') continue
    const r = lastBy.get(i.customerId) ?? { last: '', count: 0 }
    r.count++
    if (i.issueDate > r.last) r.last = i.issueDate
    lastBy.set(i.customerId, r)
  }
  return customers
    .filter((c) => !c.archived && !c.recurring)
    .flatMap((c) => {
      const r = lastBy.get(c.id)
      return r && r.count >= 2 && r.last < limit && r.last >= since ? [{ customer: c, last: r.last }] : []
    })
    .sort((a, b) => a.last.localeCompare(b.last))
}
