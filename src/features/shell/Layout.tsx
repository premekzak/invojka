import { FileText, Home, Plus, Settings, Users } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useStore } from '@/state/store'
import { Button, cn } from '@/ui/primitives'
import { navigate } from '@/ui/router'
import { ConflictBanner, SaveStatus } from './SaveStatus'

const items = [
  { key: 'home', path: '/', icon: Home },
  { key: 'invoices', path: '/invoices', icon: FileText },
  { key: 'customers', path: '/customers', icon: Users },
  { key: 'settings', path: '/settings', icon: Settings },
] as const

export function Layout({ section, children }: { section: string; children: ReactNode }) {
  const { t } = useTranslation()
  const { settings, adapter, demo, exitDemo } = useStore()
  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col border-r border-line bg-sidebar p-4">
        <div className="mb-6 flex items-center gap-2 px-2 font-semibold">
          <div className="grid size-7 shrink-0 place-items-center rounded-md bg-accent font-serif text-base font-semibold text-accent-fg">I</div>
          <span className="truncate">{settings?.supplier.name}</span>
        </div>
        <Button className="mb-4 w-full" onClick={() => navigate('/invoices/new')}>
          <Plus className="size-4" /> {t('nav.newInvoice')}
        </Button>
        <nav className="space-y-0.5">
          {items.map(({ key, path, icon: Icon }) => (
            <a
              key={key}
              href={`#${path}`}
              className={cn(
                'flex items-center gap-3 rounded-lg border-l-2 px-3 py-2 text-sm transition-colors',
                section === key ? 'border-accent bg-sidebar-active font-medium text-accent' : 'border-transparent text-fg-muted hover:bg-sidebar-active hover:text-fg',
              )}
            >
              <Icon className="size-4" /> {t(`nav.${key}`)}
            </a>
          ))}
        </nav>
        {demo ? (
          <div className="mt-auto flex items-center justify-between gap-2 rounded-lg border border-accent/40 px-3 py-2 text-xs" title={t('demo.badgeHint')}>
            <span className="font-medium text-accent">{t('demo.badge')}</span>
            <button className="text-fg-muted underline-offset-2 hover:text-fg hover:underline" onClick={() => void exitDemo()}>{t('demo.exit')}</button>
          </div>
        ) : (
          <div className="mt-auto space-y-1 px-2 text-xs">
            <SaveStatus />
            <div className="truncate text-fg-subtle" title={adapter?.name}>{adapter?.name}</div>
          </div>
        )}
      </aside>
      <main className="min-w-0 flex-1">
        {/* Remount on demo toggle so no editor keeps a draft from the other data set. */}
        <div key={`${section}:${demo}`} className="animate-rise mx-auto max-w-6xl p-8">{children}</div>
      </main>
      <ConflictBanner />
    </div>
  )
}
