import { Plus, Search } from 'lucide-react'
import { useDeferredValue, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { totalCzk } from '@/domain/invoice'
import { useStore } from '@/state/store'
import { useFormat } from '@/ui/format'
import { Button, Card, Checkbox, Input } from '@/ui/primitives'
import { navigate } from '@/ui/router'

export function CustomerList() {
  const { t } = useTranslation()
  const f = useFormat()
  const { customers, invoices } = useStore()
  const [search, setSearch] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const q = useDeferredValue(search.trim().toLowerCase())

  const rows = useMemo(() => {
    const stats = new Map<string, { count: number; revenue: number; last: string }>()
    for (const inv of invoices) {
      if (!inv.customerId || inv.status === 'cancelled' || inv.status === 'draft') continue
      const s = stats.get(inv.customerId) ?? { count: 0, revenue: 0, last: '' }
      s.count++
      s.revenue += totalCzk(inv) ?? 0
      if (inv.issueDate > s.last) s.last = inv.issueDate
      stats.set(inv.customerId, s)
    }
    return customers
      .filter((c) => (showArchived || !c.archived) && (!q || c.name.toLowerCase().includes(q) || c.ic.includes(q) || c.address.city.toLowerCase().includes(q)))
      .map((c) => ({ c, s: stats.get(c.id) ?? { count: 0, revenue: 0, last: '' } }))
      .sort((a, b) => b.s.last.localeCompare(a.s.last) || a.c.name.localeCompare(b.c.name))
  }, [customers, invoices, q, showArchived])

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-4xl leading-[1.2] font-bold tracking-[-0.03em]">{t('customers.title')}</h1>
        <div className="flex items-center gap-4">
          <Checkbox label={t('customers.showArchived')} checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
          <Button onClick={() => navigate('/customers/new')}><Plus className="size-4" /> {t('customers.newCustomer')}</Button>
        </div>
      </div>
      <div className="relative">
        <Search className="absolute top-3 left-3 size-4 text-fg-subtle" />
        <Input className="pl-9" aria-label={t('customers.search')} placeholder={t('customers.search')} value={search} onChange={(e) => setSearch(e.target.value)} autoFocus />
      </div>
      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-fg-muted">
            <tr>
              <th className="px-4 py-2.5 font-medium">{t('fields.name')}</th>
              <th className="px-4 py-2.5 font-medium">{t('fields.ic')}</th>
              <th className="px-4 py-2.5 font-medium">{t('fields.city')}</th>
              <th className="px-4 py-2.5 text-right font-medium">{t('customers.invoiceCount')}</th>
              <th className="px-4 py-2.5 text-right font-medium">{t('customers.revenue')}</th>
              <th className="py-2.5 pr-5 pl-4 font-medium">{t('customers.lastInvoice')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ c, s }) => (
              <tr key={c.id} onClick={() => navigate(`/customers/${c.id}`)} className="group cursor-pointer transition-colors even:bg-row-hover hover:bg-surface-2">
                <td className="px-4 py-3">
                  <div className="font-medium">{c.name} {c.archived && <span className="ml-1 text-xs font-normal text-fg-subtle">({t('customers.archived')})</span>}</div>
                  <div className="text-xs text-fg-subtle">{c.email}</div>
                </td>
                <td className="px-4 py-3 tabular-nums text-fg-muted">{c.ic}</td>
                <td className="px-4 py-3 text-fg-muted">{c.address.city}</td>
                <td className="px-4 py-3 text-right tabular-nums">{s.count}</td>
                <td className="px-4 py-3 text-right tabular-nums">{f.money(s.revenue)}</td>
                {/* "Nová faktura" shares the last cell (no empty column at the right edge) and shows on hover or keyboard focus as
                    a one-line accent link, not a box that blends into the hovered row (the owner, 2026-10-17). */}
                <td className="py-3 pr-5 pl-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="whitespace-nowrap text-fg-muted">{f.date(s.last || undefined)}</span>
                    <a href={`#/invoices/new?customer=${c.id}`} onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1 text-sm font-medium whitespace-nowrap text-accent opacity-0 group-hover:opacity-100 hover:underline focus-visible:opacity-100">
                      <Plus className="size-4" /> {t('customers.newInvoice')}
                    </a>
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
