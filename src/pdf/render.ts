import { pdf } from '@react-pdf/renderer'
import QRCode from 'qrcode'
import { createElement } from 'react'
import type { Invoice, Settings } from '@/domain/schema'
import { spayd } from '@/domain/spayd'
import { computeTotals } from '@/domain/vat'
import { InvoiceDocument } from './InvoiceDocument'

// Loaded lazily (see pdf/index.ts): the PDF engine is large and only needed when an invoice is rendered.

/** QR Platba only makes sense for CZK payments to an account with an IBAN. */
export async function qrFor(inv: Invoice, settings: Settings): Promise<string | undefined> {
  const iban = settings.supplier.bank.iban
  if (!iban || inv.currency !== 'CZK' || inv.status === 'paid') return undefined
  const amount = computeTotals(inv.lines, inv.vatMode, inv.reverseCharge).total
  if (amount <= 0) return undefined
  const text = spayd({ iban, amount, currency: inv.currency, vs: inv.variableSymbol, dueDate: inv.dueDate, message: `${inv.language === 'cs' ? 'Faktura' : 'Invoice'} ${inv.number}` })
  return QRCode.toDataURL(text, { errorCorrectionLevel: 'M', margin: 0, width: 360 })
}

export async function renderInvoicePdf(invoice: Invoice, settings: Settings): Promise<Blob> {
  const qr = await qrFor(invoice, settings)
  return pdf(createElement(InvoiceDocument, { invoice, settings, qr }) as Parameters<typeof pdf>[0]).toBlob()
}
