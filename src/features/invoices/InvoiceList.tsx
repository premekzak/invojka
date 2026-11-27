import { Check, FileOutput, Landmark, Plus, Search, X } from 'lucide-react'
import { useDeferredValue, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { today } from '@/domain/id'
import { amountDue, daysOverdue, displayStatus, invoiceTotals, type DisplayStatus } from '@/domain/invoice'
import { countsAsRevenue } from '@/domain/stats'
import { useStore } from '@/state/store'
import { Money, StatusBadge, useFormat } from '@/ui/format'
import { Button, Card, Input, Select, cn } from '@/ui/primitives'
import { markChanged, recentlyChanged } from '@/ui/highlight'
import { MoreMenu } from '@/ui/MoreMenu'
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
    return [...m.entries()]
  }, [summed])

  function markPaid(id: string) {
    const inv = invoices.find((i) => i.id === id)!
    markChanged([id])
    upsertInvoice({ ...inv, status: 'paid', paidDate: on, paidAmount: amountDue(inv) })
  }

  return (
    <div className="space-y-5">
      <h1 className="font-display text-3xl leading-[1.2] font-semibold">{t('invoices.title')}</h1>
      {bank && <BankImport onClose={() => setBank(false)} />}
      {exporting && <ExportDialog onClose={() => setExporting(false)} />}

      {/* One row of controls, 32 px tall (the owner, 2026-10-31, after the actions and the filters had a row each): search,
          the statuses as quiet text tabs, the year, then at the right end "Nová faktura" and the more menu with the bank statement
          import and the export for the accountant. A status with no invoices is hidden unless it is the chosen one,
          so the row only offers what is there. No autofocus: the page is mostly for looking through. */}
      <div className="flex flex-wrap items-center gap-x-7 gap-y-3">
        <div className="relative w-64 max-md:w-full">
          <Search className="absolute top-2 left-3 size-4 text-fg-subtle" />
          <Input className="h-8 pl-9" aria-label={t('invoices.search')} placeholder={t('invoices.search')} value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        {showStatuses && <div role="group" aria-label={t('invoices.status')} className="flex h-8 flex-wrap gap-x-5">
          {(['', ...STATUSES] as const).filter((s) => !s || status === s || (counts.get(s) ?? 0) > 0).map((s) => (
            <button key={s} onClick={() => setStatus(s)} aria-pressed={status === s} className={cn(
              'flex items-center gap-1.5 border-b-2 text-sm leading-label font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-link',
              status === s ? 'border-link text-fg' : 'border-transparent text-fg-muted hover:text-fg',
            )}>
              {s ? t(`status.${s}`) : t('invoices.allStatuses')}
              <span className="font-normal tabular-nums text-fg-muted">{counts.get(s) ?? 0}</span>
            </button>
          ))}
        </div>}
        <Select className="h-8 w-auto py-0" aria-label={t('invoices.allYears')} value={year} onChange={(e) => setYear(e.target.value)}>
          <option value="">{t('invoices.allYears')}</option>
          {years.map((y) => <option key={y}>{y}</option>)}
        </Select>
        <div className="ml-auto flex gap-1">
          <Button size="sm" onClick={() => navigate('/invoices/new')}><Plus className="size-4" /> {t('nav.newInvoice')}</Button>
          {/* The bank statement had its own button for a day; with it the row was wider than the page and the filters
              wrapped, so it went back into the menu (the owner, 2026-11-01). */}
          <MoreMenu size="sm" items={[
            { key: 'bank', icon: <Landmark className="size-4" />, label: t('bank.open'), onClick: () => setBank(true) },
            { key: 'export', icon: <FileOutput className="size-4" />, label: t('export.open'), onClick: () => setExporting(true) },
          ]} />
        </div>
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
        <table className="w-full text-sm leading-label max-md:min-w-[36rem]">
          {/* A pale band for the header and a hairline between rows (the owner's pick "F" of eight looks, 2026-11-27; soft
              stripes with no lines before, "T-C" of 2026-10-17); hover is a tint.
              Type (the owner, 2026-11-27): three levels, by weight and lightness: who and how much (the name 500, the figure 600),
              the number in plain ink, then dates and second lines muted. Cells are top-aligned, so every first line sits on
              one line and the second line (what it was for, the kind of document) hangs under it. */}
          <thead className="bg-surface-2 text-left text-xs whitespace-nowrap text-fg-muted">
            <tr>
              <th className="py-2.5 pr-4 pl-6 font-medium">{t('invoices.number')}</th>
              <th className="px-4 py-2.5 font-medium">{t('invoices.customer')}</th>
              <th className="px-4 py-2.5 text-right font-medium">{t('invoices.issued')}</th>
              <th className="px-4 py-2.5 text-right font-medium">{t('invoices.due')}</th>
              <th className="px-4 py-2.5 text-right font-medium">{t('invoices.total')}</th>
              <th className="py-2.5 pr-6 pl-4 text-right font-medium">{t('invoices.status')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 300).map(({ inv, status: s, totals }) => (
              <tr key={inv.id} onClick={() => navigate(`/invoices/${inv.id}`)}
                className={cn('group cursor-pointer border-t border-rule align-top transition-colors hover:bg-tint', recentlyChanged(inv.id) && 'animate-highlight')}>
                <td className="py-3 pr-4 pl-6 whitespace-nowrap tabular-nums">
                  {inv.number}
                  {inv.kind !== 'invoice' && <div className="mt-0.5 text-xs text-fg-muted">{t(`invoices.kindTag.${inv.kind}`)}</div>}
                </td>
                {/* The one column that takes the room that is left (w-full with max-w-0), so a long description is cut where
                    the table ends, not at a fixed width. */}
                <td className="w-full max-w-0 px-4 py-3">
                  <div className="truncate font-medium" title={inv.customerSnapshot.name}>{inv.customerSnapshot.name}</div>
                  <div className="mt-0.5 truncate text-xs text-fg-muted" title={inv.lines[0]?.description}>
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
                <td className="px-4 py-3 text-right"><Money minor={totals.total} currency={inv.currency} /></td>
                {/* "Mark paid" sits in the status cell, before the label, so there is no empty column at the right edge.
                    Icon-only; the verb is in the tooltip and the accessible name. */}
                {/* As tall as the first line, so the label sits on it; the 32 px button overflows it evenly and adds no height. */}
                <td className="py-3 pr-6 pl-4">
                  <div className="flex h-[1.125rem] items-center justify-end gap-2">
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
              <tr className="border-t border-rule">
                <td colSpan={4} className="py-3 pr-4 pl-6 align-top text-fg-muted">
                  {t('invoices.count', { count: rows.length })}{summed.length < rows.length && t('invoices.countExcludes')}
                </td>
                {/* One line per currency, so several never wrap mid-sum. */}
                <td className="px-4 py-3 text-right">
                  {sumByCurrency.length ? sumByCurrency.map(([c, v]) => <div key={c}><Money minor={v} currency={c} /></div>) : <Money minor={0} />}
                </td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
        {rows.length === 0 && <p className="p-10 text-center text-base text-fg-muted">{t('invoices.empty')}</p>}
      </Card>
    </div>
  )
}
