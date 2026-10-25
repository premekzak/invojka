import { describe, expect, it } from 'vitest'
import { checkData } from './check'
import { creditNotesOf, displayStatus, invoiceTotals, newCreditNote, newInvoice } from './invoice'
import { SCHEMA_VERSION, Settings, type Invoice } from './schema'
import { customerStats, debtors, homeStats } from './stats'
import { vatTurnover } from './vatThreshold'

const settings = Settings.parse({ schemaVersion: SCHEMA_VERSION, supplier: { name: 'Test' }, vatMode: 'payer' })
const customer = { id: 'c1', name: 'Acme', ic: '', dic: '', address: { street: '', zip: '', city: '', country: '' }, email: '', cc: [], phone: '', web: '', contactName: '', reverseCharge: false, note: '', archived: false }
const original: Invoice = {
  ...newInvoice(settings, [], customer, '2026-09-01'),
  status: 'paid', paidDate: '2026-09-10', paidAmount: 12_100_00,
  lines: [{ description: 'Konzultace', quantity: 10, unit: 'h', unitPrice: 1_000_00, vatRate: 21 }],
}

describe('credit notes', () => {
  const credit = newCreditNote(settings, [original], original, '2026-10-18')

  it('start as the whole invoice with a minus sign, in their own series, dated today', () => {
    expect(credit).toMatchObject({
      kind: 'creditNote', number: 'D20260001', correctsId: original.id, correctsNumber: original.number, correctionReason: '',
      status: 'draft', issueDate: '2026-10-18', taxableSupplyDate: '2026-10-18', customerId: 'c1', vatMode: 'payer',
    })
    expect(credit.id).not.toBe(original.id)
    expect(credit.paidDate).toBeUndefined()
    expect(invoiceTotals(credit)).toMatchObject({ base: -10_000_00, vat: -2_100_00, total: -12_100_00 })
  })

  it('number on in their series and leave the invoice series alone', () => {
    const second = newCreditNote(settings, [original, credit], original, '2026-10-19')
    expect(second.number).toBe('D20260002')
    expect(newInvoice(settings, [original, credit], customer, '2026-10-19').number).toBe('20260002')
    expect(creditNotesOf([original, second, credit], original.id).map((c) => c.number)).toEqual(['D20260001', 'D20260002'])
  })

  it('lower revenue and turnover but are not counted as invoices, and are never overdue', () => {
    const issued: Invoice = { ...credit, status: 'issued', correctionReason: 'Sleva', lines: [{ ...credit.lines[0]!, quantity: 2 }] }
    const all = [original, issued]
    const home = homeStats(all, '2026-12-31')
    expect(home.revenue).toBe(12_100_00 - 2_420_00)
    expect(home.countThisYear).toBe(1)
    expect(home.overdueCount).toBe(0)
    expect(displayStatus(issued, '2027-06-01')).toBe('issued')
    expect(customerStats(all).get('c1')).toMatchObject({ count: 1, paidCount: 1 })
    expect(vatTurnover(all, 2026).domestic).toBe(12_100_00 - 2_420_00)
  })

  it('lower what an unpaid invoice waits for, but not a paid one: that is a refund', () => {
    const unpaid: Invoice = { ...original, status: 'issued', paidDate: undefined, paidAmount: undefined, dueDate: '2026-09-15' }
    const credit2: Invoice = { ...credit, status: 'issued', correctionReason: 'Sleva', lines: [{ ...credit.lines[0]!, quantity: 2 }] }
    expect(homeStats([unpaid, credit2], '2026-10-20')).toMatchObject({ outstanding: 9_680_00, overdueSum: 9_680_00, overdueCount: 1 })
    expect(debtors([unpaid, credit2], '2026-10-20')).toMatchObject([{ overdue: 9_680_00, count: 1 }])
    // Credited in full: nothing to wait for, though the invoice is still issued until the user settles it.
    const whole: Invoice = { ...credit, status: 'issued', correctionReason: 'Storno' }
    expect(homeStats([unpaid, whole], '2026-10-20')).toMatchObject({ outstanding: 0, overdueSum: 0, overdueCount: 0 })
    expect(debtors([unpaid, whole], '2026-10-20')).toEqual([])
    // A credit note for a paid invoice doesn't lower other invoices' debts.
    const other: Invoice = { ...unpaid, id: 'other', number: '20260002' }
    expect(homeStats([original, other, whole], '2026-10-20')).toMatchObject({ outstanding: 12_100_00, overdueSum: 12_100_00 })
  })

  it('are checked for the invoice they correct and a reason', () => {
    const codes = (inv: Invoice[]) => checkData({ settings, customers: [customer], invoices: inv }).map((i) => i.code)
    expect(codes([original, { ...credit, status: 'issued', correctionReason: 'Sleva' }])).not.toContain('invoice.notPositive')
    expect(codes([original, { ...credit, status: 'issued' }])).toContain('creditNote.noReason')
    expect(codes([{ ...credit, status: 'issued', correctionReason: 'x' }])).toContain('creditNote.noOriginal')
  })
})
