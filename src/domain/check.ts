import { ADVANCE_TAX_DOC_DAYS, invoiceTotals, isoPlusDays } from './invoice'
import { nameKey } from './id'
import { periodOf, sequenceOf } from './numbering'
import type { Customer, Invoice, Settings } from './schema'

/**
 * A health check of the whole data set: things that should never happen (errors) and things that are
 * allowed but usually a mistake (warnings). Used by the tests and, in dev, by `__invojka.check()`.
 * Messages are for developers, so they are in English only.
 */
export interface Issue {
  level: 'error' | 'warning'
  code: string
  message: string
  invoice?: string // number
  customer?: string // name
}

export function checkData(data: { settings: Settings; customers: Customer[]; invoices: Invoice[] }): Issue[] {
  const { settings, customers, invoices } = data
  const out: Issue[] = []
  const err = (code: string, message: string, at: Partial<Issue> = {}) => out.push({ level: 'error', code, message, ...at })
  const warn = (code: string, message: string, at: Partial<Issue> = {}) => out.push({ level: 'warning', code, message, ...at })

  const dupes = <T>(items: T[], key: (x: T) => string) => {
    const seen = new Map<string, number>()
    for (const x of items) if (key(x)) seen.set(key(x), (seen.get(key(x)) ?? 0) + 1)
    return [...seen].filter(([, n]) => n > 1).map(([k]) => k)
  }

  // Customers
  const byId = new Map(customers.map((c) => [c.id, c]))
  for (const id of dupes(customers, (c) => c.id)) err('customer.duplicateId', `Two customers share the id ${id}.`)
  for (const ic of dupes(customers, (c) => c.ic)) warn('customer.duplicateIc', `Several customers have the IČ ${ic}.`)
  for (const k of dupes(customers.filter((c) => !c.archived), (c) => nameKey(c.name))) warn('customer.duplicateName', `Several active customers are called "${k}".`)
  for (const c of customers) if (!c.name.trim()) err('customer.noName', 'A customer has no name.', { customer: c.id })

  // Invoices one by one
  for (const id of dupes(invoices, (i) => i.id)) err('invoice.duplicateId', `Two invoices share the id ${id}.`)
  for (const n of dupes(invoices, (i) => i.number)) err('invoice.duplicateNumber', `Two invoices have the number ${n}.`, { invoice: n })
  for (const inv of invoices) {
    const at = { invoice: inv.number }
    const total = invoiceTotals(inv).total
    const final = inv.status !== 'draft'
    if (inv.dueDate < inv.issueDate) err('invoice.dueBeforeIssue', `Due ${inv.dueDate} before issued ${inv.issueDate}.`, at)
    if (inv.status === 'paid' && !inv.paidDate) err('invoice.paidNoDate', 'Paid but has no paid date.', at)
    if (inv.status !== 'paid' && inv.paidDate) err('invoice.dateNotPaid', `Has a paid date but its status is ${inv.status}.`, at)
    if (inv.paidDate && inv.paidDate < inv.issueDate) warn('invoice.paidBeforeIssue', `Paid ${inv.paidDate}, before it was issued ${inv.issueDate}.`, at)
    const due = total - (inv.advanceAmount ?? 0)
    if (inv.status === 'paid' && inv.paidAmount !== undefined && inv.paidAmount !== due)
      warn('invoice.paidAmount', `Paid ${inv.paidAmount}, but ${due} was due.`, at)
    if (inv.advanceId) {
      if (!invoices.some((i) => i.id === inv.advanceId && i.kind === 'proforma')) err('invoice.noProforma', 'Refers to a proforma that does not exist.', at)
      if ((inv.advanceAmount ?? 0) > total) warn('invoice.advanceOverTotal', `The advance ${inv.advanceAmount} is more than the total ${total}.`, at)
    }
    if (inv.kind === 'advanceTaxDoc' && final && inv.taxableSupplyDate && inv.issueDate > isoPlusDays(inv.taxableSupplyDate, ADVANCE_TAX_DOC_DAYS))
      warn('advanceTaxDoc.late', `Issued ${inv.issueDate}, more than ${ADVANCE_TAX_DOC_DAYS} days after the payment came in on ${inv.taxableSupplyDate}.`, at)
    if (final && !inv.customerSnapshot.name.trim()) err('invoice.noCustomer', 'Issued without a customer name.', at)
    if (inv.customerId && !byId.has(inv.customerId)) err('invoice.unknownCustomer', 'Points to a customer that does not exist.', at)
    if (inv.kind === 'creditNote') {
      if (!inv.correctsId || !invoices.some((i) => i.id === inv.correctsId)) err('creditNote.noOriginal', 'Credit note without the invoice it corrects.', at)
      if (final && !inv.correctionReason.trim()) warn('creditNote.noReason', 'Credit note without a reason for the correction.', at)
    } else if (final && total <= 0) warn('invoice.notPositive', `Total is ${total}.`, at)
    if (final && inv.currency !== 'CZK' && !inv.exchangeRate) warn('invoice.noRate', `${inv.currency} without an exchange rate, so it is left out of the CZK statistics.`, at)
    if (inv.recordedTotal !== undefined && inv.recordedTotal !== total) warn('invoice.recordedTotal', `Lines add up to ${total}, the import recorded ${inv.recordedTotal}.`, at)
    if (inv.reverseCharge && inv.vatMode === 'nonPayer') warn('invoice.reverseChargeNonPayer', 'Reverse charge on an invoice of a non-payer of VAT.', at)
    if (inv.vatMode === 'payer' && final && inv.kind !== 'proforma' && !inv.taxableSupplyDate) warn('invoice.noTaxableDate', 'VAT payer invoice without a taxable supply date (DUZP).', at)
    if (inv.vatMode !== 'payer' && inv.taxableSupplyDate) warn('invoice.taxableDateNonPayer', 'Has a taxable supply date (DUZP) but is not a VAT payer invoice.', at)
    if (inv.variableSymbol && !/^\d{1,10}$/.test(inv.variableSymbol)) warn('invoice.variableSymbol', `Variable symbol "${inv.variableSymbol}" is not 1–10 digits.`, at)
    if (final && inv.lines.some((l) => !l.description.trim())) warn('invoice.blankLine', 'Has a line without a description.', at)
    if (final && inv.lines.some((l) => l.quantity === 0)) warn('invoice.zeroQuantity', 'Has a line with quantity 0.', at)
    const c = inv.customerId ? byId.get(inv.customerId) : undefined
    if (inv.status === 'draft' && c && c.name !== inv.customerSnapshot.name) warn('invoice.draftStale', 'Draft shows other customer details than the customer has now.', at)
    if (inv.status === 'draft' && inv.vatMode !== settings.vatMode) warn('invoice.draftVatMode', `Draft is for a ${inv.vatMode}, but the supplier is now a ${settings.vatMode}.`, at)
  }

  // The number series: per period, numbers in the current pattern should run 1, 2, 3… without gaps,
  // and a higher number should not be issued earlier than a lower one.
  const pattern = settings.numbering.pattern
  const periods = new Map<string, { seq: number; inv: Invoice }[]>()
  for (const inv of invoices) {
    const seq = sequenceOf(pattern, inv.issueDate, inv.number)
    if (seq === undefined) continue
    const p = periodOf(pattern, inv.issueDate)
    periods.set(p, [...(periods.get(p) ?? []), { seq, inv }])
  }
  for (const [p, list] of periods) {
    list.sort((a, b) => a.seq - b.seq)
    const have = new Set(list.map((x) => x.seq))
    const missing = Array.from({ length: list.at(-1)!.seq }, (_, i) => i + 1).filter((n) => !have.has(n))
    if (missing.length) warn('numbering.gap', `${p}: numbers ${missing.join(', ')} are missing in the series.`)
    for (let i = 1; i < list.length; i++) {
      const a = list[i - 1]!.inv, b = list[i]!.inv
      if (b.issueDate < a.issueDate) warn('numbering.order', `${b.number} is dated ${b.issueDate}, before ${a.number} (${a.issueDate}).`, { invoice: b.number })
    }
  }
  return out
}
