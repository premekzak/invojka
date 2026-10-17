import { describe, expect, it } from 'vitest'
import { displayStatus, newInvoice, snapshotDiffers, withVatMode } from './invoice'
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
