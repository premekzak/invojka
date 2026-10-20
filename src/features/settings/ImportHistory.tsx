import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { importCsv, type ImportResult } from '@/import/csv'
import { importFakturoid, isFakturoidCsv } from '@/import/fakturoid'
import { mergeImport } from '@/import/merge'
import { DropZone, ImportNotes, importErrorText } from '@/features/onboarding/ImportParts'
import { useStore } from '@/state/store'
import { Button, Choice } from '@/ui/primitives'

type Source = 'fakturoid' | 'idoklad'

/**
 * Settings → Aplikace: load history from Fakturoid or iDoklad after onboarding, or a second export. The import is added
 * to what's there (import/merge.ts): documents already in Invojka stay as they are. Your details and number formats
 * aren't touched; they were set in onboarding and may have changed since.
 */
export function ImportHistory() {
  const { t } = useTranslation()
  const { settings, customers, invoices, replaceAll } = useStore()
  const [source, setSource] = useState<Source>('fakturoid')
  const [files, setFiles] = useState<{ customers?: string; invoices?: string; fakturoid?: string }>({})
  const [result, setResult] = useState<ImportResult>()
  const [error, setError] = useState<string>()
  const [done, setDone] = useState<{ invoices: number; customers: number }>()
  const vatMode = settings!.vatMode
  const merged = useMemo(() => result && mergeImport({ customers, invoices }, result), [result, customers, invoices])
  // The opening balance stands for this year's documents from elsewhere; imported ones of that year would count twice.
  const opening = settings!.opening
  const overlapsOpening = useMemo(() => {
    if (!merged || !opening.year) return false
    const there = new Set(invoices.map((i) => i.id))
    return merged.invoices.some((i) => !there.has(i.id) && i.issueDate.startsWith(`${opening.year}-`))
  }, [merged, invoices, opening.year])
  const nothingNew = !!merged && !merged.addedInvoices && !merged.addedCustomers

  function reset(s: Source) {
    setSource(s)
    setFiles({})
    setResult(undefined)
    setError(undefined)
    setDone(undefined)
  }

  async function read(kind: 'fakturoid' | 'customers' | 'invoices', f: File | undefined) {
    if (!f) return
    const text = await f.text()
    const next = { ...files, [kind]: text }
    setFiles(next)
    setResult(undefined)
    setError(undefined)
    setDone(undefined)
    try {
      if (kind === 'fakturoid') setResult(importFakturoid(text, vatMode))
      else if (isFakturoidCsv(text)) setError(t('importHistory.looksLikeFakturoid'))
      else if (next.customers !== undefined && next.invoices !== undefined) setResult(importCsv(next.customers, next.invoices, vatMode))
    } catch (e) {
      setError(importErrorText(t, e, source))
    }
  }

  function apply() {
    if (!merged) return
    replaceAll({ customers: merged.customers, invoices: merged.invoices })
    setDone({ invoices: merged.addedInvoices, customers: merged.addedCustomers })
    setFiles({})
    setResult(undefined)
  }

  return (
    <div className="space-y-5">
      <p className="max-w-prose text-sm text-fg-muted">{t('importHistory.hint')}</p>
      <div role="radiogroup" aria-label={t('importHistory.title')} className="grid grid-cols-2 gap-3 mobile-stack">
        {(['fakturoid', 'idoklad'] as const).map((s) => (
          <Choice key={s} selected={source === s} onClick={() => reset(s)} title={t(`importHistory.sources.${s}`)}
            hint={t(`importHistory.sources.${s}Hint`)} />
        ))}
      </div>
      {source === 'fakturoid'
        ? <DropZone done={files.fakturoid !== undefined && !error} label={t('onboarding.fakturoidCsv')} onFile={(f) => void read('fakturoid', f)} />
        : (
          <div className="grid grid-cols-2 gap-4 mobile-stack">
            {(['customers', 'invoices'] as const).map((kind) => (
              <DropZone key={kind} done={files[kind] !== undefined} label={t(kind === 'customers' ? 'onboarding.customersCsv' : 'onboarding.invoicesCsv')}
                onFile={(f) => void read(kind, f)} />
            ))}
          </div>
        )}
      {error && <p className="rounded-lg bg-surface-2 p-3 text-sm text-danger">{error}</p>}
      {result && merged && (
        <div className="animate-rise space-y-3 rounded-xl bg-surface-2 p-4 text-sm">
          <p className="font-medium">{nothingNew ? t('importHistory.nothingNew')
            : t('importHistory.preview', { invoices: merged.addedInvoices, customers: merged.addedCustomers })}</p>
          {merged.skipped > 0 && !nothingNew && <p className="text-fg-muted">{t('importHistory.skipped', { count: merged.skipped })}</p>}
          <ImportNotes result={result} />
          {overlapsOpening && <p className="text-warning">{t('importHistory.opening', { year: opening.year })}</p>}
          {!nothingNew && <Button onClick={apply}>{t('importHistory.apply')}</Button>}
        </div>
      )}
      {done && <p role="status" className="rounded-lg bg-surface-2 p-3 text-sm">{t('importHistory.done', { invoices: done.invoices, customers: done.customers })}</p>}
    </div>
  )
}
