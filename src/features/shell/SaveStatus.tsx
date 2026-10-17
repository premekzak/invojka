import { AlertTriangle, Check, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { FILES } from '@/domain/schema'
import { useStore } from '@/state/store'
import { Button, Card, cn } from '@/ui/primitives'

/**
 * A tick next to the business name when everything is in the folder (the owner's request, 2026-10-17); the sentence and the
 * folder name are in its tooltip. A save in progress is a small spinner; a problem is a solid chip with words, never just an icon.
 */
export function SaveStatus() {
  const { t, i18n } = useTranslation()
  const { saveState, saveError, savedAt, adapter } = useStore()
  const problem = saveState === 'error' || saveState === 'conflict'
  const label = saveState === 'saved' && savedAt
    ? t('save.savedAt', { time: new Date(savedAt).toLocaleTimeString(i18n.language, { hour: 'numeric', minute: '2-digit' }) })
    : t(`save.${saveState}`)
  const title = [label, t('save.folder', { folder: adapter?.name }), saveState === 'saved' ? t('save.folderHint') : saveError].filter(Boolean).join('\n')
  if (problem) {
    return (
      <span title={title} className="inline-flex items-center gap-1 rounded-sm bg-danger px-1.5 py-0.5 text-xs font-medium whitespace-nowrap text-danger-fg">
        <AlertTriangle className="size-3.5" /> {label}
      </span>
    )
  }
  const Icon = saveState === 'saved' ? Check : Loader2
  return (
    <span title={title} role="status" className={cn('inline-flex shrink-0', saveState === 'saved' ? 'text-header-fg' : 'text-header-muted')}>
      <Icon className={cn('size-4', saveState !== 'saved' && 'animate-spin')} aria-hidden />
      <span className="sr-only">{label}</span>
    </span>
  )
}

export function ConflictBanner() {
  const { t } = useTranslation()
  const { conflictFile, reload, forceSave } = useStore()
  if (!conflictFile) return null
  return (
    <div className="fixed inset-x-0 bottom-6 z-50 flex justify-center px-6">
      <Card className="animate-rise max-w-xl border-line-strong p-5">
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
