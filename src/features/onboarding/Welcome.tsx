import { FolderOpen, FolderSync } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useStore } from '@/state/store'
import { FsAccessAdapter, isSupported } from '@/storage/fsAccess'
import { Button, Card } from '@/ui/primitives'

export function Welcome({ remembered }: { remembered?: FsAccessAdapter }) {
  const { t } = useTranslation()
  const open = useStore((s) => s.open)

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
          <div className="grid size-10 place-items-center rounded-xl bg-brand font-serif text-lg font-semibold text-surface">I</div>
          <div>
            <h1 className="font-serif text-4xl leading-[1.2] font-semibold">{t('app.name')}</h1>
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
