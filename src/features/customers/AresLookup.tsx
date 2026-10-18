import { Loader2, Search } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { aresLookup, type AresParty } from '@/ares/ares'
import { useFormat } from '@/ui/format'
import { cn, Labeled } from '@/ui/primitives'

type State = { kind: 'idle' } | { kind: 'loading' } | { kind: 'done'; list: AresParty[] } | { kind: 'error' }

/**
 * One box for a company name or IČ that searches ARES and fills in the details (like Fakturoid's new contact).
 * Nothing is sent until the user types at least 3 characters or an IČ; then only that text goes to ARES.
 */
export function AresLookup({ onPick, autoFocus, className }: { onPick: (p: AresParty) => void; autoFocus?: boolean; className?: string }) {
  const { t } = useTranslation()
  const f = useFormat()
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [state, setState] = useState<State>({ kind: 'idle' })
  const [active, setActive] = useState(0)
  const ref = useRef<HTMLDivElement>(null)

  // Wait for a pause in typing, and drop the answer to an older query.
  useEffect(() => {
    const ctrl = new AbortController()
    const timer = setTimeout(() => {
      const req = aresLookup(q, ctrl.signal)
      if (!req) return setState({ kind: 'idle' })
      setState({ kind: 'loading' })
      req.then((list) => { setState({ kind: 'done', list }); setActive(0) })
        .catch((e: unknown) => { if (!ctrl.signal.aborted) { console.warn(e); setState({ kind: 'error' }) } })
    }, 350)
    return () => { clearTimeout(timer); ctrl.abort() }
  }, [q])

  useEffect(() => {
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  const list = state.kind === 'done' ? state.list : []
  const pick = (p: AresParty) => { onPick(p); setOpen(false); setQ('') }

  return (
    <div ref={ref} className={cn('relative', className)}>
      <Labeled label={t('ares.label')} hint={t('ares.hint')}>
        <div className="control flex h-10 items-center gap-2 px-3">
          <Search aria-hidden="true" className="size-4 shrink-0 text-fg-subtle" />
          <input
            className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-fg-subtle"
            placeholder={t('ares.placeholder')} value={q} autoFocus={autoFocus} autoComplete="off"
            role="combobox" aria-expanded={open && state.kind !== 'idle'} aria-autocomplete="list"
            onFocus={() => setOpen(true)}
            onChange={(e) => { setQ(e.target.value); setOpen(true) }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, list.length - 1)) }
              else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)) }
              else if (e.key === 'Enter' && list[active]) { e.preventDefault(); pick(list[active]) }
              else if (e.key === 'Escape') setOpen(false)
            }}
          />
          {state.kind === 'loading' && <Loader2 aria-label={t('ares.searching')} className="size-4 shrink-0 animate-spin text-fg-subtle" />}
        </div>
      </Labeled>
      {open && (state.kind === 'done' || state.kind === 'error') && (
        <div role="listbox" className="animate-rise absolute z-20 mt-1 max-h-80 w-full overflow-auto rounded-xl border border-line bg-surface p-1">
          {state.kind === 'error' && <div className="px-3 py-2 text-sm text-fg-muted">{t('ares.error')}</div>}
          {state.kind === 'done' && list.length === 0 && <div className="px-3 py-2 text-sm text-fg-muted">{t('ares.none')}</div>}
          {list.map((p, i) => (
            <button key={p.ic} type="button" role="option" aria-selected={i === active} onMouseEnter={() => setActive(i)} onClick={() => pick(p)}
              className={cn('flex w-full items-start justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm', i === active && 'bg-surface-2')}>
              <span className="min-w-0">
                <span className="block truncate font-medium">{p.name}</span>
                <span className="block truncate text-xs text-fg-muted">
                  {[p.address.street, [p.address.zip, p.address.city].filter(Boolean).join(' ')].filter(Boolean).join(', ')}
                  {p.ceased && <span className="text-warning"> · {t('ares.ceased', { date: f.date(p.ceased) })}</span>}
                </span>
              </span>
              <span className="shrink-0 tabular-nums text-xs text-fg-muted">{p.ic}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

