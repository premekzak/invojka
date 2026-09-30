import { describe, expect, it } from 'vitest'
import { newInvoice } from '@/domain/invoice'
import { SCHEMA_VERSION, Settings } from '@/domain/schema'
import { pdfPath } from './index'
import { qrFor, renderInvoicePdf } from './render'

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

  it('stores PDFs by year', () => {
    expect(pdfPath(invoice)).toBe('pdf/2026/20260001.pdf')
  })
})
