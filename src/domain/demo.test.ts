import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { importCsv } from '@/import/csv'
import { fixtureCustomersCsv, fixtureInvoicesCsv } from '@/import/fixture'
import { anonymize } from './demo'
import { CustomersFile, InvoicesFile, SCHEMA_VERSION, Settings } from './schema'
import { computeTotals } from './vat'

// Runs on the made-up fixture everywhere, and also on the owner's real export when it's present locally.
const realFile = (f: string) => new URL(`../../${f}`, import.meta.url)
const sources: [string, string, string][] = [['fixture', fixtureCustomersCsv, fixtureInvoicesCsv]]
if (existsSync(realFile('customers.csv')) && existsSync(realFile('invoices.csv')))
  sources.push(['real export', readFileSync(realFile('customers.csv'), 'utf8'), readFileSync(realFile('invoices.csv'), 'utf8')])

describe.each(sources)('demo mode anonymizes the %s', (_, customersCsv, invoicesCsv) => {
  let n = 0
  const real = importCsv(customersCsv, invoicesCsv, 'nonPayer', () => `id${++n}`)
  const settings = Settings.parse({
    schemaVersion: SCHEMA_VERSION, vatMode: 'nonPayer',
    supplier: { name: 'Skutečný Dodavatel', ic: '12345678', email: 'real@firma.cz', bank: { account: '2400123456', bankCode: '2010' } },
    defaults: { note: 'Děkuji za spolupráci, Skutečný Dodavatel' },
  })
  const input = { settings, customers: real.customers, invoices: real.invoices }
  const demo = anonymize(input)

  it('produces schema-valid data of the same size', () => {
    CustomersFile.parse({ schemaVersion: SCHEMA_VERSION, customers: demo.customers })
    InvoicesFile.parse({ schemaVersion: SCHEMA_VERSION, invoices: demo.invoices })
    Settings.parse(demo.settings)
    expect(demo.invoices).toHaveLength(real.invoices.length)
    expect(demo.customers.map((c) => c.id)).toEqual(real.customers.map((c) => c.id))
  })

  it('leaves no real name, IČ, email or description anywhere', () => {
    const text = JSON.stringify(demo)
    const secrets = [
      settings.supplier.name, settings.supplier.email, settings.supplier.bank.account, 'Skutečný',
      ...real.customers.flatMap((c) => [c.name, c.ic, c.email, c.address.street]),
      ...real.invoices.flatMap((i) => i.lines.map((l) => l.description)),
    ].filter((s) => s.length >= 4)
    for (const s of new Set(secrets)) expect(text, s).not.toContain(s)
  })

  it('keeps dates, numbers and statuses', () => {
    demo.invoices.forEach((d, i) => {
      const r = real.invoices[i]!
      expect([d.number, d.issueDate, d.dueDate, d.status, d.currency]).toEqual([r.number, r.issueDate, r.dueDate, r.status, r.currency])
    })
  })

  it('invents amounts that are not derived from the real ones', () => {
    const total = (i: (typeof demo.invoices)[number]) => computeTotals(i.lines, i.vatMode, i.reverseCharge).total
    const ratios = demo.invoices.map((d, i) => total(d) / total(real.invoices[i]!)).filter(Number.isFinite)
    expect(Math.max(...ratios) / Math.min(...ratios)).toBeGreaterThan(1.5) // no single hidden factor
    demo.invoices.forEach((d) => {
      d.lines.forEach((l) => expect(Number.isInteger(l.unitPrice)).toBe(true))
      if (d.paidAmount !== undefined) expect(d.paidAmount).toBe(total(d))
      if (d.currency === 'CZK') expect(total(d)).toBeGreaterThan(100_000) // at least 1 000 Kč
    })
  })

  it('gives each customer one consistent fake identity', () => {
    const byId = new Map(demo.customers.map((c) => [c.id, c.name]))
    expect(demo.invoices.every((i) => i.customerSnapshot.name === byId.get(i.customerId!))).toBe(true)
    expect(new Set(demo.customers.map((c) => c.name)).size).toBe(demo.customers.length)
  })

  it('is deterministic', () => {
    expect(anonymize(input)).toEqual(demo)
  })
})
