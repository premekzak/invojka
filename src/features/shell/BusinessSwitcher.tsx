import { Check, ChevronsUpDown, Plus } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useStore } from '@/state/store'
import { FsAccessAdapter, type RememberedFolder } from '@/storage/fsAccess'
import { cn } from '@/ui/primitives'
import { NewBusinessDialog } from './NewBusinessDialog'
import { navigate } from '@/ui/router'

/** Opens another business's folder. Shared by the header switcher, settings and the welcome screen. */
export async function openBusiness(adapter: FsAccessAdapter): Promise<'ok' | 'denied' | 'unsaved'> {
  if (!(await adapter.activate())) return 'denied'
  try {
    await useStore.getState().switchTo(adapter)
  } catch {
    return 'unsaved'
  }
  navigate('/')
  return 'ok'
}

/** The business name at the right of the header. A click lists the other businesses (each its own folder). */
export function BusinessSwitcher() {
  const { t } = useTranslation()
  const { settings, adapter, demo } = useStore()
  const [open, setOpen] = useState(false)
  const [list, setList] = useState<RememberedFolder[]>([])
  const [error, setError] = useState('')
  const [adding, setAdding] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const name = settings?.supplier.name ?? ''

  // Keep the switcher's label for this folder up to date, so other businesses show their names without opening them.
  useEffect(() => {
    if (!demo && name && adapter instanceof FsAccessAdapter) void adapter.setLabel(name)
  }, [adapter, name, demo])

  useEffect(() => {
    if (!open) return
    setError('')
    void FsAccessAdapter.list(adapter).then(setList)
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc) }
  }, [open, adapter])

  const report = (r: string, folder = '') => {
    if (r === 'ok') return setOpen(false)
    setError(r === 'denied' ? t('business.denied', { folder }) : t('business.unsaved'))
  }

  // In demo mode the real folders are put aside, so there is nothing to switch to.
  if (demo || !(adapter instanceof FsAccessAdapter)) {
    return <div className="min-w-0 truncate px-2 font-semibold">{name}</div>
  }

  return (
    <div ref={ref} className="relative min-w-0">
      <button
        className="flex max-w-80 items-center gap-2 rounded-lg px-2 py-1 text-left font-semibold transition-colors hover:bg-header-active/50"
        aria-haspopup="menu" aria-expanded={open} title={t('business.switch')} onClick={() => setOpen(!open)}
      >
        <span className="min-w-0 flex-1 truncate">{name}</span>
        <ChevronsUpDown className="size-4 shrink-0 text-header-muted" />
      </button>
      {open && (
        <div role="menu" className="animate-rise absolute top-full right-0 z-30 mt-1 w-72 rounded-xl border border-line bg-surface p-1 text-fg">
          {list.map((f) => (
            <button key={f.adapter.name + f.label} role="menuitem"
              className={cn('flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-row-hover', f.current && 'font-medium')}
              onClick={async () => (f.current ? setOpen(false) : report(await openBusiness(f.adapter), f.adapter.name))}
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate">{f.label}</span>
                {f.label !== f.adapter.name && <span className="block truncate text-xs text-fg-muted">{f.adapter.name}</span>}
              </span>
              {f.current && <Check className="size-4 shrink-0 text-link" />}
            </button>
          ))}
          <div className="my-1 border-t border-rule" />
          <button role="menuitem" className="flex w-full items-start gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-row-hover"
            onClick={() => { setOpen(false); setAdding(true) }}>
            <Plus className="mt-0.5 size-4 shrink-0 text-link" />
            <span className="min-w-0">
              <span className="block text-link">{t('business.add')}</span>
              <span className="block text-xs text-fg-muted">{t('business.addHint')}</span>
            </span>
          </button>
          {error && <p className="px-3 py-2 text-xs font-medium text-danger">{error}</p>}
        </div>
      )}
      {adding && <NewBusinessDialog onClose={() => setAdding(false)} />}
    </div>
  )
}
