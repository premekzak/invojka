import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { importCsv } from '@/import/csv'
import { fixtureCustomersCsv, fixtureInvoicesCsv } from '@/import/fixture'
import { checkData } from './check'
import { SCHEMA_VERSION, Settings, type Customer, type Invoice } from './schema'

const settings = Settings.parse({ schemaVersion: SCHEMA_VERSION, supplier: { name: 'Test' }, vatMode: 'nonPayer' })
const customer: Customer = {
  id: 'c1', name: 'Acme', ic: '', dic: '', address: { street: '', zip: '', city: '', country: '' },
  email: '', cc: [], phone: '', web: '', contactName: '', reverseCharge: false, note: '', archived: false,
}
const invoice = (patch: Partial<Invoice> = {}): Invoice => ({
  id: patch.number ?? '20260001', number: '20260001', variableSymbol: '20260001', orderNumber: '', customerId: 'c1',
  customerSnapshot: { name: 'Acme', ic: '', dic: '', address: { street: '', zip: '', city: '', country: '' } },
  issueDate: '2026-03-01', dueDate: '2026-03-15', currency: 'CZK', language: 'cs', paymentMethod: 'bank', kind: 'invoice', correctionReason: '', reminders: [], privateNote: '', tags: [], vatMode: 'nonPayer', reverseCharge: false,
  lines: [{ description: 'Work', quantity: 1, unit: '', unitPrice: 100000, vatRate: 0 }], note: '', status: 'issued',
  ...patch,
})
const codes = (invoices: Invoice[], customers = [customer]) => checkData({ settings, customers, invoices }).map((i) => i.code)

describe('checkData', () => {
  it('finds nothing wrong with a correct invoice', () => {
    expect(codes([invoice()])).toEqual([])
  })

  it.each<[string, Partial<Invoice>]>([
    ['invoice.dueBeforeIssue', { dueDate: '2026-02-01' }],
    ['invoice.paidNoDate', { status: 'paid' }],
    ['invoice.dateNotPaid', { paidDate: '2026-03-10' }],
    ['invoice.noCustomer', { customerId: null, customerSnapshot: { name: '', ic: '', dic: '', address: { street: '', zip: '', city: '', country: '' } } }],
    ['invoice.unknownCustomer', { customerId: 'gone' }],
  ])('reports the error %s', (code, patch) => {
    const found = checkData({ settings, customers: [customer], invoices: [invoice(patch)] })
    expect(found).toContainEqual(expect.objectContaining({ level: 'error', code }))
  })

  it.each<[string, Partial<Invoice>]>([
    ['invoice.paidBeforeIssue', { status: 'paid', paidDate: '2026-02-01', paidAmount: 100000 }],
    ['invoice.paidAmount', { status: 'paid', paidDate: '2026-03-10', paidAmount: 50000 }],
    ['invoice.notPositive', { lines: [{ description: 'Refund', quantity: 1, unit: '', unitPrice: -100, vatRate: 0 }] }],
    ['invoice.noRate', { currency: 'EUR' }],
    ['invoice.recordedTotal', { recordedTotal: 99 }],
    ['invoice.reverseChargeNonPayer', { reverseCharge: true }],
    ['invoice.noTaxableDate', { vatMode: 'payer' }],
    ['invoice.taxableDateNonPayer', { taxableSupplyDate: '2026-03-01' }],
    ['invoice.variableSymbol', { variableSymbol: '2026-01' }],
    ['invoice.blankLine', { lines: [{ description: ' ', quantity: 1, unit: '', unitPrice: 100, vatRate: 0 }] }],
    ['invoice.zeroQuantity', { lines: [{ description: 'Work', quantity: 0, unit: '', unitPrice: 100, vatRate: 0 }] }],
    ['invoice.draftVatMode', { status: 'draft', vatMode: 'payer' }],
    ['invoice.draftStale', { status: 'draft', customerSnapshot: { name: 'Acme Old', ic: '', dic: '', address: { street: '', zip: '', city: '', country: '' } } }],
  ])('warns about %s', (code, patch) => {
    const found = checkData({ settings, customers: [customer], invoices: [invoice(patch)] })
    expect(found).toContainEqual(expect.objectContaining({ level: 'warning', code }))
    expect(found.filter((i) => i.level === 'error')).toEqual([])
  })

  it('reports duplicate numbers', () => {
    expect(codes([invoice({ id: 'a' }), invoice({ id: 'b' })])).toContain('invoice.duplicateNumber')
  })

  it('reports gaps and out-of-order dates in the number series, per year', () => {
    const list = [
      invoice({ number: '20260001', issueDate: '2026-03-01' }),
      invoice({ number: '20260003', issueDate: '2026-02-20', dueDate: '2026-03-05' }),
      invoice({ number: '20250001', issueDate: '2025-05-01', dueDate: '2025-05-15' }),
    ]
    const found = checkData({ settings, customers: [customer], invoices: list })
    expect(found.filter((i) => i.code === 'numbering.gap').map((i) => i.message)).toEqual(['2026: numbers 2 are missing in the series.'])
    expect(found.filter((i) => i.code === 'numbering.order').map((i) => i.invoice)).toEqual(['20260003'])
  })

  it('reports duplicate customers', () => {
    const twin = { ...customer, id: 'c2', name: 'ACME s.r.o.', ic: '123' }
    expect(codes([], [{ ...customer, ic: '123' }, twin])).toEqual(['customer.duplicateIc', 'customer.duplicateName'])
  })
})

describe('checkData on imported data', () => {
  it('finds no errors in the made-up export, only the missing exchange rates', () => {
    const res = importCsv(fixtureCustomersCsv, fixtureInvoicesCsv, 'nonPayer')
    expect(codes(res.invoices, res.customers)).toEqual(['invoice.noRate', 'invoice.noRate'])
  })

  // The owner's real export is git-ignored; when present, it must have no errors (warnings are listed, not failed).
  const real = (f: string) => new URL(`../../${f}`, import.meta.url)
  it.skipIf(!existsSync(real('customers.csv')) || !existsSync(real('invoices.csv')))('finds no errors in the real export (local only)', () => {
    const res = importCsv(readFileSync(real('customers.csv'), 'utf8'), readFileSync(real('invoices.csv'), 'utf8'), 'nonPayer')
    const found = checkData({ settings, customers: res.customers, invoices: res.invoices })
    expect(found.filter((i) => i.level === 'error')).toEqual([])
  })
})
