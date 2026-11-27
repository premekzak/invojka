import { ChevronsUpDown, Plus } from 'lucide-react'
import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { nameKey } from '@/domain/id'
import { invoiceTotals, type CustomerSummary } from '@/domain/invoice'
import type { Customer } from '@/domain/schema'
import { useFormat } from '@/ui/format'
import { cn } from '@/ui/primitives'

const NO_RECENT: string[] = []

/**
 * One customer in the list, on two rows (the owner, 2026-11-27: the list is wide, so it can say more). The first is the
 * customer: name, then city and IČ at the right. The second is their latest document, labelled as such ("Poslední faktura"
 * with its date, amount and what it was for; without the label the text read as a description of the customer), and at
 * the right how many are overdue (in the warning colour, with words) or how many documents there are.
 */
function CustomerRow({ customer: c, summary: s, active, onHover, onPick }: { customer: Customer; summary?: CustomerSummary; active: boolean; onHover: () => void; onPick: () => void }) {
  const { t } = useTranslation()
  const f = useFormat()
  const where = [c.address.city || c.address.country, c.ic && `${t('fields.ic')} ${c.ic}`].filter(Boolean).join(' · ')
  const lastFor = s?.last.lines.find((l) => l.description.trim())?.description
  return (
    <button type="button" onMouseEnter={onHover} onClick={onPick}
      className={cn('block w-full space-y-0.5 rounded-xs px-3 py-2 text-left text-sm leading-label', active && 'bg-surface-2')}>
      {/* Who: the name, with where they are and their IČ at the right. */}
      <span className="flex items-baseline justify-between gap-6">
        <span className="truncate font-medium">{c.name}</span>
        <span className="shrink-0 text-xs whitespace-nowrap text-fg-muted tabular-nums">{where}</span>
      </span>
      {/* Their latest document, said to be that: its date, amount and what it was for; then what is overdue, or how many. */}
      <span className="flex items-baseline justify-between gap-6 text-xs text-fg-muted">
        {s ? <>
          <span className="truncate">
            <span className="tabular-nums">{t('editor.customerInfo.last', { date: f.date(s.last.issueDate) })} · {f.money(invoiceTotals(s.last).total, s.last.currency)}</span>
            {lastFor && ` · ${lastFor}`}
          </span>
          {s.overdue > 0 ? <span className="shrink-0 font-medium whitespace-nowrap text-warning">{t('editor.customerInfo.overdue', { count: s.overdue })}</span>
            : <span className="shrink-0 whitespace-nowrap">{t('editor.customerInfo.count', { count: s.count })}</span>}
        </> : <span>{t('editor.customerInfo.none')}</span>}
      </span>
    </button>
  )
}

/** Searchable customer select, keyboard-friendly (↑ ↓ Enter Esc). */
export function CustomerPicker({ customers, value, name, onChange, onCreate, autoFocus, recent = NO_RECENT, summaries, ...aria }: {
  customers: Customer[]; value: string | null; onChange: (c: Customer) => void
  /** Per customer id: their documents so far, shown in each row (the latest one's text, date and amount, the overdue ones). */
  summaries?: Map<string, CustomerSummary>
  /** Ids of the customers invoiced last; with nothing typed they come first, under their own heading. */
  recent?: string[]
  /** The name to show for the picked customer: the invoice's printed name, which an issued invoice keeps after the customer is renamed. */
  name?: string
  /** Create a customer with the typed name (offered when nothing matches exactly). */
  onCreate?: (name: string) => void
  autoFocus?: boolean
  /** Passed on to the text input by `Labeled`. */
  id?: string; required?: boolean; 'aria-describedby'?: string; 'aria-invalid'?: boolean
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [active, setActive] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  const selected = customers.find((c) => c.id === value)

  const { list, recentCount } = useMemo(() => {
    const k = nameKey(q)
    const all = customers
      .filter((c) => !c.archived && (!k || nameKey(c.name).includes(k) || c.ic.includes(q.trim())))
      .sort((a, b) => a.name.localeCompare(b.name))
    // Before anything is typed, the customers invoiced last go first; only worth a heading when the list is longer.
    const top = k ? [] : recent.map((id) => all.find((c) => c.id === id)).filter((c): c is Customer => !!c)
    if (top.length === 0 || all.length <= top.length) return { list: all.slice(0, 50), recentCount: 0 }
    return { list: [...top, ...all.filter((c) => !top.includes(c))].slice(0, 50), recentCount: top.length }
  }, [customers, q, recent])

  useEffect(() => setActive(0), [q])
  useEffect(() => {
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  const pick = (c: Customer) => { onChange(c); setOpen(false); setQ('') }
  const typed = q.trim()
  const canCreate = !!onCreate && !!typed && !customers.some((c) => nameKey(c.name) === nameKey(typed))
  const create = () => { onCreate!(typed); setOpen(false); setQ('') }

  return (
    <div ref={ref} className="relative">
      <div className="control flex h-9 items-center px-3">
        <input
          {...aria}
          className="h-full flex-1 bg-transparent text-sm outline-none placeholder:text-fg-subtle"
          placeholder={selected ? name || selected.name : t('editor.pickCustomer')}
          value={open ? q : selected ? name || selected.name : ''}
          autoFocus={autoFocus}
          onFocus={() => setOpen(true)}
          onChange={(e) => { setQ(e.target.value); setOpen(true) }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, list.length - 1)) }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)) }
            else if (e.key === 'Enter' && list[active]) { e.preventDefault(); pick(list[active]) }
            else if (e.key === 'Enter' && canCreate) { e.preventDefault(); create() }
            else if (e.key === 'Escape') setOpen(false)
          }}
        />
        <ChevronsUpDown className="size-4 text-fg-subtle" />
      </div>
      {open && (
        <div className="animate-rise absolute z-20 mt-1 max-h-96 w-full overflow-auto rounded-xl border border-line bg-surface p-1">
          {list.length === 0 && !canCreate && <div className="px-3 py-2 text-sm text-fg-muted">{t('editor.noCustomer')}</div>}
          {list.map((c, i) => (
            <Fragment key={c.id}>
              {recentCount > 0 && (i === 0 || i === recentCount) && (
                <div className={cn('px-3 pt-2 pb-1 text-xs text-fg-muted', i > 0 && 'mt-1 border-t border-line')}>
                  {t(i === 0 ? 'editor.recentCustomers' : 'editor.allCustomers')}
                </div>
              )}
              <CustomerRow customer={c} summary={summaries?.get(c.id)} active={i === active} onHover={() => setActive(i)} onPick={() => pick(c)} />
            </Fragment>
          ))}
          {canCreate && (
            <button type="button" onClick={create}
              className={cn('flex w-full items-center gap-2 rounded-xs px-3 py-2 text-left text-sm leading-label text-link hover:bg-tint', list.length === 0 && 'bg-surface-2')}>
              <Plus className="size-4" /> {t('customers.create', { name: typed })}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
