import { FolderOpen, FolderSearch, FolderSync } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { openBusiness } from '@/features/shell/BusinessSwitcher'
import { useStore } from '@/state/store'
import { FsAccessAdapter, isSupported, type RememberedFolder } from '@/storage/fsAccess'
import { Logo, WORDMARK } from '@/ui/Logo'
import { Button, Card } from '@/ui/primitives'

/** `missing`: the remembered folder is gone from where it was (moved, renamed, deleted); the user picks it again. */
export function Welcome({ remembered, missing }: { remembered?: FsAccessAdapter; missing?: FsAccessAdapter }) {
  const { t } = useTranslation()
  const { open, setPhase } = useStore()
  const [others, setOthers] = useState<RememberedFolder[]>([])
  const [error, setError] = useState('')
  const known = remembered ?? missing

  // The other businesses the user has opened before, so they can start in any of them.
  useEffect(() => {
    if (!known) return
    void FsAccessAdapter.list().then(async (list) => {
      const rest = []
      for (const f of list) if (!(await f.adapter.isSame(known))) rest.push(f)
      setOthers(rest)
    })
  }, [known])

  async function pick() {
    try {
      const picked = await FsAccessAdapter.pick()
      // The folder at its new place replaces the old entry, so the switcher doesn't list the business twice.
      if (missing && !(await picked.isSame(missing))) await missing.forgetFolder()
      await open(picked)
    } catch (e) {
      if ((e as Error).name !== 'AbortError') throw e
    }
  }

  async function reconnect() {
    if (!remembered) return
    try {
      if (await remembered.reconnect()) await open(remembered)
    } catch (e) {
      if (!(e instanceof DOMException && e.name === 'NotFoundError')) throw e
      setPhase({ kind: 'missingFolder', folder: remembered.name })
    }
  }

  const otherBusinesses = others.length > 0 && (
    <div className="space-y-1 pt-3">
      <p className="text-xs text-fg-muted">{t('business.others')}</p>
      {others.map((f) => (
        <Button key={f.adapter.name + f.label} variant="secondary" className="w-full" onClick={async () => {
          if ((await openBusiness(f.adapter)) === 'denied') setError(t('business.denied', { folder: f.adapter.name }))
        }}>{t('business.open', { name: f.label })}</Button>
      ))}
      {error && <p className="text-xs font-medium text-danger">{error}</p>}
    </div>
  )

  return (
    <div className="grid min-h-screen place-items-center p-6">
      <Card className="animate-rise w-full max-w-md p-8">
        <div className="mb-6 flex items-center gap-3">
          <Logo className="size-10" />
          <div>
            <h1 className="font-display text-4xl leading-[1.2] font-bold tracking-[-0.01em]">{WORDMARK}</h1>
            <p className="text-sm text-fg-muted">{t('app.tagline')}</p>
          </div>
        </div>

        {!isSupported() ? (
          <p className="rounded-lg bg-surface-2 p-4 text-sm text-warning">{t('welcome.unsupported')}</p>
        ) : missing ? (
          <div className="space-y-3">
            <p className="rounded-lg bg-surface-2 p-4 text-sm">{t('welcome.missing', { folder: missing.name })}</p>
            <Button size="lg" className="w-full" onClick={pick} autoFocus>
              <FolderSearch className="size-5" /> {t('welcome.findMoved')}
            </Button>
            <p className="text-xs text-fg-muted">{t('welcome.findMovedHint')}</p>
            {otherBusinesses}
          </div>
        ) : remembered ? (
          <div className="space-y-3">
            <Button size="lg" className="w-full" onClick={reconnect} autoFocus>
              <FolderSync className="size-5" /> {t('welcome.reconnect', { folder: remembered.name })}
            </Button>
            <p className="text-xs text-fg-muted">{t('welcome.reconnectHint')}</p>
            {otherBusinesses}
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
