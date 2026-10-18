import { describe, expect, it } from 'vitest'
import { newInvoice } from '@/domain/invoice'
import { SCHEMA_VERSION, Settings } from '@/domain/schema'
import { pdfPath } from './index'
import { qrFor, renderDeliveryNotePdf, renderInvoicePdf, renderReceiptPdf } from './render'

const settings = Settings.parse({
  schemaVersion: SCHEMA_VERSION,
  supplier: { name: 'Jan Testovací', ic: '12345678', address: { street: 'Příčná 12', zip: '110 00', city: 'Praha 1', country: 'Česká republika' },
    bank: { account: '19-2000145399', bankCode: '0800', iban: 'CZ6508000000192000145399' } },
  vatMode: 'nonPayer',
})
const invoice = {
  ...newInvoice(settings, [], undefined, '2026-09-30'),
  status: 'issued' as const,
  customerSnapshot: { name: 'Šťastný zákazník s.r.o.', ic: '01234567', dic: '', address: { street: 'Řeznická 1', zip: '110 00', city: 'Praha', country: '' } },
  lines: [{ description: 'Správa PPC kampaní – září', quantity: 1, unit: '', unitPrice: 1450000, vatRate: 0 }],
}

describe('invoice PDF', () => {
  it('renders a non-payer invoice with a QR code', async () => {
    expect(await qrFor(invoice, settings)).toMatch(/^data:image\/png;base64,/)
    const blob = await renderInvoicePdf(invoice, settings)
    const head = new TextDecoder().decode((await blob.arrayBuffer()).slice(0, 5))
    expect(head).toBe('%PDF-')
    expect(blob.size).toBeGreaterThan(5000)
  })

  it('renders a VAT payer invoice in English', async () => {
    const payer = { ...settings, vatMode: 'payer' as const }
    const inv = { ...invoice, language: 'en' as const, vatMode: 'payer' as const, taxableSupplyDate: '2026-09-30',
      lines: [{ description: 'Consulting', quantity: 2.5, unit: 'h', unitPrice: 120000, vatRate: 21 }] }
    expect((await renderInvoicePdf(inv, payer)).size).toBeGreaterThan(5000)
  })

  it('skips the QR code for foreign currencies and paid invoices', async () => {
    expect(await qrFor({ ...invoice, currency: 'EUR' }, settings)).toBeUndefined()
    expect(await qrFor({ ...invoice, status: 'paid' }, settings)).toBeUndefined()
  })

  it('stores PDFs by year, the cash receipt next to its invoice', () => {
    expect(pdfPath(invoice)).toBe('pdf/2026/20260001.pdf')
    expect(pdfPath(invoice, 'receipt')).toBe('pdf/2026/P20260001.pdf')
  })

  it('prints no QR code for cash or cash on delivery', async () => {
    expect(await qrFor({ ...invoice, paymentMethod: 'cash' }, settings)).toBeUndefined()
    expect(await qrFor({ ...invoice, paymentMethod: 'cod' }, settings)).toBeUndefined()
    expect((await renderInvoicePdf({ ...invoice, paymentMethod: 'cash' }, settings)).size).toBeGreaterThan(5000)
  })

  it('renders a credit note without a QR code', async () => {
    const credit = { ...invoice, kind: 'creditNote' as const, number: 'D20260001', correctsNumber: '20260001', correctionReason: 'Sleva za zpoždění',
      lines: [{ description: 'Sleva', quantity: 1, unit: '', unitPrice: -200000, vatRate: 0 }] }
    expect(await qrFor(credit, settings)).toBeUndefined()
    expect((await renderInvoicePdf(credit, settings)).size).toBeGreaterThan(5000)
  })

  it('renders a proforma with a QR code, and a final invoice whose QR asks only for the balance', async () => {
    const proforma = { ...invoice, kind: 'proforma' as const, number: 'Z20260001' }
    expect(await qrFor(proforma, settings)).toMatch(/^data:image\/png;base64,/)
    expect((await renderInvoicePdf(proforma, settings)).size).toBeGreaterThan(5000)
    const final = { ...invoice, advanceId: 'p1', advanceNumber: 'Z20260001', advanceAmount: 1450000 }
    expect(await qrFor(final, settings)).toBeUndefined()
    expect((await renderInvoicePdf(final, settings)).size).toBeGreaterThan(5000)
  })

  it('renders a payer’s tax document for an advance and the final invoice that deducts it', async () => {
    const payer = { ...settings, vatMode: 'payer' as const }
    const base = { ...invoice, vatMode: 'payer' as const, lines: [{ description: 'Web', quantity: 1, unit: '', unitPrice: 1000000, vatRate: 21 }] }
    const doc = { ...base, kind: 'advanceTaxDoc' as const, number: 'ZD20260001', advanceNumber: 'Z20260001', taxableSupplyDate: '2026-09-25', status: 'paid' as const, paidDate: '2026-09-25' }
    expect(await qrFor(doc, payer)).toBeUndefined()
    expect((await renderInvoicePdf(doc, payer)).size).toBeGreaterThan(5000)
    const final = { ...base, taxableSupplyDate: '2026-09-30', advanceId: 'p1', advanceNumber: 'Z20260001', advanceAmount: 1210000,
      advanceTaxDocNumber: 'ZD20260001', advanceVat: [{ rate: 21, base: 1000000, vat: 210000 }] }
    expect((await renderInvoicePdf(final, payer)).size).toBeGreaterThan(5000)
  })

  it('renders a delivery note and stores it next to its invoice', async () => {
    expect((await renderDeliveryNotePdf({ ...invoice, orderNumber: 'OBJ-7' }, settings)).size).toBeGreaterThan(5000)
    expect(pdfPath(invoice, 'deliveryNote')).toBe('pdf/2026/DL20260001.pdf')
  })

  it('renders invoices in German and Slovak', async () => {
    for (const language of ['de', 'sk'] as const) expect((await renderInvoicePdf({ ...invoice, language }, settings)).size).toBeGreaterThan(5000)
  })

  it('renders the chosen colour, logo, stamp and footer', async () => {
    const pixel = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
    const styled = { ...settings, invoice: { color: 'teal' as const, logo: pixel, stamp: pixel, footer: 'Děkuji za spolupráci · example.cz' } }
    // Paid, so neither has a QR code and the pictures and footer make the difference.
    const paid = { ...invoice, status: 'paid' as const, paidDate: '2026-10-01' }
    const plain = await renderInvoicePdf(paid, settings)
    const withLook = await renderInvoicePdf(paid, styled)
    expect(withLook.size).toBeGreaterThan(plain.size)
    expect((await renderReceiptPdf({ ...invoice, paymentMethod: 'cash', status: 'paid', paidDate: '2026-10-01' }, styled)).size).toBeGreaterThan(5000)
  })

  it('renders a cash receipt, also for a VAT payer', async () => {
    const paid = { ...invoice, paymentMethod: 'cash' as const, status: 'paid' as const, paidDate: '2026-10-01', paidAmount: 1450000 }
    const head = new TextDecoder().decode((await (await renderReceiptPdf(paid, settings)).arrayBuffer()).slice(0, 5))
    expect(head).toBe('%PDF-')
    const payer = { ...paid, vatMode: 'payer' as const, lines: [{ description: 'Konzultace', quantity: 1, unit: '', unitPrice: 100000, vatRate: 21 }] }
    expect((await renderReceiptPdf(payer, { ...settings, vatMode: 'payer' })).size).toBeGreaterThan(5000)
  })
})
