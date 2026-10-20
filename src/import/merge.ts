import { nameKey, normalizeIc } from '@/domain/id'
import type { Customer, Invoice } from '@/domain/schema'

interface Data { customers: Customer[]; invoices: Invoice[] }

export interface MergeOutcome extends Data {
  /** Customers and documents the import adds. */
  addedCustomers: number
  addedInvoices: number
  /** Documents already in Invojka (the same kind and number), left as they are. */
  skipped: number
}

/**
 * An import added to data already in Invojka (Settings → Import), so history can be loaded later or from a second
 * export. A customer with the same IČ, or without one the same name, is the one already there; a document with the same
 * kind and number is already there and is skipped, so loading one export twice changes nothing. Links between the
 * imported documents (a final invoice's proforma, a credit note's invoice) follow to the documents they end up as.
 */
export function mergeImport(current: Data, imported: Data): MergeOutcome {
  const byIc = new Map<string, string>(), byName = new Map<string, string>()
  for (const c of current.customers) {
    if (c.ic) byIc.set(normalizeIc(c.ic), c.id)
    byName.set(nameKey(c.name), c.id)
  }
  const customerId = new Map<string, string>()
  const customers = [...current.customers]
  for (const c of imported.customers) {
    const same = (c.ic && byIc.get(normalizeIc(c.ic))) || byName.get(nameKey(c.name))
    if (same) { customerId.set(c.id, same); continue }
    customers.push(c)
    if (c.ic) byIc.set(normalizeIc(c.ic), c.id)
    byName.set(nameKey(c.name), c.id)
  }

  const key = (i: Invoice) => `${i.kind}:${i.number}`
  const existing = new Map(current.invoices.map((i) => [key(i), i.id]))
  const invoiceId = new Map<string, string>()
  const added: Invoice[] = []
  for (const inv of imported.invoices) {
    const same = existing.get(key(inv))
    if (same) invoiceId.set(inv.id, same)
    else { added.push(inv); existing.set(key(inv), inv.id) }
  }
  const link = (id: string | undefined) => (id && invoiceId.get(id)) || id
  const invoices = [...current.invoices, ...added.map((inv) => ({
    ...inv,
    customerId: inv.customerId && (customerId.get(inv.customerId) ?? inv.customerId),
    ...(inv.advanceId && { advanceId: link(inv.advanceId) }),
    ...(inv.correctsId && { correctsId: link(inv.correctsId) }),
  }))]
  return {
    customers, invoices,
    addedCustomers: customers.length - current.customers.length,
    addedInvoices: added.length,
    skipped: imported.invoices.length - added.length,
  }
}
