import { FileText, Home, Settings, Users } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useStore } from '@/state/store'
import { Logo } from '@/ui/Logo'
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
    <div className="flex min-h-screen flex-col">
      {/* The peach header band, one row (the owner's choice, 2026-10-17, replacing the sidebar): the logo on the left,
          the pages as centred pills, the business with its save tick on the right. "Nová faktura" lives on the invoice list and in Home's blue tile. */}
      <header className="bg-header text-header-fg">
        <div className="mx-auto grid max-w-6xl grid-cols-[1fr_auto_1fr] items-center gap-6 px-8 py-3">
          <a href="#/" className="flex items-center gap-2 justify-self-start" title={t('nav.home')}>
            <Logo className="size-7" />
            <span className="font-display text-lg font-bold tracking-[-0.015em]">{t('app.name')}</span>
          </a>
          {/* Pills with a 12 px radius, the one place with corners this round (the owner's exception to "no pills", navigation only). */}
          <nav className="flex gap-2 font-nav font-medium tracking-[0.02em]">
            {items.map(({ key, path, icon: Icon }) => (
              <a
                key={key}
                href={`#${path}`}
                aria-current={section === key ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-2 rounded-[12px] px-4 py-1.5 text-sm whitespace-nowrap transition-colors',
                  section === key ? 'bg-header-active text-header-fg' : 'text-header-muted hover:bg-header-active/50 hover:text-header-fg',
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
      <main className="flex-1">
        {/* Remount on demo toggle so no editor keeps a draft from the other data set. */}
        <div key={`${section}:${demo}`} className="animate-rise mx-auto max-w-6xl px-8 pt-12 pb-8">{children}</div>
      </main>
      {/* Espresso with a very slight gradient (the owner's request, 2026-10-17); `on-espresso` gives the logo its dark-mode
          colours (an orange receipt), which stay visible on espresso. */}
      <footer className="on-espresso mt-16 bg-linear-to-b from-footer to-footer-deep text-footer-fg">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-8 px-8 py-8">
          <div className="flex items-center gap-3">
            <Logo className="size-7" />
            <div>
              <div className="font-display text-lg font-bold tracking-[-0.015em]">{t('app.name')}</div>
              <div className="text-xs text-footer-muted">{t('app.tagline')}</div>
            </div>
          </div>
          <div className="text-right text-xs text-footer-muted">
            <div>{t('app.footerNote')}</div>
            <a href="https://invojka.cz" target="_blank" rel="noopener noreferrer" className="font-medium text-footer-fg underline underline-offset-2 decoration-footer-muted hover:decoration-current">invojka.cz</a>
          </div>
        </div>
      </footer>
      <ConflictBanner />
    </div>
  )
}
