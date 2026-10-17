import { FileText, Home, Settings, Users } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useStore } from '@/state/store'
import { cn } from '@/ui/primitives'
import { BusinessSwitcher } from './BusinessSwitcher'
import { ConflictBanner, SaveStatus } from './SaveStatus'

const items = [
  { key: 'home', path: '/', icon: Home },
  { key: 'invoices', path: '/invoices', icon: FileText },
  { key: 'customers', path: '/customers', icon: Users },
  { key: 'settings', path: '/settings', icon: Settings },
] as const

export function Layout({ section, children }: { section: string; children: ReactNode }) {
  const { t } = useTranslation()
  const { demo, exitDemo } = useStore()
  return (
    <div className="min-h-screen">
      {/* The peach header band, one row (the owner's choice, 2026-10-17, replacing the sidebar): the logo on the left,
          the pages as centred pills, the business with its save tick on the right. "Nová faktura" lives on the invoice list and Home. */}
      <header className="border-b border-line bg-header text-header-fg">
        <div className="mx-auto grid max-w-6xl grid-cols-[1fr_auto_1fr] items-center gap-6 px-8 py-3">
          <a href="#/" className="flex items-center gap-2 justify-self-start" title={t('nav.home')}>
            <div className="grid size-7 shrink-0 place-items-center rounded-md bg-brand font-display text-lg font-bold text-brand-fg">I</div>
            <span className="font-display text-lg font-bold tracking-[-0.015em]">{t('app.name')}</span>
          </a>
          {/* Pills with a 12 px radius, the one place with corners this round (the owner's exception to "no pills", navigation only). */}
          <nav className="flex gap-1">
            {items.map(({ key, path, icon: Icon }) => (
              <a
                key={key}
                href={`#${path}`}
                aria-current={section === key ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-2 rounded-[12px] px-4 py-1.5 text-sm whitespace-nowrap transition-colors',
                  section === key ? 'bg-header-active font-medium text-header-fg' : 'text-header-muted hover:bg-header-active/50 hover:text-header-fg',
                )}
              >
                <Icon className="size-4" /> {t(`nav.${key}`)}
              </a>
            ))}
          </nav>
          <div className="flex min-w-0 items-center gap-1 justify-self-end">
            {demo ? (
              <span className="flex items-center gap-2 text-xs whitespace-nowrap" title={t('demo.badgeHint')}>
                <span className="font-medium">{t('demo.badge')}</span>
                <button className="text-header-muted underline underline-offset-2 hover:text-header-fg" onClick={() => void exitDemo()}>{t('demo.exit')}</button>
              </span>
            ) : <SaveStatus />}
            <BusinessSwitcher />
          </div>
        </div>
      </header>
      <main>
        {/* Remount on demo toggle so no editor keeps a draft from the other data set. */}
        <div key={`${section}:${demo}`} className="animate-rise mx-auto max-w-6xl p-8">{children}</div>
      </main>
      <ConflictBanner />
    </div>
  )
}
