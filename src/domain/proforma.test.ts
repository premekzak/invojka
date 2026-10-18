import { describe, expect, it } from 'vitest'
import { checkData } from './check'
import { amountDue, finalInvoiceOf, issuedStatus, newFinalInvoice, newInvoice, withKind } from './invoice'
import { SCHEMA_VERSION, Settings, type Invoice } from './schema'
import { customerStats, homeStats } from './stats'
import { vatTurnover } from './vatThreshold'

const settings = Settings.parse({ schemaVersion: SCHEMA_VERSION, supplier: { name: 'Test' }, vatMode: 'nonPayer' })
const customer = { id: 'c1', name: 'Acme', ic: '', dic: '', address: { street: '', zip: '', city: '', country: '' }, email: '', cc: [], phone: '', web: '', contactName: '', reverseCharge: false, note: '', archived: false }
const draft = newInvoice(settings, [], customer, '2026-10-01')
const proforma: Invoice = {
  ...withKind(draft, 'proforma', settings, []),
  status: 'paid', paidDate: '2026-10-05', paidAmount: 30_000_00,
  lines: [{ description: 'Web', quantity: 1, unit: '', unitPrice: 30_000_00, vatRate: 0 }],
}

describe('proformas', () => {
  it('take their own series and switch back to the invoice series', () => {
    expect(proforma).toMatchObject({ kind: 'proforma', number: 'Z20260001' })
    expect(withKind(proforma, 'invoice', settings, [proforma]).number).toBe('20260001')
    const payer = Settings.parse({ ...settings, vatMode: 'payer' })
    expect(withKind(newInvoice(payer, [], customer, '2026-10-01'), 'proforma', payer, []).taxableSupplyDate).toBeUndefined()
  })

  it('are no revenue, no turnover and no template for the next invoice', () => {
    expect(homeStats([proforma], '2026-12-31')).toMatchObject({ revenue: 0, countThisYear: 0, outstanding: 0 })
    expect(vatTurnover([proforma], 2026).domestic).toBe(0)
    expect(customerStats([proforma]).get('c1')).toBeUndefined()
    expect(newInvoice(settings, [proforma], customer, '2026-11-01').lines[0]!.description).toBe('')
  })

  it('lead to a final invoice that deducts the advance and is paid on issue when covered', () => {
    const final = newFinalInvoice(settings, [proforma], proforma, '2026-10-20')
    expect(final).toMatchObject({ kind: 'invoice', number: '20260001', advanceId: proforma.id, advanceNumber: 'Z20260001', advanceAmount: 30_000_00, status: 'draft' })
    expect(final.paidDate).toBeUndefined()
    expect(amountDue(final)).toBe(0)
    expect(issuedStatus(final, [proforma])).toEqual({ status: 'paid', paidDate: '2026-10-05', paidAmount: 0 })
    const issued = { ...final, ...issuedStatus(final, [proforma]) }
    expect(finalInvoiceOf([proforma, issued], proforma.id)?.id).toBe(issued.id)
    // The final invoice is the revenue, in full; nothing is left waiting.
    expect(homeStats([proforma, issued], '2026-12-31')).toMatchObject({ revenue: 30_000_00, countThisYear: 1, outstanding: 0 })
    expect(checkData({ settings, customers: [customer], invoices: [proforma, issued] }).filter((i) => i.level === 'error')).toEqual([])
  })

  it('leave the rest due when the work cost more than the advance', () => {
    const final = { ...newFinalInvoice(settings, [proforma], proforma, '2026-10-20'),
      lines: [...proforma.lines, { description: 'Extra', quantity: 1, unit: '', unitPrice: 5_000_00, vatRate: 0 }] }
    expect(amountDue(final)).toBe(5_000_00)
    expect(issuedStatus(final, [proforma])).toEqual({ status: 'issued' })
    const issued = { ...final, status: 'issued' as const }
    expect(homeStats([proforma, issued], '2026-12-31')).toMatchObject({ revenue: 35_000_00, outstanding: 5_000_00 })
  })
})
