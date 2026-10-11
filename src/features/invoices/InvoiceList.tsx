import { Check, Search } from 'lucide-react'
import { useDeferredValue, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { today } from '@/domain/id'
import { daysOverdue, displayStatus, invoiceTotals, type DisplayStatus } from '@/domain/invoice'
import { useStore } from '@/state/store'
import { StatusBadge, useFormat } from '@/ui/format'
import { Button, Card, Input, Select, cn } from '@/ui/primitives'
import { navigate, type Route } from '@/ui/router'

const STATUSES: DisplayStatus[] = ['draft', 'issued', 'overdue', 'paid', 'cancelled']

export function InvoiceList({ route }: { route: Route }) {
  const { t } = useTranslation()
  const f = useFormat()
  const { invoices, upsertInvoice } = useStore()
  const on = today()
  const [search, setSearch] = useState(route.query.get('q') ?? '')
  const [year, setYear] = useState(route.query.get('year') ?? '')
  const status = (route.query.get('status') ?? '') as DisplayStatus | ''
  const customerId = route.query.get('customer')
  const q = useDeferredValue(search.trim().toLowerCase())

  const setStatus = (s: string) => {
    const p = new URLSearchParams(route.query)
    if (s) p.set('status', s)
    else p.delete('status')
    navigate(`/invoices${p.size ? `?${p}` : ''}`)
  }

  const years = useMemo(() => [...new Set(invoices.map((i) => i.issueDate.slice(0, 4)))].sort().reverse(), [invoices])

  const rows = useMemo(() => {
    return invoices
      .map((inv) => ({ inv, status: displayStatus(inv, on), totals: invoiceTotals(inv) }))
      .filter(({ inv, status: s }) =>
        (!year || inv.issueDate.startsWith(year)) &&
        (!status || s === status) &&
        (!customerId || inv.customerId === customerId) &&
        (!q || inv.number.includes(q) || inv.customerSnapshot.name.toLowerCase().includes(q) || inv.lines.some((l) => l.description.toLowerCase().includes(q))))
      .sort((a, b) => b.inv.issueDate.localeCompare(a.inv.issueDate) || b.inv.number.localeCompare(a.inv.number))
  }, [invoices, on, year, status, customerId, q])

  const sumByCurrency = useMemo(() => {
    const m = new Map<string, number>()
    for (const r of rows) m.set(r.inv.currency, (m.get(r.inv.currency) ?? 0) + r.totals.total)
    return [...m.entries()].map(([c, v]) => f.money(v, c)).join(' + ')
  }, [rows, f])

  function markPaid(id: string) {
    const inv = invoices.find((i) => i.id === id)!
    upsertInvoice({ ...inv, status: 'paid', paidDate: on, paidAmount: invoiceTotals(inv).total })
  }

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between">
        <h1 className="font-serif text-4xl leading-[1.2] font-semibold">{t('invoices.title')}</h1>
        <span className="text-sm text-fg-muted">{t('invoices.count', { count: rows.length, total: sumByCurrency || '0' })}</span>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute top-3 left-3 size-4 text-fg-subtle" />
          <Input className="pl-9" aria-label={t('invoices.search')} placeholder={t('invoices.search')} value={search} onChange={(e) => setSearch(e.target.value)} autoFocus />
        </div>
        <Select className="w-auto" aria-label={t('invoices.allYears')} value={year} onChange={(e) => setYear(e.target.value)}>
          <option value="">{t('invoices.allYears')}</option>
          {years.map((y) => <option key={y}>{y}</option>)}
        </Select>
      </div>
      <div className="flex flex-wrap gap-2">
        {(['', ...STATUSES] as const).map((s) => (
          <button key={s} onClick={() => setStatus(s)} className={cn(
            'rounded border px-3 py-1 text-sm transition-colors',
            status === s ? 'border-accent bg-accent text-accent-fg' : 'border-line text-fg-muted hover:border-line-strong',
          )}>
            {s ? t(`status.${s}`) : t('invoices.allStatuses')}
          </button>
        ))}
      </div>

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-line bg-surface-2 text-left text-xs text-fg-muted">
            <tr>
              <th className="px-4 py-2.5 font-medium">{t('invoices.number')}</th>
              <th className="px-4 py-2.5 font-medium">{t('invoices.customer')}</th>
              <th className="px-4 py-2.5 font-medium">{t('invoices.issued')}</th>
              <th className="px-4 py-2.5 font-medium">{t('invoices.due')}</th>
              <th className="px-4 py-2.5 text-right font-medium">{t('invoices.total')}</th>
              <th className="px-4 py-2.5 font-medium">{t('invoices.status')}</th>
              <th />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.slice(0, 300).map(({ inv, status: s, totals }) => (
              <tr key={inv.id} onClick={() => navigate(`/invoices/${inv.id}`)} className="group cursor-pointer transition-colors hover:bg-surface-2">
                <td className="px-4 py-3 tabular-nums text-fg-muted">{inv.number}</td>
                <td className="max-w-xs px-4 py-3">
                  <div className="truncate font-medium">{inv.customerSnapshot.name}</div>
                  <div className="truncate text-xs text-fg-subtle">{inv.lines[0]?.description}</div>
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-fg-muted">{f.date(inv.issueDate)}</td>
                <td className={cn('px-4 py-3 whitespace-nowrap', s === 'overdue' ? 'font-medium text-warning' : 'text-fg-muted')}
                  title={s === 'overdue' ? t('invoices.daysOverdue', { count: daysOverdue(inv, on) }) : undefined}>
                  {f.date(inv.dueDate)}
                </td>
                <td className="px-4 py-3 text-right font-medium whitespace-nowrap tabular-nums">{f.money(totals.total, inv.currency)}</td>
                <td className="px-4 py-3"><StatusBadge status={s} /></td>
                <td className="w-32 px-4 py-2 text-right">
                  {(s === 'issued' || s === 'overdue') && (
                    <Button size="sm" variant="secondary" className="opacity-0 group-hover:opacity-100"
                      onClick={(e) => { e.stopPropagation(); markPaid(inv.id) }}>
                      <Check className="size-3.5" /> {t('invoices.markPaid')}
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <p className="p-10 text-center text-sm text-fg-muted">{t('invoices.empty')}</p>}
      </Card>
    </div>
  )
}
