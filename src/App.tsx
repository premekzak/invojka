import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CustomerDetail } from '@/features/customers/CustomerDetail'
import { CustomerList } from '@/features/customers/CustomerList'
import { Home } from '@/features/home/Home'
import { InvoiceEditor } from '@/features/invoices/InvoiceEditor'
import { InvoiceList } from '@/features/invoices/InvoiceList'
import { Onboarding } from '@/features/onboarding/Onboarding'
import { Welcome } from '@/features/onboarding/Welcome'
import { SettingsPage } from '@/features/settings/SettingsPage'
import { Layout } from '@/features/shell/Layout'
import { setUiLanguage } from '@/i18n'
import { useStore } from '@/state/store'
import { FsAccessAdapter, isSupported } from '@/storage/fsAccess'
import { Button, Card } from '@/ui/primitives'
import { useRoute } from '@/ui/router'

function useTheme() {
  const theme = useStore((s) => s.settings?.ui.theme ?? 'system')
  useEffect(() => {
    const mq = matchMedia('(prefers-color-scheme: dark)')
    const apply = () => document.documentElement.classList.toggle('dark', theme === 'dark' || (theme === 'system' && mq.matches))
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [theme])
}

export function App() {
  const { t } = useTranslation()
  const { phase, open, reload, setPhase, settings } = useStore()
  const [remembered, setRemembered] = useState<FsAccessAdapter>()
  useTheme()

  useEffect(() => {
    if (settings) setUiLanguage(settings.ui.language)
  }, [settings])

  // On start: reopen the remembered folder directly if permission is still granted, otherwise offer one-click reconnect.
  useEffect(() => {
    if (!isSupported()) return setPhase({ kind: 'noFolder' })
    FsAccessAdapter.remembered()
      .then((r) => {
        if (r?.granted) return open(r.adapter)
        setRemembered(r?.adapter)
        setPhase(r ? { kind: 'needsPermission', folder: r.adapter.name } : { kind: 'noFolder' })
      })
      .catch(() => setPhase({ kind: 'noFolder' }))
  }, [open, setPhase])

  switch (phase.kind) {
    case 'boot':
      return null
    case 'noFolder':
    case 'needsPermission':
      return <Welcome remembered={phase.kind === 'needsPermission' ? remembered : undefined} />
    case 'onboarding':
      return <Onboarding />
    case 'error':
      return (
        <div className="grid min-h-screen place-items-center p-6">
          <Card className="max-w-lg p-8">
            <h1 className="font-display text-2xl font-bold tracking-[-0.015em] text-danger">{t('error.title')}</h1>
            <p className="mt-2 font-mono text-sm break-words text-fg-muted">{phase.message}</p>
            <div className="mt-6 flex gap-2">
              <Button onClick={() => void reload()}>{t('error.retry')}</Button>
              <Button variant="ghost" onClick={() => setPhase({ kind: 'noFolder' })}>{t('welcome.other')}</Button>
            </div>
          </Card>
        </div>
      )
    case 'ready':
      return <Screens />
  }
}

function Screens() {
  const route = useRoute()
  const [section = 'home', id] = route.path
  const page =
    section === 'invoices' && id ? <InvoiceEditor route={route} />
    : section === 'invoices' ? <InvoiceList route={route} />
    : section === 'customers' && id ? <CustomerDetail route={route} />
    : section === 'customers' ? <CustomerList />
    : section === 'settings' ? <SettingsPage />
    : <Home />
  // Keyed by the full route so each screen starts fresh (e.g. /invoices/new twice in a row).
  return <Layout section={section}><div key={route.path.join('/') + route.query}>{page}</div></Layout>
}
