import { Check, FileOutput, Landmark, Plus, Search } from 'lucide-react'
import { useDeferredValue, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { today } from '@/domain/id'
import { amountDue, daysOverdue, displayStatus, invoiceTotals, type DisplayStatus } from '@/domain/invoice'
import { countsAsRevenue } from '@/domain/stats'
import { useStore } from '@/state/store'
import { StatusBadge, useFormat } from '@/ui/format'
import { Button, Card, Input, Select, cn } from '@/ui/primitives'
import { navigate, type Route } from '@/ui/router'
import { BankImport } from './BankImport'
import { ExportDialog } from './ExportDialog'

const STATUSES: DisplayStatus[] = ['draft', 'issued', 'overdue', 'paid', 'cancelled', 'uncollectible']

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
  const [bank, setBank] = useState(false)
  const [exporting, setExporting] = useState(false)

  const setStatus = (s: string) => {
    const p = new URLSearchParams(route.query)
    if (s) p.set('status', s)
    else p.delete('status')
    navigate(`/invoices${p.size ? `?${p}` : ''}`)
  }

  const years = useMemo(() => [...new Set(invoices.map((i) => i.issueDate.slice(0, 4)))].sort().reverse(), [invoices])

  // Everything but the status filter, so each status button can show its count.
  const base = useMemo(() => {
    return invoices
      .map((inv) => ({ inv, status: displayStatus(inv, on), totals: invoiceTotals(inv) }))
      .filter(({ inv }) =>
        (!year || inv.issueDate.startsWith(year)) &&
        (!customerId || inv.customerId === customerId) &&
        (!q || inv.number.includes(q) || inv.customerSnapshot.name.toLowerCase().includes(q) || inv.lines.some((l) => l.description.toLowerCase().includes(q))
          || inv.tags.some((tag) => tag.toLowerCase().includes(q))))
      .sort((a, b) => b.inv.issueDate.localeCompare(a.inv.issueDate) || b.inv.number.localeCompare(a.inv.number))
  }, [invoices, on, year, customerId, q])
  const rows = useMemo(() => (status ? base.filter((r) => r.status === status) : base), [base, status])
  const counts = useMemo(() => {
    const m = new Map<string, number>([['', base.length]])
    for (const r of base) m.set(r.status, (m.get(r.status) ?? 0) + 1)
    return m
  }, [base])

  // The total counts what Home counts (issued and paid). Only when you filter drafts or cancelled ones does it add those up.
  const summed = useMemo(() => (status === 'draft' || status === 'cancelled' ? rows : rows.filter((r) => countsAsRevenue(r.inv))), [rows, status])
  const sumByCurrency = useMemo(() => {
    const m = new Map<string, number>()
    for (const r of summed) m.set(r.inv.currency, (m.get(r.inv.currency) ?? 0) + r.totals.total)
    return [...m.entries()].map(([c, v]) => f.money(v, c)).join(' + ')
  }, [summed, f])

  function markPaid(id: string) {
    const inv = invoices.find((i) => i.id === id)!
    upsertInvoice({ ...inv, status: 'paid', paidDate: on, paidAmount: amountDue(inv) })
  }

  return (
    <div className="space-y-5">
      {/* The action for the whole list sits at the right end of the title row (design system: Layout). */}
      <div className="flex items-end justify-between gap-6">
        <div className="space-y-1">
          <h1 className="font-display text-4xl leading-[1.2] font-bold tracking-[-0.01em]">{t('invoices.title')}</h1>
          <p className="text-sm text-fg-muted">{t('invoices.count', { count: rows.length, total: sumByCurrency || f.money(0) })}
            {summed.length < rows.length && t('invoices.countExcludes')}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setExporting(true)}><FileOutput className="size-4" /> {t('export.open')}</Button>
          <Button variant="secondary" onClick={() => setBank(true)}><Landmark className="size-4" /> {t('bank.open')}</Button>
          <Button onClick={() => navigate('/invoices/new')}><Plus className="size-4" /> {t('nav.newInvoice')}</Button>
        </div>
      </div>
      {bank && <BankImport onClose={() => setBank(false)} />}
      {exporting && <ExportDialog onClose={() => setExporting(false)} />}

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
      {/* A segmented control (the owner's choice "T-C", 2026-10-17): the chosen status is a white segment on a tinted track. */}
      <div role="group" aria-label={t('invoices.status')} className="inline-flex flex-wrap gap-0.5 rounded-2xl bg-surface-3 p-[3px] dark:bg-surface-2">
        {(['', ...STATUSES] as const).map((s) => (
          <button key={s} onClick={() => setStatus(s)} aria-pressed={status === s} className={cn(
            'flex items-center gap-1.5 rounded-lg px-3 py-1 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-link',
            status === s ? 'bg-surface text-fg dark:bg-surface-3' : 'text-fg-muted hover:text-fg',
          )}>
            {s ? t(`status.${s}`) : t('invoices.allStatuses')}
            <span className="font-normal tabular-nums text-fg-muted">{counts.get(s) ?? 0}</span>
          </button>
        ))}
      </div>

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          {/* Soft stripes instead of row lines (the owner's choice "T-C", 2026-10-17): even rows row-hover, hover one step darker. */}
          <thead className="text-left text-xs text-fg-muted">
            <tr>
              <th className="py-3 pr-4 pl-5 font-medium">{t('invoices.number')}</th>
              <th className="px-4 py-3 font-medium">{t('invoices.customer')}</th>
              <th className="px-4 py-3 text-right font-medium">{t('invoices.issued')}</th>
              <th className="px-4 py-3 text-right font-medium">{t('invoices.due')}</th>
              <th className="px-4 py-3 text-right font-medium">{t('invoices.total')}</th>
              <th className="py-3 pr-5 pl-4 text-right font-medium">{t('invoices.status')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 300).map(({ inv, status: s, totals }) => (
              <tr key={inv.id} onClick={() => navigate(`/invoices/${inv.id}`)} className="group cursor-pointer transition-colors even:bg-row-hover hover:bg-surface-2">
                <td className="py-3 pr-4 pl-5 tabular-nums text-fg-muted">
                  {inv.number}
                  {inv.kind !== 'invoice' && <div className="text-xs text-fg-subtle">{t(`invoices.kindTag.${inv.kind}`)}</div>}
                </td>
                <td className="max-w-xs px-4 py-3">
                  <div className="truncate font-medium">{inv.customerSnapshot.name}</div>
                  <div className="truncate text-xs text-fg-subtle">
                    {inv.tags.length > 0 && <span className="mr-2 text-fg-muted">{inv.tags.map((tag) => `#${tag}`).join(' ')}</span>}
                    {inv.lines[0]?.description}
                  </div>
                </td>
                {/* Dates and amounts are right-aligned with tabular digits, so days, years and thousands line up. */}
                <td className="px-4 py-3 text-right whitespace-nowrap tabular-nums text-fg-muted">{f.date(inv.issueDate)}</td>
                {/* The status label says overdue; the date stays grey, so a row isn't flagged twice. */}
                <td className="px-4 py-3 text-right whitespace-nowrap tabular-nums text-fg-muted"
                  title={s === 'overdue' ? t('invoices.daysOverdue', { count: daysOverdue(inv, on) }) : undefined}>
                  {f.date(inv.dueDate)}
                </td>
                <td className="px-4 py-3 text-right font-medium whitespace-nowrap tabular-nums">{f.money(totals.total, inv.currency)}</td>
                {/* "Mark paid" sits in the status cell, before the label, so there is no empty column at the right edge.
                    Icon-only; the verb is in the tooltip and the accessible name. */}
                <td className="py-2 pr-5 pl-4">
                  <div className="flex items-center justify-end gap-2">
                    {(s === 'issued' || s === 'overdue') && (
                      <Button size="sm" variant="secondary" className="w-8 px-0 opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                        title={t('invoices.markPaid')} aria-label={t('invoices.markPaid')}
                        onClick={(e) => { e.stopPropagation(); markPaid(inv.id) }}>
                        <Check className="size-4" />
                      </Button>
                    )}
                    <StatusBadge status={s} />
                  </div>
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
