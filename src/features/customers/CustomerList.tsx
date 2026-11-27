import { Plus, Search } from 'lucide-react'
import { useDeferredValue, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { today } from '@/domain/id'
import { longUninvoiced } from '@/domain/invoice'
import { customerStats, emptyCustomerStats } from '@/domain/stats'
import { useStore } from '@/state/store'
import { Money, useFormat } from '@/ui/format'
import { Button, Card, Checkbox, Input } from '@/ui/primitives'
import { navigate } from '@/ui/router'
import { paidParts } from './CustomerDetail'

export function CustomerList() {
  const { t } = useTranslation()
  const f = useFormat()
  const { customers, invoices } = useStore()
  const [search, setSearch] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  // "Dlouho nefakturovaní": invoiced at least twice before, nothing in the last three months (domain/invoice.ts).
  const [quiet, setQuiet] = useState(false)
  const quietIds = useMemo(() => new Map(longUninvoiced(customers, invoices, today()).map((r, i) => [r.customer.id, i])), [customers, invoices])
  const q = useDeferredValue(search.trim().toLowerCase())

  const rows = useMemo(() => {
    const stats = customerStats(invoices)
    return customers
      .filter((c) => (showArchived || !c.archived) && (!quiet || quietIds.has(c.id))
        && (!q || c.name.toLowerCase().includes(q) || c.ic.includes(q) || c.address.city.toLowerCase().includes(q)))
      .map((c) => ({ c, s: stats.get(c.id) ?? emptyCustomerStats() }))
      // Quiet ones longest silence first; otherwise the most recently invoiced first.
      .sort((a, b) => (quiet ? quietIds.get(a.c.id)! - quietIds.get(b.c.id)! : b.s.last.localeCompare(a.s.last) || a.c.name.localeCompare(b.c.name)))
  }, [customers, invoices, q, showArchived, quiet, quietIds])

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <h1 className="font-display text-3xl leading-[1.2] font-semibold">{t('customers.title')}</h1>
        <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2">
          <Button onClick={() => navigate('/customers/new')}><Plus className="size-4" /> {t('customers.newCustomer')}</Button>
          <Checkbox label={t('customers.quiet', { count: quietIds.size })} checked={quiet} onChange={(e) => setQuiet(e.target.checked)} />
          <Checkbox label={t('customers.showArchived')} checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
        </div>
      </div>
      <div className="relative">
        <Search className="absolute top-3 left-3 size-4 text-fg-subtle" />
        <Input className="pl-9" aria-label={t('customers.search')} placeholder={t('customers.search')} value={search} onChange={(e) => setSearch(e.target.value)} autoFocus />
      </div>
      <Card className="overflow-x-auto">
        <table className="w-full text-sm leading-label max-md:min-w-[36rem]">
          <thead className="bg-surface-2 text-left text-xs whitespace-nowrap text-fg-muted">
            <tr>
              <th className="py-2.5 pr-4 pl-6 font-medium">{t('fields.name')}</th>
              <th className="px-4 py-2.5 font-medium">{t('fields.ic')}</th>
              <th className="px-4 py-2.5 font-medium">{t('fields.city')}</th>
              <th className="px-4 py-2.5 text-right font-medium">{t('customers.paidCount')}</th>
              <th className="px-4 py-2.5 text-right font-medium">{t('customers.paid')}</th>
              <th className="py-2.5 pr-6 pl-4 text-right font-medium">{t('customers.lastInvoice')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ c, s }) => (
              // The same type as the invoice table: the name 500 and the paid figure 600, the count in plain ink, the rest
              // muted; cells top-aligned, so the e-mail hangs under the first line.
              <tr key={c.id} onClick={() => navigate(`/customers/${c.id}`)} className="group cursor-pointer border-t border-rule align-top transition-colors hover:bg-tint">
                <td className="w-full max-w-0 py-3 pr-4 pl-6">
                  <div className="truncate font-medium" title={c.name}>{c.name} {c.archived && <span className="ml-1 text-xs font-normal text-fg-muted">({t('customers.archived')})</span>}</div>
                  {c.email && <div className="mt-0.5 truncate text-xs text-fg-muted">{c.email}</div>}
                </td>
                <td className="px-4 py-3 whitespace-nowrap tabular-nums text-fg-muted">{c.ic}</td>
                <td className="px-4 py-3 whitespace-nowrap text-fg-muted">{c.address.city}</td>
                <td className="px-4 py-3 text-right tabular-nums">{s.paidCount}</td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  {paidParts(s).map(([cur, v], i) => <span key={cur}>{i > 0 && <span className="text-fg-muted"> + </span>}<Money minor={v} currency={cur} /></span>)}
                </td>
                {/* "Nová faktura" shares the last cell (no empty column at the right edge) and shows on hover or keyboard focus as
                    a one-line accent link, not a box that blends into the hovered row (the owner, 2026-10-17). */}
                {/* The date is right-aligned with tabular digits like the dates of the invoice table; the link comes before it. */}
                <td className="py-3 pr-6 pl-4">
                  <div className="flex items-center justify-end gap-4">
                    <a href={`#/invoices/new?customer=${c.id}`} onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1 text-sm font-medium whitespace-nowrap text-link opacity-0 group-hover:opacity-100 hover:underline focus-visible:opacity-100">
                      <Plus className="size-4" /> {t('customers.newInvoice')}
                    </a>
                    <span className="whitespace-nowrap tabular-nums text-fg-muted">{f.date(s.last || undefined)}</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
