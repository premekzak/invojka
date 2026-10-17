import { ChevronsUpDown, Plus } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { nameKey } from '@/domain/id'
import type { Customer } from '@/domain/schema'
import { cn } from '@/ui/primitives'

/** Searchable customer select, keyboard-friendly (↑ ↓ Enter Esc). */
export function CustomerPicker({ customers, value, name, onChange, onCreate, autoFocus, ...aria }: {
  customers: Customer[]; value: string | null; onChange: (c: Customer) => void
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

  const list = useMemo(() => {
    const k = nameKey(q)
    return customers
      .filter((c) => !c.archived && (!k || nameKey(c.name).includes(k) || c.ic.includes(q.trim())))
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 50)
  }, [customers, q])

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
      <div className="control flex h-10 items-center px-3">
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
        <div className="animate-rise absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-xl border border-line bg-surface p-1">
          {list.length === 0 && !canCreate && <div className="px-3 py-2 text-sm text-fg-muted">{t('editor.noCustomer')}</div>}
          {list.map((c, i) => (
            <button key={c.id} type="button" onMouseEnter={() => setActive(i)} onClick={() => pick(c)}
              className={cn('flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm', i === active && 'bg-surface-2')}>
              <span className="truncate">{c.name}</span>
              <span className="ml-3 shrink-0 tabular-nums text-xs text-fg-subtle">{c.ic || c.address.country}</span>
            </button>
          ))}
          {canCreate && (
            <button type="button" onClick={create}
              className={cn('flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-accent hover:bg-surface-2', list.length === 0 && 'bg-surface-2')}>
              <Plus className="size-4" /> {t('customers.create', { name: typed })}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
