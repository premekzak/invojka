import { describe, expect, it } from 'vitest'
import { checkData } from './check'
import { advanceTaxDocDeadline, advanceTaxDocOf, amountDue, invoiceTotals, issuedStatus, newAdvanceTaxDoc, newFinalInvoice, newInvoice, withKind } from './invoice'
import { SCHEMA_VERSION, Settings, type Invoice } from './schema'
import { homeStats } from './stats'
import { netFromGross } from './vat'

const settings = Settings.parse({ schemaVersion: SCHEMA_VERSION, supplier: { name: 'Test' }, vatMode: 'payer' })
const customer = { id: 'c1', name: 'Acme', ic: '', dic: '', address: { street: '', zip: '', city: '', country: '' }, email: '', cc: [], phone: '', web: '', contactName: '', reverseCharge: false, note: '', archived: false }
const proforma: Invoice = {
  ...withKind(newInvoice(settings, [], customer, '2026-10-01'), 'proforma', settings, []),
  lines: [{ description: 'Web', quantity: 1, unit: '', unitPrice: 10_000_00, vatRate: 21 }],
  status: 'paid', paidDate: '2026-10-05', paidAmount: 12_100_00,
}

describe('VAT payer advances', () => {
  it('turn gross into a base whose VAT adds up to the haléř', () => {
    expect(netFromGross(10_000_00, 21)).toBe(826_446) // the VAT act's example: 10 000 Kč → 1 735,54 Kč VAT
    for (const gross of [1, 99, 12_345_67, 10_000_00, 7_777_77]) for (const rate of [21, 12, 0]) {
      const base = netFromGross(gross, rate)
      expect(invoiceTotals({ ...proforma, lines: [{ description: '', quantity: 1, unit: '', unitPrice: base, vatRate: rate }] }).total).toBe(gross)
    }
  })

  it('get a tax document dated by the payment, due within 15 days', () => {
    const doc = newAdvanceTaxDoc(settings, [proforma], proforma, '2026-10-08')
    expect(doc).toMatchObject({ kind: 'advanceTaxDoc', number: 'ZD20260001', advanceId: proforma.id, advanceNumber: proforma.number, taxableSupplyDate: '2026-10-05', issueDate: '2026-10-08', status: 'draft' })
    expect(invoiceTotals(doc)).toMatchObject({ base: 10_000_00, vat: 2_100_00, total: 12_100_00 })
    expect(advanceTaxDocDeadline(proforma)).toBe('2026-10-20')
    expect(issuedStatus(doc, [proforma])).toEqual({ status: 'paid', paidDate: '2026-10-05', paidAmount: 12_100_00 })
  })

  it('split a partial advance over the proforma’s rates', () => {
    const mixed = { ...proforma, paidAmount: 5_000_00, lines: [
      { description: 'A', quantity: 1, unit: '', unitPrice: 10_000_00, vatRate: 21 },
      { description: 'B', quantity: 1, unit: '', unitPrice: 10_000_00, vatRate: 12 },
    ] }
    const doc = newAdvanceTaxDoc(settings, [mixed], mixed, '2026-10-08')
    expect(doc.lines.map((l) => l.vatRate)).toEqual([21, 12])
    // Base and VAT are whole haléře at each rate, so the total can miss the money received by a haléř at most.
    expect(Math.abs(invoiceTotals(doc).total - 5_000_00)).toBeLessThanOrEqual(1)
  })

  it('lead to a final invoice that deducts the advance with its VAT; the tax document is no revenue', () => {
    const doc = { ...newAdvanceTaxDoc(settings, [proforma], proforma, '2026-10-08'), status: 'paid' as const, paidDate: '2026-10-05', paidAmount: 12_100_00 }
    expect(advanceTaxDocOf([proforma, doc], proforma.id)?.id).toBe(doc.id)
    const final = newFinalInvoice(settings, [proforma, doc], proforma, '2026-10-30')
    expect(final).toMatchObject({ advanceAmount: 12_100_00, advanceTaxDocNumber: 'ZD20260001', advanceVat: [{ rate: 21, base: 10_000_00, vat: 2_100_00 }], taxableSupplyDate: '2026-10-30' })
    expect(amountDue(final)).toBe(0)
    const issued = { ...final, ...issuedStatus(final, [proforma, doc]) }
    expect(homeStats([proforma, doc, issued], '2026-12-31')).toMatchObject({ revenue: 12_100_00, countThisYear: 1, outstanding: 0 })
    expect(checkData({ settings, customers: [customer], invoices: [proforma, doc, issued] }).filter((i) => i.level === 'error')).toEqual([])
  })

  it('warn about a tax document issued after the 15 days', () => {
    const late = { ...newAdvanceTaxDoc(settings, [proforma], proforma, '2026-10-25'), status: 'paid' as const, paidDate: '2026-10-05', paidAmount: 12_100_00 }
    expect(checkData({ settings, customers: [customer], invoices: [proforma, late] }).map((i) => i.code)).toContain('advanceTaxDoc.late')
  })
})
