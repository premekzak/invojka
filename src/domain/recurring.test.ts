import { describe, expect, it } from 'vitest'
import { newInvoice } from './invoice'
import { monthsBetween, periodStart, recurringStatus, shiftMonths } from './recurring'
import { SCHEMA_VERSION, Settings, type Customer, type Invoice } from './schema'

const settings = Settings.parse({ schemaVersion: SCHEMA_VERSION, supplier: { name: 'T' }, vatMode: 'nonPayer' })
const customer = (id: string, recurring?: Customer['recurring']): Customer => ({
  id, name: `Zákazník ${id}`, ic: '', dic: '', address: { street: '', zip: '', city: '', country: '' }, email: '', cc: [], phone: '', web: '',
  contactName: '', reverseCharge: false, note: '', archived: false, recurring,
})
const inv = (customerId: string, issueDate: string, status: Invoice['status'] = 'issued', description = 'Správa kampaní za srpen 2026'): Invoice => ({
  ...newInvoice(settings, [], customer(customerId), issueDate), customerId, status,
  lines: [{ description, quantity: 1, unit: '', unitPrice: 10_000_00, vatRate: 0 }],
})

describe('months in copied lines', () => {
  it('move Czech, English and numeric months, with the year when it rolls over', () => {
    expect(shiftMonths('Správa kampaní za srpen 2026', 1)).toBe('Správa kampaní za září 2026')
    expect(shiftMonths('Provoz e-shopu za prosinec 2026', 1)).toBe('Provoz e-shopu za leden 2027')
    expect(shiftMonths('Hosting září–říjen', 1)).toBe('Hosting říjen–listopad')
    expect(shiftMonths('Služby od 1. července do 31. července 2026', 2)).toBe('Služby od 1. září do 31. září 2026')
    expect(shiftMonths('Červenec 2026, červen 2026', 1)).toBe('Srpen 2026, červenec 2026')
    expect(shiftMonths('Google Ads management, November 2026', 2)).toBe('Google Ads management, January 2027')
    expect(shiftMonths('Období 8/2026 a 12/2026', 1)).toBe('Období 9/2026 a 1/2027')
    expect(shiftMonths('Období 08/2026', 1)).toBe('Období 09/2026')
    expect(shiftMonths('Report 2026-11, faktura ze dne 2026-11-03', 2)).toBe('Report 2027-01, faktura ze dne 2026-11-03')
    expect(shiftMonths('Konzultace (Maya, 5 h)', 3)).toBe('Konzultace (Maya, 5 h)')
    expect(shiftMonths('srpen 2026', 0)).toBe('srpen 2026')
    expect(shiftMonths('za září 2026', -1)).toBe('za srpen 2026')
  })

  it('counts calendar months and starts periods', () => {
    expect(monthsBetween('2026-08-31', '2026-09-01')).toBe(1)
    expect(monthsBetween('2025-12-15', '2026-02-01')).toBe(2)
    expect(periodStart('month', '2026-10-18')).toBe('2026-10-01')
    expect(periodStart('quarter', '2026-11-30')).toBe('2026-10-01')
    expect(periodStart('year', '2026-11-30')).toBe('2026-01-01')
  })

  it('apply when a new invoice copies the customer’s last one, but not from an invoice over a year old', () => {
    const last = inv('a', '2026-09-02')
    expect(newInvoice(settings, [last], customer('a'), '2026-10-01').lines[0]!.description).toBe('Správa kampaní za září 2026')
    const yearAgo = inv('a', '2025-10-02', 'issued', 'Hosting za rok 2025/2026, říjen')
    expect(newInvoice(settings, [yearAgo], customer('a'), '2026-10-01').lines[0]!.description).toBe('Hosting za rok 2025/2026, říjen')
    const old = inv('a', '2019-12-02', 'issued', 'Reklama za období prosinec 2017 - listopad 2019')
    expect(newInvoice(settings, [old], customer('a'), '2026-10-01').lines[0]!.description).toBe('Reklama za období prosinec 2017 - listopad 2019')
  })
})

describe('regular invoices', () => {
  const on = '2026-10-18'
  it('tell who is due, drafted, done or not yet this period', () => {
    const customers = [
      customer('due', { every: 'month', day: 1 }),
      customer('draft', { every: 'month', day: 1 }),
      customer('done', { every: 'month', day: 1 }),
      customer('later', { every: 'month', day: 25 }),
      customer('quarter', { every: 'quarter', day: 5 }),
      customer('none'),
    ]
    const invoices = [
      inv('due', '2026-09-01'), inv('due', '2026-10-02', 'cancelled'),
      inv('draft', '2026-09-01'), inv('draft', '2026-10-10', 'draft'),
      inv('done', '2026-10-03', 'paid'),
      inv('quarter', '2026-07-05'),
    ]
    const r = recurringStatus(customers, invoices, on)
    expect(r.map((i) => [i.customer.id, i.state, i.from])).toEqual([
      ['due', 'due', '2026-10-01'], ['quarter', 'due', '2026-10-05'], ['draft', 'draft', '2026-10-01'],
      ['later', 'upcoming', '2026-10-25'], ['done', 'done', '2026-10-01'],
    ])
    expect(r.find((i) => i.customer.id === 'due')!.last!.issueDate).toBe('2026-09-01')
  })
})
