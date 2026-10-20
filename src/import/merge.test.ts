import { describe, expect, it } from 'vitest'
import { Customer, Invoice } from '@/domain/schema'
import { mergeImport } from './merge'

const customer = (id: string, name: string, ic = '') => Customer.parse({ id, name, ic })
const invoice = (id: string, number: string, customerId: string, more: Partial<Invoice> = {}) => Invoice.parse({
  id, number, customerId, customerSnapshot: { name: 'x' }, issueDate: '2026-03-01', dueDate: '2026-03-15', currency: 'CZK',
  language: 'cs', vatMode: 'nonPayer', lines: [{ description: 'Práce', quantity: 1, unitPrice: 100000 }], status: 'paid', ...more,
})

describe('adding an import to data already in Invojka (made-up)', () => {
  const current = {
    customers: [customer('c1', 'Pekárna Kvásek, s.r.o.', '87654321'), customer('c2', 'Truhlářství Hobl')],
    invoices: [invoice('i1', '2026-0001', 'c1')],
  }
  const imported = {
    customers: [customer('n1', 'Pekárna Kvásek', '87 654 321'), customer('n2', 'truhlářství hobl'), customer('n3', 'Fjord Design AS')],
    invoices: [
      invoice('m1', '2026-0001', 'n1'),
      invoice('m2', '2026-0002', 'n2'),
      invoice('m3', 'D2026-0001', 'n3', { kind: 'creditNote', correctsId: 'm1', correctsNumber: '2026-0001' }),
      invoice('m4', '2026-0001', 'n3', { kind: 'proforma' }),
    ],
  }
  const out = mergeImport(current, imported)

  it('matches customers by IČ, then by name, and adds the rest', () => {
    expect(out.customers.map((c) => c.id)).toEqual(['c1', 'c2', 'n3'])
    expect(out.addedCustomers).toBe(1)
    expect(out.invoices.find((i) => i.id === 'm2')!.customerId).toBe('c2')
  })

  it('skips documents already there, by kind and number, and keeps links pointing at them', () => {
    expect(out.skipped).toBe(1)
    expect(out.addedInvoices).toBe(3)
    expect(out.invoices.find((i) => i.id === 'i1')).toEqual(current.invoices[0])
    expect(out.invoices.find((i) => i.id === 'm3')!.correctsId).toBe('i1')
    // A proforma may share its number with an invoice: a separate series.
    expect(out.invoices.find((i) => i.id === 'm4')!.kind).toBe('proforma')
  })

  it('loading the same export twice changes nothing', () => {
    const again = mergeImport(out, imported)
    expect(again.invoices).toHaveLength(out.invoices.length)
    expect(again.customers).toHaveLength(out.customers.length)
    expect(again.addedInvoices).toBe(0)
  })
})
