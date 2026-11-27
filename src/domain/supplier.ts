import type { Invoice, Settings } from './schema'

export type SupplierDetail = 'ic' | 'street' | 'city' | 'account'

/**
 * What an invoice needs from the supplier's own details and doesn't have yet. The bank account counts only when a
 * payment method is given and it is a bank transfer: a cash invoice doesn't need one.
 */
export function missingSupplierDetails(settings: Settings, paymentMethod?: Invoice['paymentMethod']): SupplierDetail[] {
  const s = settings.supplier
  return [
    !s.ic && 'ic',
    !s.address.street && 'street',
    !s.address.city && 'city',
    paymentMethod === 'bank' && !s.bank.account && !s.bank.iban && 'account',
  ].filter((x): x is SupplierDetail => !!x)
}
