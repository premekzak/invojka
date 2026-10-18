import { FolderOpen, FolderSync } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { openBusiness } from '@/features/shell/BusinessSwitcher'
import { useStore } from '@/state/store'
import { FsAccessAdapter, isSupported, type RememberedFolder } from '@/storage/fsAccess'
import { Logo } from '@/ui/Logo'
import { Button, Card } from '@/ui/primitives'

export function Welcome({ remembered }: { remembered?: FsAccessAdapter }) {
  const { t } = useTranslation()
  const open = useStore((s) => s.open)
  const [others, setOthers] = useState<RememberedFolder[]>([])
  const [error, setError] = useState('')

  // The other businesses the user has opened before, so they can start in any of them.
  useEffect(() => {
    if (!remembered) return
    void FsAccessAdapter.list().then(async (list) => {
      const rest = []
      for (const f of list) if (!(await f.adapter.isSame(remembered))) rest.push(f)
      setOthers(rest)
    })
  }, [remembered])

  async function pick() {
    try {
      await open(await FsAccessAdapter.pick())
    } catch (e) {
      if ((e as Error).name !== 'AbortError') throw e
    }
  }

  async function reconnect() {
    if (remembered && (await remembered.reconnect())) await open(remembered)
  }

  return (
    <div className="grid min-h-screen place-items-center p-6">
      <Card className="animate-rise w-full max-w-md p-8">
        <div className="mb-6 flex items-center gap-3">
          <Logo className="size-10" />
          <div>
            <h1 className="font-display text-4xl leading-[1.2] font-bold tracking-[-0.01em]">{t('app.name')}</h1>
            <p className="text-sm text-fg-muted">{t('app.tagline')}</p>
          </div>
        </div>

        {!isSupported() ? (
          <p className="rounded-lg bg-surface-2 p-4 text-sm text-warning">{t('welcome.unsupported')}</p>
        ) : remembered ? (
          <div className="space-y-3">
            <Button size="lg" className="w-full" onClick={reconnect} autoFocus>
              <FolderSync className="size-5" /> {t('welcome.reconnect', { folder: remembered.name })}
            </Button>
            <p className="text-xs text-fg-muted">{t('welcome.reconnectHint')}</p>
            {others.length > 0 && (
              <div className="space-y-1 pt-3">
                <p className="text-xs text-fg-muted">{t('business.others')}</p>
                {others.map((f) => (
                  <Button key={f.adapter.name + f.label} variant="secondary" className="w-full" onClick={async () => {
                    if ((await openBusiness(f.adapter)) === 'denied') setError(t('business.denied', { folder: f.adapter.name }))
                  }}>{t('business.open', { name: f.label })}</Button>
                ))}
                {error && <p className="text-xs font-medium text-danger">{error}</p>}
              </div>
            )}
            <Button variant="ghost" className="w-full" onClick={pick}>{t('welcome.other')}</Button>
          </div>
        ) : (
          <div className="space-y-3">
            <Button size="lg" className="w-full" onClick={pick} autoFocus>
              <FolderOpen className="size-5" /> {t('welcome.pick')}
            </Button>
            <p className="text-xs text-fg-muted">{t('welcome.pickHint')}</p>
          </div>
        )}
      </Card>
    </div>
  )
}
