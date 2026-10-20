import { BarChart3, FileText, Home, Menu, Settings, Users, X } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useStore } from '@/state/store'
import { Logo, WORDMARK } from '@/ui/Logo'
import { cn } from '@/ui/primitives'
import { BusinessSwitcher } from './BusinessSwitcher'
import { ConflictBanner, SaveStatus } from './SaveStatus'

const items = [
  { key: 'home', path: '/', icon: Home },
  { key: 'invoices', path: '/invoices', icon: FileText },
  { key: 'customers', path: '/customers', icon: Users },
  { key: 'stats', path: '/stats', icon: BarChart3 },
  { key: 'settings', path: '/settings', icon: Settings },
] as const

/**
 * Phones (the owner, 2026-10-18): the pages as a list under the header, opened from the menu button. It sits in the page
 * flow, so it pushes the page down rather than covering it; choosing a page or Escape closes it.
 */
function MobileMenu({ section, onClose }: { section: string; onClose: () => void }) {
  const { t } = useTranslation()
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <nav id="mobile-menu" className="border-b border-line bg-surface py-1 font-nav font-medium tracking-[0.02em] md:hidden">
      {items.map(({ key, path, icon: Icon }) => (
        <a key={key} href={`#${path}`} onClick={onClose} aria-current={section === key ? 'page' : undefined}
          className={cn('flex items-center gap-3 px-4 py-3 text-sm transition-colors',
            section === key ? 'bg-surface-2 text-fg' : 'text-fg-muted hover:bg-tint hover:text-fg')}>
          <Icon className="size-4" /> {t(`nav.${key}`)}
        </a>
      ))}
    </nav>
  )
}

export function Layout({ section, children }: { section: string; children: ReactNode }) {
  const { t } = useTranslation()
  const { demo } = useStore()
  const [menu, setMenu] = useState(false)
  // A page change (also by the back button) closes the phone menu.
  useEffect(() => setMenu(false), [section])
  return (
    <div className="flex min-h-screen flex-col">
      {/* The peach header band, one row (the owner's choice, 2026-10-17, replacing the sidebar): the logo on the left,
          the pages as centred tabs (a menu button on phones), the business with its save tick on the right. "Nová faktura" lives on the invoice list and in Home's blue tile. */}
      <header className="scheme-header bg-header text-header-fg">
        {/* One line, as much room above the text as below (the owner, 2026-10-18): the logo, the tabs and the business each
            fill the band's full 48 px height and are centred in it; the current tab is a plain block of the page colour. */}
        <div className="mx-auto grid max-w-6xl grid-cols-[1fr_auto_auto] gap-x-3 px-4 md:h-12 md:grid-cols-[1fr_auto_1fr] md:gap-x-6 md:px-8">
          <a href="#/" className="flex h-12 items-center gap-2 justify-self-start" title={t('nav.home')}>
            <Logo className="size-6" />
            <span className="font-display text-lg font-bold">{WORDMARK}</span>
          </a>
          {/* Tabs (the owner, 2026-10-18, replacing pills): the current one takes the page colour and page text, top to bottom,
              so it runs straight into the page below. */}
          <nav className="hidden font-nav font-medium tracking-[0.02em] md:flex">
            {items.map(({ key, path, icon: Icon }) => (
              <a
                key={key}
                href={`#${path}`}
                aria-current={section === key ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-2 px-4 text-sm whitespace-nowrap transition-colors',
                  section === key
                    ? 'bg-bg text-fg'
                    : 'text-header-muted hover:bg-header-hover hover:text-header-fg',
                )}
              >
                <Icon className="size-4" /> {t(`nav.${key}`)}
              </a>
            ))}
          </nav>
          <div className="flex h-12 min-w-0 items-center gap-1 justify-self-end">
            {/* Demo mode looks exactly like real data, for screenshots (the owner, 2026-10-18); it is switched off in Settings → Aplikace. */}
            <SaveStatus />
            <BusinessSwitcher />
          </div>
          <button type="button" className="-mr-2 flex size-12 items-center justify-center text-header-fg md:hidden"
            aria-expanded={menu} aria-controls="mobile-menu" aria-label={t(menu ? 'common.close' : 'nav.menu')} onClick={() => setMenu(!menu)}>
            {menu ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </header>
      {menu && <MobileMenu section={section} onClose={() => setMenu(false)} />}
      <main className="flex-1">
        {/* Remount on demo toggle so no editor keeps a draft from the other data set. */}
        <div key={`${section}:${demo}`} className="animate-rise mx-auto max-w-6xl px-4 pt-8 pb-8 md:px-8 md:pt-12">{children}</div>
      </main>
      {/* Espresso with a very slight gradient (the owner's request, 2026-10-17); `on-espresso` gives the logo its dark-mode
          colours (an orange receipt), which stay visible on espresso. */}
      <footer className="scheme-footer on-espresso mt-16 text-footer-fg">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-8 gap-y-4 px-4 py-8 md:px-8">
          <div className="flex items-center gap-3">
            <Logo className="size-7" />
            <div>
              <div className="font-display text-lg font-bold">{WORDMARK}</div>
              <div className="text-xs text-footer-muted">{t('app.tagline')}</div>
            </div>
          </div>
          <div className="text-xs text-footer-muted md:text-right">
            <div>{t('app.footerNote')}</div>
            <a href="https://invojka.cz" target="_blank" rel="noopener noreferrer" className="font-medium text-footer-fg underline underline-offset-2 decoration-footer-muted hover:decoration-current">invojka.cz</a>
          </div>
        </div>
      </footer>
      <ConflictBanner />
    </div>
  )
}
