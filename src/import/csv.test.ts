import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { InvoicesFile, CustomersFile, SCHEMA_VERSION } from '@/domain/schema'
import { computeTotals } from '@/domain/vat'
import { importCsv, usDate } from './csv'
import { fixtureCustomersCsv, fixtureInvoicesCsv } from './fixture'

it('converts US dates', () => {
  expect(usDate('09/06/2026')).toBe('2026-09-06')
  expect(usDate('1/2/2014')).toBe('2014-01-02')
  expect(usDate('')).toBeUndefined()
})

describe('import of the export format (made-up fixture)', () => {
  let n = 0
  const res = importCsv(fixtureCustomersCsv, fixtureInvoicesCsv, 'nonPayer', () => `id${++n}`)

  it('imports every invoice and the produced files are schema-valid', () => {
    expect(res.invoices).toHaveLength(5)
    expect(res.warnings).toEqual([])
    InvoicesFile.parse({ schemaVersion: SCHEMA_VERSION, invoices: res.invoices })
    CustomersFile.parse({ schemaVersion: SCHEMA_VERSION, customers: res.customers })
  })

  it('merges duplicate customers and cleans up names and IČ', () => {
    expect(res.merges).toEqual([
      { kept: 'Orion Travel', merged: ['Orion Travel, s.r.o.'] },
      { kept: 'Sokol media, s.r.o.', merged: ['Sokol media, s.r.o.'] },
    ])
    expect(res.customers.find((c) => c.name === 'Sokol media, s.r.o.')?.ic).toBe('12345678')
  })

  it('keeps different companies sharing a VAT group DIČ separate', () => {
    const group = res.customers.filter((c) => c.dic === 'CZ699999999').map((c) => c.name)
    expect(group).toEqual(['Alfa Sázky a.s.', 'Beta Tip a.s.', 'Gama Los s.r.o.'])
  })

  it('links every invoice to an existing customer, ignoring the legal form', () => {
    expect(res.createdFromInvoices).toEqual([])
    const byId = new Map(res.customers.map((c) => [c.id, c.name]))
    expect(byId.get(res.invoices.find((i) => i.number === '20260001')!.customerId!)).toBe('Gama Los s.r.o.')
  })

  it('keeps totals and payment state', () => {
    const inv = res.invoices.find((i) => i.number === '20260003')!
    expect(inv).toMatchObject({ issueDate: '2026-09-06', dueDate: '2026-09-20', currency: 'CZK', status: 'issued', recordedTotal: 1450000 })
    expect(computeTotals(inv.lines, inv.vatMode).total).toBe(1450000)
    const old = res.invoices.find((i) => i.number === '20150001')!
    expect(old).toMatchObject({ status: 'paid', paidDate: '2015-04-08', paidAmount: 150000, currency: 'NZD' })
    expect(new Set(res.invoices.map((i) => i.currency))).toEqual(new Set(['CZK', 'NZD', 'EUR']))
  })
})

// The owner's real export is git-ignored (client data). When it's present locally, check it still imports cleanly.
const realFile = (f: string) => new URL(`../../${f}`, import.meta.url)
const hasReal = existsSync(realFile('customers.csv')) && existsSync(realFile('invoices.csv'))

describe.skipIf(!hasReal)('import of the real export (local only)', () => {
  const read = (f: string) => readFileSync(realFile(f), 'utf8')
  let n = 0
  // skipIf still runs this body to collect the tests, so only import when the files exist.
  const res = hasReal ? importCsv(read('customers.csv'), read('invoices.csv'), 'nonPayer', () => `id${++n}`) : undefined!

  it('imports without warnings into schema-valid files', () => {
    expect(res.invoices.length).toBeGreaterThan(0)
    expect(res.warnings).toEqual([])
    InvoicesFile.parse({ schemaVersion: SCHEMA_VERSION, invoices: res.invoices })
    CustomersFile.parse({ schemaVersion: SCHEMA_VERSION, customers: res.customers })
  })

  it('links every invoice to an existing customer', () => {
    expect(res.createdFromInvoices).toEqual([])
    const ids = new Set(res.customers.map((c) => c.id))
    expect(res.invoices.every((i) => ids.has(i.customerId!))).toBe(true)
  })

  it('keeps each invoice total equal to the recorded total', () => {
    for (const i of res.invoices) expect(computeTotals(i.lines, i.vatMode).total).toBe(i.recordedTotal)
  })
})
