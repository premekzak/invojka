import type { Invoice, Settings } from '@/domain/schema'

/** Path of an invoice's PDF inside the data folder, e.g. pdf/2026/20260009.pdf */
export const pdfPath = (inv: Invoice) => `pdf/${inv.issueDate.slice(0, 4)}/${inv.number.replace(/[\\/:*?"<>|]/g, '-')}.pdf`

export const renderInvoicePdf = async (inv: Invoice, settings: Settings) => (await import('./render')).renderInvoicePdf(inv, settings)
