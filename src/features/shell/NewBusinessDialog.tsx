import { FolderPlus, X } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { folderName } from '@/domain/folderName'
import { useStore } from '@/state/store'
import { FsAccessAdapter } from '@/storage/fsAccess'
import { Button, Card, Field } from '@/ui/primitives'
import { navigate } from '@/ui/router'

/**
 * Adding a business, explained before the system folder window opens: the user names the business, we say what the
 * window will ask, then create the folder inside the place they pick. Onboarding starts with the name filled in.
 */
export function NewBusinessDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()
  const current = useStore((s) => s.adapter?.name ?? '')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [nameError, setNameError] = useState('')
  const [busy, setBusy] = useState(false)
  const folder = folderName(name)

  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) onClose() }
    document.addEventListener('keydown', esc)
    return () => document.removeEventListener('keydown', esc)
  }, [onClose, busy])

  async function open(make: () => Promise<FsAccessAdapter | { insideBusiness: string }>, typed?: string) {
    setError('')
    setBusy(true)
    try {
      const r = await make()
      if (!(r instanceof FsAccessAdapter)) return setError(t('business.insideBusiness', { folder: r.insideBusiness }))
      if (await r.isSame(useStore.getState().adapter)) return onClose()
      await useStore.getState().switchTo(r, typed)
      navigate('/')
      onClose()
    } catch (e) {
      const n = (e as Error).name
      if (n === 'AbortError') setError(t('business.aborted'))
      else if ((e as Error).message === 'unsaved') setError(t('business.unsaved'))
      else setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return setNameError(t('business.nameMissing'))
    void open(() => FsAccessAdapter.createIn(folder), name.trim())
  }

  // Portal: the page container animates with a transform, which would otherwise trap this fixed overlay inside it.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-scrim/50 p-6 backdrop-blur-sm" onClick={() => !busy && onClose()}>
      <Card className="animate-rise w-full max-w-lg p-8">
        <form onSubmit={submit} onClick={(e) => e.stopPropagation()} className="space-y-6">
          <div className="flex items-start justify-between gap-4">
            <h2 className="font-display text-2xl font-bold tracking-[-0.015em]">{t('business.dialogTitle')}</h2>
            <Button type="button" size="sm" variant="ghost" onClick={onClose} title={t('common.cancel')}><X className="size-4" /></Button>
          </div>
          <p className="text-sm text-fg-muted">{t('business.dialogIntro')}</p>

          <Field label={t('business.name')} hint={t('business.nameHint')} error={nameError} required autoFocus
            value={name} onChange={(e) => { setName(e.target.value); setNameError('') }} />

          <div>
            <div className="mb-2 text-sm font-medium">{t('business.stepsTitle')}</div>
            <ol className="list-decimal space-y-1.5 pl-5 text-sm text-fg-muted marker:text-fg-subtle">
              <li>{t('business.step1', { current })}</li>
              <li>{t('business.step2')}</li>
              <li>{t('business.step3')}</li>
              <li>{t('business.step4', { folder })}</li>
            </ol>
          </div>

          {error && <p className="rounded-lg bg-surface-2 p-3 text-sm text-danger">{error}</p>}

          <div className="space-y-3">
            <Button type="submit" size="lg" className="w-full" disabled={busy}>
              <FolderPlus className="size-5" /> {t('business.choosePlace')}
            </Button>
            <button type="button" disabled={busy} onClick={() => void open(() => FsAccessAdapter.pick())}
              className="w-full text-center text-sm text-accent underline underline-offset-2 decoration-line-strong hover:decoration-current">
              {t('business.existing')}
            </button>
          </div>
        </form>
      </Card>
    </div>,
    document.body,
  )
}
