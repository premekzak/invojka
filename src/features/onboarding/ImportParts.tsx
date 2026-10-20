import { Check, FileUp } from 'lucide-react'
import type { TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'
import { ImportError, type ImportResult } from '@/import/csv'
import { cn } from '@/ui/primitives'

/** A box to pick a CSV file in, ticked once a file is in. Shared by onboarding and Settings → Import. */
export function DropZone({ done, label, onFile }: { done: boolean; label: string; onFile: (f: File | undefined) => void }) {
  return (
    <label className={cn(
      'flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed p-6 text-center text-sm transition-colors',
      done ? 'border-line-strong bg-surface-2' : 'border-line hover:border-link',
    )}>
      {done ? <Check className="size-6 text-success" /> : <FileUp className="size-6 text-fg-subtle" />}
      <span className="font-medium">{label}</span>
      <input type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = '' }} />
    </label>
  )
}

/** What went wrong reading an export, in words; `file` names the file for an iDoklad error. */
export function importErrorText(t: TFunction, e: unknown, source: 'fakturoid' | 'idoklad'): string {
  if (!(e instanceof ImportError)) return t('onboarding.importError.failed', { message: (e as Error).message })
  if (source === 'fakturoid') {
    return e.reason === 'unknownFormat' ? t('onboarding.fakturoidUnknown') : t(`onboarding.importError.${e.reason}`, { file: t('onboarding.fakturoidCsv') })
  }
  return t(`onboarding.importError.${e.reason}`, { file: t(e.file === 'customers' ? 'onboarding.customersCsv' : 'onboarding.invoicesCsv') })
}

/** Who was merged and what to check, under an import's counts. */
export function ImportNotes({ result }: { result: ImportResult }) {
  const { t } = useTranslation()
  return <>
    {result.merges.length > 0 && (
      <div>
        <p className="text-fg-muted">{t('onboarding.merged')}:</p>
        <ul className="mt-1 list-inside list-disc text-fg-muted">
          {result.merges.map((m) => {
            // The same name twice is a repeated row, not a merge of two names.
            const others = m.merged.filter((n) => n !== m.kept)
            return <li key={m.kept}>{m.kept} {others.length ? `← ${others.join(', ')}` : `(${t('onboarding.listedTwice')})`}</li>
          })}
        </ul>
      </div>
    )}
    {result.warnings.map((w) => <p key={w} className="text-warning">{w}</p>)}
  </>
}
