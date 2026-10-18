import { pdf } from '@react-pdf/renderer'
import QRCode from 'qrcode'
import { createElement } from 'react'
import type { Invoice, Settings } from '@/domain/schema'
import { paysByBank } from '@/domain/payment'
import { spayd } from '@/domain/spayd'
import { amountDue } from '@/domain/invoice'
import { InvoiceDocument } from './InvoiceDocument'
import { invoiceLabels } from './labels'
import { DeliveryNoteDocument } from './DeliveryNoteDocument'
import { ReceiptDocument } from './ReceiptDocument'

// Loaded lazily (see pdf/index.ts): the PDF engine is large and only needed when an invoice is rendered.

/** QR Platba only makes sense for CZK payments to an account with an IBAN. */
export async function qrFor(inv: Invoice, settings: Settings): Promise<string | undefined> {
  const iban = settings.supplier.bank.iban
  if (!iban || !paysByBank(inv) || inv.currency !== 'CZK' || inv.status === 'paid') return undefined
  const amount = amountDue(inv)
  if (amount <= 0) return undefined
  const text = spayd({ iban, amount, currency: inv.currency, vs: inv.variableSymbol, dueDate: inv.dueDate, message: `${invoiceLabels[inv.language].invoice} ${inv.number}` })
  return QRCode.toDataURL(text, { errorCorrectionLevel: 'M', margin: 0, width: 360 })
}

export async function renderInvoicePdf(invoice: Invoice, settings: Settings): Promise<Blob> {
  const qr = await qrFor(invoice, settings)
  return pdf(createElement(InvoiceDocument, { invoice, settings, qr }) as Parameters<typeof pdf>[0]).toBlob()
}

export async function renderReceiptPdf(invoice: Invoice, settings: Settings): Promise<Blob> {
  return pdf(createElement(ReceiptDocument, { invoice, settings }) as Parameters<typeof pdf>[0]).toBlob()
}

export async function renderDeliveryNotePdf(invoice: Invoice, settings: Settings): Promise<Blob> {
  return pdf(createElement(DeliveryNoteDocument, { invoice, settings }) as Parameters<typeof pdf>[0]).toBlob()
}
