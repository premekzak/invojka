import { describe, expect, it } from 'vitest'
import { discountLines, displayStatus, duplicateInvoice, invoiceHistory, invoiceTotals, longUninvoiced, newInvoice } from './invoice'
import { SCHEMA_VERSION, Settings, type Customer, type Invoice } from './schema'
import { homeStats } from './stats'

const settings = Settings.parse({ schemaVersion: SCHEMA_VERSION, supplier: { name: 'T' }, vatMode: 'payer' })
const customer = (id: string, patch: Partial<Customer> = {}): Customer => ({
  id, name: `Firma ${id}`, ic: '', dic: '', address: { street: '', zip: '', city: '', country: '' }, email: '', cc: [], phone: '', web: '',
  contactName: '', reverseCharge: false, note: '', archived: false, ...patch,
})
const inv = (patch: Partial<Invoice> = {}): Invoice => ({
  ...newInvoice(settings, [], customer('a'), '2026-09-01'), status: 'issued', dueDate: '2026-09-15',
  lines: [{ description: 'Správa kampaní za srpen 2026', quantity: 2, unit: 'h', unitPrice: 1_000_00, vatRate: 21 },
    { description: 'Kniha', quantity: 1, unit: '', unitPrice: 500_00, vatRate: 12 }], ...patch,
})

describe('small helpers', () => {
  it('duplicate an invoice as a new draft with the next number and moved months', () => {
    const original = inv({ tags: ['web'], paidDate: '2026-09-10', status: 'paid', reminders: ['2026-09-20'], sentAt: '2026-09-02' })
    const copy = duplicateInvoice(settings, [original], original, '2026-10-05')
    expect(copy).toMatchObject({ status: 'draft', number: '20260002', issueDate: '2026-10-05', customerId: 'a', tags: ['web'], reminders: [] })
    expect(copy.id).not.toBe(original.id)
    expect(copy.paidDate).toBeUndefined()
    expect(copy.sentAt).toBeUndefined()
    expect(copy.lines[0]!.description).toBe('Správa kampaní za září 2026')
  })

  it('take a percentage off per VAT rate', () => {
    const d = inv()
    const lines = discountLines(d, 10, 'Sleva')
    expect(lines).toEqual([
      { description: 'Sleva 10 %', quantity: 1, unit: '', unitPrice: -200_00, vatRate: 21 },
      { description: 'Sleva 10 %', quantity: 1, unit: '', unitPrice: -50_00, vatRate: 12 },
    ])
    expect(invoiceTotals({ ...d, lines: [...d.lines, ...lines] }).base).toBe(2_250_00)
  })

  it('write an invoice off: no longer overdue or waiting, still revenue', () => {
    const off = inv({ uncollectible: '2026-10-01' })
    expect(displayStatus(off, '2026-10-18')).toBe('uncollectible')
    expect(homeStats([off], '2026-10-18')).toMatchObject({ outstanding: 0, overdueCount: 0, revenue: invoiceTotals(off).total })
  })

  it('tell what happened to an invoice, oldest first', () => {
    const original = inv({ sentAt: '2026-09-02T10:00:00', reminders: ['2026-09-20'], status: 'paid', paidDate: '2026-09-25', exportedAt: '2026-10-01' })
    const credit = { ...inv(), id: 'cn', kind: 'creditNote' as const, number: 'D20260001', correctsId: original.id, issueDate: '2026-09-28' }
    expect(invoiceHistory(original, [original, credit]).map((e) => [e.date, e.type, e.number])).toEqual([
      ['2026-09-01', 'issued', undefined], ['2026-09-02', 'sent', undefined], ['2026-09-20', 'reminded', undefined],
      ['2026-09-25', 'paid', undefined], ['2026-09-28', 'corrected', 'D20260001'], ['2026-10-01', 'exported', undefined],
    ])
  })

  it('find customers not invoiced for a while, longest silence first', () => {
    const customers = [customer('old'), customer('older'), customer('recent'), customer('once'), customer('gone'), customer('regular', { recurring: { every: 'month', day: 1 } })]
    const i = (customerId: string, issueDate: string) => inv({ customerId, issueDate })
    const invoices = [
      i('old', '2026-01-10'), i('old', '2026-05-10'),
      i('older', '2025-11-01'), i('older', '2025-12-01'),
      i('recent', '2026-03-01'), i('recent', '2026-10-01'),
      i('once', '2025-01-01'),
      i('gone', '2019-01-01'), i('gone', '2019-06-01'),
      i('regular', '2025-01-01'), i('regular', '2025-02-01'),
    ]
    expect(longUninvoiced(customers, invoices, '2026-10-18').map((r) => [r.customer.id, r.last])).toEqual([['older', '2025-12-01'], ['old', '2026-05-10']])
  })
})
