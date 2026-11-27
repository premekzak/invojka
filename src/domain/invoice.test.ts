import { describe, expect, it } from 'vitest'
import { customerSummaries, displayStatus, newInvoice, recentCustomerIds, snapshotDiffers, withIssueNumber, withVatMode } from './invoice'
import { SCHEMA_VERSION, Settings, type Customer, type Invoice } from './schema'

const settings = Settings.parse({ schemaVersion: SCHEMA_VERSION, supplier: { name: 'Me' }, vatMode: 'nonPayer' })
const customer: Customer = {
  id: 'c1', name: 'Acme', ic: '', dic: '', address: { street: '', zip: '', city: '', country: '' },
  email: '', cc: [], phone: '', web: '', contactName: '', reverseCharge: false, note: '', archived: false,
}
const previous = {
  ...newInvoice(settings, [], customer, '2026-08-01'),
  number: '20260008', status: 'issued', currency: 'NZD', language: 'en',
  lines: [{ description: 'PPC management', quantity: 1, unit: '', unitPrice: 1450000, vatRate: 0 }],
} satisfies Invoice

describe('recentCustomerIds', () => {
  it('lists each customer once, newest invoice first, up to n', () => {
    const at = (customerId: string | null, issueDate: string, number: string) => ({ ...previous, customerId, issueDate, number })
    const invoices = [at('a', '2026-01-10', '1'), at('b', '2026-03-01', '2'), at('a', '2026-04-01', '3'), at(null, '2026-05-01', '4'), at('c', '2026-02-01', '5')]
    expect(recentCustomerIds(invoices)).toEqual(['a', 'b', 'c'])
    expect(recentCustomerIds(invoices, 2)).toEqual(['a', 'b'])
    expect(recentCustomerIds([])).toEqual([])
  })
})

describe('customerSummaries', () => {
  it('counts documents, keeps the latest and counts the overdue ones, without cancelled', () => {
    const at = (customerId: string | null, issueDate: string, number: string, more: Partial<Invoice> = {}): Invoice => ({ ...previous, customerId, issueDate, dueDate: issueDate, number, ...more })
    const invoices = [
      at('a', '2026-01-10', '1', { status: 'paid' }), at('a', '2026-04-01', '3'), at('a', '2026-04-01', '2'),
      at('a', '2026-05-01', '6', { status: 'cancelled' }), at('b', '2026-09-01', '4'), at(null, '2026-05-01', '5'),
    ]
    const s = customerSummaries(invoices, '2026-06-01')
    expect(s.get('a')).toMatchObject({ count: 3, overdue: 2, last: { number: '3' } })
    expect(s.get('b')).toMatchObject({ count: 1, overdue: 0 })
    expect(s.size).toBe(2)
  })
})

describe('withIssueNumber', () => {
  const doc = (id: string, number: string, status: Invoice['status'], more: Partial<Invoice> = {}): Invoice =>
    ({ ...previous, id, number, variableSymbol: number, status, issueDate: '2026-09-10', ...more })
  const issued = [doc('i7', '20260007', 'paid'), doc('i8', '20260008', 'issued')]

  it('keeps a draft that is next in the issued series', () => {
    const draft = doc('d', '20260009', 'draft')
    expect(withIssueNumber(settings, [...issued, draft], draft)).toEqual({ invoice: draft, moved: [] })
  })
  it('numbers by the issued series, not by older drafts, and moves the draft that held the number', () => {
    // An older draft waits with 9; the newer draft (10) is issued first and must be 9, so nothing is missing.
    const waiting = doc('a', '20260009', 'draft'), draft = doc('b', '20260010', 'draft')
    const { invoice, moved } = withIssueNumber(settings, [...issued, waiting, draft], draft)
    expect(invoice).toMatchObject({ number: '20260009', variableSymbol: '20260009' })
    expect(moved).toEqual([{ ...waiting, number: '20260010', variableSymbol: '20260010' }])
  })
  it('fills the number a deleted draft left behind', () => {
    // Draft 9 was deleted, draft 10 remains: issued it becomes 9.
    const draft = doc('b', '20260010', 'draft')
    expect(withIssueNumber(settings, [...issued, draft], draft).invoice.number).toBe('20260009')
  })
  it('keeps a number the user typed, one outside the pattern, and its own payment reference', () => {
    const typed = doc('d', '20260020', 'draft', { numberManual: true })
    expect(withIssueNumber(settings, [...issued, typed], typed).invoice.number).toBe('20260020')
    const custom = doc('d', 'FV-12', 'draft')
    expect(withIssueNumber(settings, [...issued, custom], custom).invoice.number).toBe('FV-12')
    const ownVs = doc('d', '20260010', 'draft', { variableSymbol: '555' })
    expect(withIssueNumber(settings, [...issued, ownVs], ownVs).invoice).toMatchObject({ number: '20260009', variableSymbol: '555' })
  })
  it('counts each kind in its own series and leaves issued documents alone', () => {
    const proforma = doc('p', 'Z20260003', 'draft', { kind: 'proforma' })
    expect(withIssueNumber(settings, [...issued, proforma], proforma).invoice.number).toBe('Z20260001')
    expect(withIssueNumber(settings, issued, issued[1]!)).toEqual({ invoice: issued[1], moved: [] })
  })
})

