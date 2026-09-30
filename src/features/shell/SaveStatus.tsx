import { AlertTriangle, Check, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { FILES } from '@/domain/schema'
import { useStore } from '@/state/store'
import { Button, Card, cn } from '@/ui/primitives'

export function SaveStatus() {
  const { t } = useTranslation()
  const { saveState, saveError } = useStore()
  const Icon = saveState === 'saved' ? Check : saveState === 'saving' || saveState === 'pending' ? Loader2 : AlertTriangle
  return (
    <span
      title={saveError}
      className={cn(
        'inline-flex items-center gap-1.5 text-xs transition-colors',
        saveState === 'saved' ? 'text-fg-subtle' : saveState === 'error' || saveState === 'conflict' ? 'text-danger' : 'text-fg-muted',
      )}
    >
      <Icon className={cn('size-3.5', saveState === 'saving' && 'animate-spin')} /> {t(`save.${saveState}`)}
    </span>
  )
}

export function ConflictBanner() {
  const { t } = useTranslation()
  const { conflictFile, reload, forceSave } = useStore()
  if (!conflictFile) return null
  return (
    <div className="fixed inset-x-0 bottom-6 z-50 flex justify-center px-6">
      <Card className="animate-rise max-w-xl border-warning/40 p-5">
        <p className="font-medium">{t('conflict.title', { file: FILES[conflictFile] })}</p>
        <p className="mt-1 text-sm text-fg-muted">{t('conflict.body')}</p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => void reload()}>{t('conflict.reload')}</Button>
          <Button variant="danger" onClick={() => void forceSave()}>{t('conflict.overwrite')}</Button>
        </div>
      </Card>
    </div>
  )
}
