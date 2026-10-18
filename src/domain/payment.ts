import { totalCzk } from './invoice'
import type { Invoice } from './schema'

/**
 * The most one payer may pay one recipient in cash in a day (zákon č. 254/2004 Sb., o omezení plateb v hotovosti),
 * CZK minor units. Anything above must go through a bank. See docs/czech-rules.md.
 */
export const CASH_LIMIT = 27_000_000

/** The account, IBAN, payment reference and QR Platba belong only on invoices paid by bank transfer. */
export const paysByBank = (inv: Pick<Invoice, 'paymentMethod'>) => inv.paymentMethod === 'bank'

/** A cash invoice above the legal limit; a foreign-currency one without a rate can't be checked and isn't flagged. */
export const overCashLimit = (inv: Invoice) => inv.paymentMethod === 'cash' && (totalCzk(inv) ?? 0) > CASH_LIMIT

/** A cash receipt can be printed once a cash invoice is paid. */
export const hasReceipt = (inv: Invoice) => inv.paymentMethod === 'cash' && inv.status === 'paid'

/** The receipt's number is the invoice's with a "P" in front, so each paid cash invoice has exactly one receipt. */
export const receiptNumber = (inv: Pick<Invoice, 'number'>) => `P${inv.number}`