describe('newInvoice', () => {
  it('numbers, dates and a blank line', () => {
    const inv = newInvoice(settings, [], undefined, '2026-09-30')
    expect(inv).toMatchObject({ number: '20260001', variableSymbol: '20260001', issueDate: '2026-09-30', dueDate: '2026-10-14', status: 'draft' })
    expect(inv.lines).toHaveLength(1)
  })
  it("copies the customer's latest invoice", () => {
    const inv = newInvoice(settings, [previous], customer, '2026-09-30')
    expect(inv).toMatchObject({ number: '20260009', currency: 'NZD', language: 'en', customerId: 'c1' })
    expect(inv.lines[0].description).toBe('PPC management')
  })
  it('goes on after the last number issued elsewhere, until the series restarts', () => {
    const moved = { ...settings, numbering: { ...settings.numbering, pattern: '{YYYY}-{NNNN}', continueFrom: '2026-0041' } }
    expect(newInvoice(moved, [], undefined, '2026-09-30').number).toBe('2026-0042')
    expect(newInvoice(moved, [], undefined, '2027-01-04').number).toBe('2027-0001')
  })
})

it('notices when the customer changed after the invoice was made', () => {
  expect(snapshotDiffers(previous.customerSnapshot, customer)).toBe(false)
  expect(snapshotDiffers(previous.customerSnapshot, { ...customer, note: 'only a note' })).toBe(false)
  expect(snapshotDiffers(previous.customerSnapshot, { ...customer, address: { ...customer.address, city: 'Brno' } })).toBe(true)
  expect(snapshotDiffers(previous.customerSnapshot, { ...customer, dic: 'CZ12345678' })).toBe(true)
})

it('derives overdue', () => {
  expect(displayStatus(previous, '2026-08-10')).toBe('issued')
  expect(displayStatus(previous, '2026-09-30')).toBe('overdue')
  expect(displayStatus({ ...previous, status: 'paid' }, '2026-09-30')).toBe('paid')
})

describe('withVatMode', () => {
  const payer = { ...settings, vatMode: 'payer' as const }
  const draft = { ...newInvoice(settings, [], customer, '2026-10-01'), lines: [{ description: 'Work', quantity: 1, unit: '', unitPrice: 100000, vatRate: 0 }] }

  it('turns a draft into a VAT payer invoice: default rate and DUZP', () => {
    expect(withVatMode(draft, payer)).toMatchObject({ vatMode: 'payer', taxableSupplyDate: '2026-10-01', lines: [{ vatRate: 21 }] })
  })
  it('and back, without VAT, DUZP or reverse charge', () => {
    const back = withVatMode({ ...withVatMode(draft, payer), reverseCharge: true }, settings)
    expect(back).toMatchObject({ vatMode: 'nonPayer', taxableSupplyDate: undefined, reverseCharge: false, lines: [{ vatRate: 0 }] })
  })
  it('leaves issued invoices and drafts already in the mode alone', () => {
    const issued = { ...draft, status: 'issued' as const }
    expect(withVatMode(issued, payer)).toBe(issued)
    expect(withVatMode(draft, settings)).toBe(draft)
  })
})
