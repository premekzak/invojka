import { Check, FileOutput, Landmark, Plus, Search, X } from 'lucide-react'
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
  const { invoices, customers, upsertInvoice } = useStore()
  const on = today()
  const [search, setSearch] = useState(route.query.get('q') ?? '')
  const [year, setYear] = useState(route.query.get('year') ?? '')
  const status = (route.query.get('status') ?? '') as DisplayStatus | ''
  const customerId = route.query.get('customer')
  const q = useDeferredValue(search.trim().toLowerCase())
  const [bank, setBank] = useState(false)
  const [exporting, setExporting] = useState(false)

  const setQuery = (key: string, value: string) => {
    const p = new URLSearchParams(route.query)
    if (value) p.set(key, value)
    else p.delete(key)
    navigate(`/invoices${p.size ? `?${p}` : ''}`)
  }
  const setStatus = (s: string) => setQuery('status', s)
  const customerName = customerId ? (customers.find((c) => c.id === customerId)?.name
    ?? invoices.find((i) => i.customerId === customerId)?.customerSnapshot.name ?? t('invoices.unknownCustomer')) : undefined

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
  // The status tabs only when they can tell invoices apart: with one status in the year (all paid, say) "Vše" and that
  // status would show the same list. Judged without the search, so the tabs don't come and go while typing; a chosen
  // status that has no invoices keeps them, so there is a way back to all.
  const showStatuses = useMemo(() => {
    const seen = new Set(invoices
      .filter((inv) => (!year || inv.issueDate.startsWith(year)) && (!customerId || inv.customerId === customerId))
      .map((inv) => displayStatus(inv, on)))
    return seen.size > 1 || (!!status && !seen.has(status))
  }, [invoices, on, year, customerId, status])

  // The total counts what Home counts (issued and paid). Only when you filter drafts or cancelled ones does it add those up.
  const summed = useMemo(() => (status === 'draft' || status === 'cancelled' ? rows : rows.filter((r) => countsAsRevenue(r.inv))), [rows, status])
  const sumByCurrency = useMemo(() => {
    const m = new Map<string, number>()
    for (const r of summed) m.set(r.inv.currency, (m.get(r.inv.currency) ?? 0) + r.totals.total)
    return [...m.entries()].map(([c, v]) => f.money(v, c))
  }, [summed, f])

  function markPaid(id: string) {
    const inv = invoices.find((i) => i.id === id)!
    upsertInvoice({ ...inv, status: 'paid', paidDate: on, paidAmount: amountDue(inv) })
  }

  return (
    <div className="space-y-5">
      {/* The actions sit in the title row, the main one first (the owner, 2026-10-18; design system: Layout). */}
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <h1 className="font-display text-4xl leading-[1.2] font-bold tracking-[-0.01em]">{t('invoices.title')}</h1>
        <div className="flex flex-wrap justify-end gap-2">
          <Button onClick={() => navigate('/invoices/new')}><Plus className="size-4" /> {t('nav.newInvoice')}</Button>
          <Button variant="secondary" onClick={() => setExporting(true)}><FileOutput className="size-4" /> {t('export.open')}</Button>
          <Button variant="secondary" onClick={() => setBank(true)}><Landmark className="size-4" /> {t('bank.open')}</Button>
        </div>
      </div>
      {bank && <BankImport onClose={() => setBank(false)} />}
      {exporting && <ExportDialog onClose={() => setExporting(false)} />}

      {/* One row of filters, 32 px like the statistics filters (the owner picked "A" of the canvas variants, 2026-10-20):
          search, the statuses as quiet text tabs, the year at the right end. A status with no invoices is hidden unless it is
          the chosen one, so the row only offers what is there. No autofocus: the page is mostly for looking through. */}
      <div className="flex flex-wrap items-center gap-x-7 gap-y-3">
        <div className="relative w-72 max-md:w-full">
          <Search className="absolute top-2 left-3 size-4 text-fg-subtle" />
          <Input className="h-8 pl-9" aria-label={t('invoices.search')} placeholder={t('invoices.search')} value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        {showStatuses && <div role="group" aria-label={t('invoices.status')} className="flex h-8 flex-wrap gap-x-5">
          {(['', ...STATUSES] as const).filter((s) => !s || status === s || (counts.get(s) ?? 0) > 0).map((s) => (
            <button key={s} onClick={() => setStatus(s)} aria-pressed={status === s} className={cn(
              'flex items-center gap-1.5 border-b-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-link',
              status === s ? 'border-link text-fg' : 'border-transparent text-fg-muted hover:text-fg',
            )}>
              {s ? t(`status.${s}`) : t('invoices.allStatuses')}
              <span className="font-normal tabular-nums text-fg-muted">{counts.get(s) ?? 0}</span>
            </button>
          ))}
        </div>}
        <Select className="ml-auto h-8 w-auto py-0" aria-label={t('invoices.allYears')} value={year} onChange={(e) => setYear(e.target.value)}>
          <option value="">{t('invoices.allYears')}</option>
          {years.map((y) => <option key={y}>{y}</option>)}
        </Select>
      </div>
      {/* Coming from a customer filters the list by them; the chip says so and takes the filter off. Its own line, so the
          filter row never wraps around it. */}
      {customerName && (
        <div className="-mt-2"><span className="inline-flex h-8 items-center gap-1 rounded-lg border border-line bg-surface-2 pr-1 pl-3 text-sm">
          {t('invoices.customerFilter', { name: customerName })}
          <button type="button" onClick={() => setQuery('customer', '')} title={t('invoices.clearCustomer')} aria-label={t('invoices.clearCustomer')}
            className="flex size-6 items-center justify-center rounded-md text-fg-muted transition-colors hover:bg-surface-3 hover:text-fg focus-visible:outline-2 focus-visible:outline-link">
            <X className="size-3.5" />
          </button>
        </span></div>
      )}

      <Card className="overflow-x-auto">
        <table className="w-full text-sm max-md:min-w-[36rem]">
          {/* Soft stripes instead of row lines (the owner's choice "T-C", 2026-10-17): even rows row-hover, hover one step darker. */}
          <thead className="text-left text-xs text-fg-muted">
            <tr>
              <th className="py-3 pr-4 pl-6 font-medium">{t('invoices.number')}</th>
              <th className="px-4 py-3 font-medium">{t('invoices.customer')}</th>
              <th className="px-4 py-3 text-right font-medium">{t('invoices.issued')}</th>
              <th className="px-4 py-3 text-right font-medium">{t('invoices.due')}</th>
              <th className="px-4 py-3 text-right font-medium">{t('invoices.total')}</th>
              <th className="py-3 pr-6 pl-4 text-right font-medium">{t('invoices.status')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 300).map(({ inv, status: s, totals }) => (
              <tr key={inv.id} onClick={() => navigate(`/invoices/${inv.id}`)} className="group cursor-pointer transition-colors even:bg-row-hover hover:bg-tint">
                <td className="py-3 pr-4 pl-6 tabular-nums text-fg-muted">
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
                <td className="py-2 pr-6 pl-4">
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
          {/* The count and total close the table as its last row, under the amounts (the owner, 2026-10-20: not important
              enough to sit under the title). */}
          {rows.length > 0 && (
            <tfoot>
              <tr>
                <td colSpan={4} className="py-3 pr-4 pl-6 align-top text-fg-muted">
                  {t('invoices.count', { count: rows.length })}{summed.length < rows.length && t('invoices.countExcludes')}
                </td>
                {/* One line per currency, so several never wrap mid-sum. */}
                <td className="px-4 py-3 text-right font-medium whitespace-nowrap tabular-nums">
                  {sumByCurrency.length ? sumByCurrency.map((s) => <div key={s}>{s}</div>) : f.money(0)}
                </td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
        {rows.length === 0 && <p className="p-10 text-center text-sm text-fg-muted">{t('invoices.empty')}</p>}
      </Card>
    </div>
  )
}
