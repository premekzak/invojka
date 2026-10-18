import { receiptNumber } from '@/domain/payment'
import type { Invoice, Settings } from '@/domain/schema'

export type PdfKind = 'invoice' | 'receipt' | 'deliveryNote'

const safe = (name: string) => name.replace(/[\\/:*?"<>|]/g, '-')

/**
 * Path of an invoice's PDF inside the data folder, e.g. pdf/2026/20260009.pdf; its cash receipt is pdf/2026/P20260009.pdf
 * and its delivery note pdf/2026/DL20260009.pdf.
 */
export const pdfPath = (inv: Invoice, kind: PdfKind = 'invoice') =>
  `pdf/${inv.issueDate.slice(0, 4)}/${safe(kind === 'receipt' ? receiptNumber(inv) : kind === 'deliveryNote' ? `DL${inv.number}` : inv.number)}.pdf`

export const renderInvoicePdf = async (inv: Invoice, settings: Settings) => (await import('./render')).renderInvoicePdf(inv, settings)
export const renderReceiptPdf = async (inv: Invoice, settings: Settings) => (await import('./render')).renderReceiptPdf(inv, settings)
export const renderDeliveryNotePdf = async (inv: Invoice, settings: Settings) => (await import('./render')).renderDeliveryNotePdf(inv, settings)
export const renderPdf = (inv: Invoice, settings: Settings, kind: PdfKind = 'invoice') =>
  kind === 'receipt' ? renderReceiptPdf(inv, settings) : kind === 'deliveryNote' ? renderDeliveryNotePdf(inv, settings) : renderInvoicePdf(inv, settings)
