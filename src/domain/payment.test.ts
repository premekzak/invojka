import { describe, expect, it } from 'vitest'
import { newInvoice } from './invoice'
import { CASH_LIMIT, hasReceipt, overCashLimit, paysByBank, receiptNumber } from './payment'
import { SCHEMA_VERSION, Settings } from './schema'

const settings = Settings.parse({ schemaVersion: SCHEMA_VERSION, supplier: { name: 'Test' }, vatMode: 'nonPayer' })
const base = { ...newInvoice(settings, [], undefined, '2026-10-18'), status: 'issued' as const }
const withTotal = (minor: number, patch = {}) => ({ ...base, lines: [{ description: 'x', quantity: 1, unit: '', unitPrice: minor, vatRate: 0 }], ...patch })

describe('payment method', () => {
  it('defaults to bank transfer, also for invoices saved before it existed', () => {
    expect(base.paymentMethod).toBe('bank')
    const cashDefault = Settings.parse({ ...settings, defaults: { ...settings.defaults, paymentMethod: 'cash' } })
    expect(newInvoice(cashDefault, [], undefined, '2026-10-18').paymentMethod).toBe('cash')
  })

  it('copies the method of the customer’s last invoice', () => {
    const customer = { id: 'c1', name: 'A', ic: '', dic: '', address: { street: '', zip: '', city: '', country: '' }, email: '', cc: [], phone: '', web: '', contactName: '', reverseCharge: false, note: '', archived: false }
    const last = { ...base, customerId: 'c1', paymentMethod: 'cod' as const }
    expect(newInvoice(settings, [last], customer, '2026-10-19').paymentMethod).toBe('cod')
  })

  it('prints bank details only for bank transfers', () => {
    expect(paysByBank(base)).toBe(true)
    expect(paysByBank({ paymentMethod: 'cash' })).toBe(false)
    expect(paysByBank({ paymentMethod: 'cod' })).toBe(false)
  })

  it('warns about cash above the legal limit only', () => {
    expect(overCashLimit(withTotal(CASH_LIMIT, { paymentMethod: 'cash' }))).toBe(false)
    expect(overCashLimit(withTotal(CASH_LIMIT + 1, { paymentMethod: 'cash' }))).toBe(true)
    expect(overCashLimit(withTotal(CASH_LIMIT + 1, { paymentMethod: 'bank' }))).toBe(false)
    // In euros it's converted with the invoice's rate; without a rate it can't be judged.
    expect(overCashLimit(withTotal(1_200_000, { paymentMethod: 'cash', currency: 'EUR', exchangeRate: 25 }))).toBe(true)
    expect(overCashLimit(withTotal(1_200_000, { paymentMethod: 'cash', currency: 'EUR' }))).toBe(false)
  })

  it('offers a cash receipt once a cash invoice is paid', () => {
    expect(hasReceipt({ ...base, paymentMethod: 'cash' })).toBe(false)
    expect(hasReceipt({ ...base, paymentMethod: 'cash', status: 'paid' })).toBe(true)
    expect(hasReceipt({ ...base, status: 'paid' })).toBe(false)
    expect(receiptNumber({ number: '20260008' })).toBe('P20260008')
  })
})
