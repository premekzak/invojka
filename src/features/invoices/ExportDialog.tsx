import { Download, FileOutput, FolderDown, Loader2, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { accountingCsv, exportable, inPeriod, isdocProblem, periodRange, toIsdoc } from '@/domain/accounting'
import { today } from '@/domain/id'
import { zip, type ZipEntry } from '@/domain/zip'
import { renderPdf } from '@/pdf'
import { useStore } from '@/state/store'
import { useFormat } from '@/ui/format'
import { Button, Card, Checkbox, Labeled, Select } from '@/ui/primitives'
import { downloadBlob } from './PdfPreview'

const safe = (s: string) => s.replace(/[\\/:*?"<>|]/g, '-')

/**
 * The export for the accountant: a CSV overview, the documents as ISDOC for their accounting program, and optionally
 * the PDFs, for one month, quarter or year; downloaded as one ZIP or saved into the data folder (docs/accounting-export.md).
 */
export function ExportDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()
  const f = useFormat()
  const { invoices, settings, adapter, upsertInvoices } = useStore()
  // Default: the previous month, the usual handover to an accountant.
  const prev = useMemo(() => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1); return d }, [])
  const [year, setYear] = useState(String(prev.getFullYear()))
  const [period, setPeriod] = useState(String(prev.getMonth() + 1).padStart(2, '0'))
  const [want, setWant] = useState({ csv: true, isdoc: true, pdf: false })
  const [busy, setBusy] = useState<string>()
  const [done, setDone] = useState<string>()
  const [error, setError] = useState<string>()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !busy && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, busy])

  const years = useMemo(() => [...new Set([String(new Date().getFullYear()), ...invoices.map((i) => i.issueDate.slice(0, 4))])].sort().reverse(), [invoices])
  const [from, to, label] = periodRange(year, period)
  const docs = useMemo(() => invoices.filter((i) => exportable(i) && inPeriod(i, from, to)).sort((a, b) => a.issueDate.localeCompare(b.issueDate) || a.number.localeCompare(b.number)), [invoices, from, to])
  const noRate = docs.filter((d) => isdocProblem(d))
  const before = docs.filter((d) => d.exportedAt).length

  /** The files of this export, by path inside the ZIP or the export folder. */
  async function build(): Promise<ZipEntry[]> {
    const enc = new TextEncoder()
    const out: ZipEntry[] = []
    if (want.csv) out.push({ name: `prehled-${label}.csv`, data: enc.encode(accountingCsv(docs)) })
    if (want.isdoc) for (const d of docs) if (!isdocProblem(d)) out.push({ name: `isdoc/${safe(d.number)}.isdoc`, data: enc.encode(toIsdoc(d, settings!)) })
    if (want.pdf) {
      for (const [i, d] of docs.entries()) {
        setBusy(t('export.renderingPdf', { done: i + 1, total: docs.length }))
        out.push({ name: `pdf/${safe(d.number)}.pdf`, data: new Uint8Array(await (await renderPdf(d, settings!)).arrayBuffer()) })
      }
    }
    return out
  }

  /** Records the export on the documents, so the list can tell what the accountant already has. */
  const markExported = () => upsertInvoices(docs.map((d) => ({ ...d, exportedAt: today() })))

  async function run(where: 'download' | 'folder') {
    setError(undefined)
    setDone(undefined)
    setBusy(t('export.preparing'))
    try {
      const files = await build()
      if (where === 'download') {
        const single = files.length === 1 && files[0]!.name.endsWith('.csv')
        downloadBlob(new Blob([(single ? files[0]!.data : zip(files)) as BlobPart], { type: single ? 'text/csv' : 'application/zip' }), single ? files[0]!.name : `invojka-${label}.zip`)
        setDone(t('export.downloaded', { count: docs.length }))
      } else {
        for (const file of files) await adapter!.writeBinary(`export/${label}/${file.name}`, new Blob([file.data as BlobPart]))
        setDone(t('export.saved', { count: docs.length, path: `${adapter!.name}/export/${label}` }))
      }
      markExported()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(undefined)
    }
  }

  const months = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'))
  const monthName = (m: string) => new Intl.DateTimeFormat(f.lang === 'cs' ? 'cs-CZ' : 'en-GB', { month: 'long' }).format(new Date(2000, Number(m) - 1, 1))
  const nothing = !want.csv && !want.isdoc && !want.pdf

  // Portal: the animated page container would otherwise trap this fixed overlay.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-scrim/50 p-6 backdrop-blur-sm" onClick={() => !busy && onClose()}>
      <Card className="animate-rise flex max-h-full w-full max-w-xl flex-col overflow-hidden">
        <div className="flex items-center gap-2 border-b border-line px-6 py-3" onClick={(e) => e.stopPropagation()}>
          <FileOutput aria-hidden="true" className="size-4 text-fg-muted" />
          <h2 className="font-medium">{t('export.title')}</h2>
          <Button size="sm" variant="ghost" className="ml-auto" aria-label={t('common.close')} disabled={!!busy} onClick={onClose}><X className="size-4" /></Button>
        </div>
        <div className="flex-1 space-y-5 overflow-auto px-6 py-5" onClick={(e) => e.stopPropagation()}>
          <p className="max-w-prose text-sm">{t('export.intro')}</p>
          <div className="grid grid-cols-2 gap-4 mobile-stack">
            <Labeled label={t('export.year')}>
              <Select value={year} onChange={(e) => setYear(e.target.value)}>{years.map((y) => <option key={y}>{y}</option>)}</Select>
            </Labeled>
            <Labeled label={t('export.period')}>
              <Select value={period} onChange={(e) => setPeriod(e.target.value)}>
                <option value="year">{t('export.wholeYear')}</option>
                {[1, 2, 3, 4].map((q) => <option key={q} value={`q${q}`}>{t('export.quarter', { q })}</option>)}
                {months.map((m) => <option key={m} value={m}>{monthName(m)}</option>)}
              </Select>
            </Labeled>
          </div>
          <div className="space-y-2">
            <Checkbox label={t('export.csv')} hint={t('export.csvHint')} checked={want.csv} onChange={(e) => setWant({ ...want, csv: e.target.checked })} />
            <Checkbox label={t('export.isdoc')} hint={t('export.isdocHint')} checked={want.isdoc} onChange={(e) => setWant({ ...want, isdoc: e.target.checked })} />
            <Checkbox label={t('export.pdf')} hint={t('export.pdfHint')} checked={want.pdf} onChange={(e) => setWant({ ...want, pdf: e.target.checked })} />
          </div>
          <p className="text-sm">
            {docs.length ? t('export.count', { count: docs.length, from: f.date(from), to: f.date(to > today() ? today() : to) }) : t('export.none')}
            {before > 0 && <span className="text-fg-muted"> {t('export.before', { count: before })}</span>}
          </p>
          {want.isdoc && noRate.length > 0 && (
            <p className="max-w-prose text-xs font-medium text-warning">{t('export.noRate', { numbers: noRate.map((d) => d.number).join(', ') })}</p>
          )}
          <p className="max-w-prose text-xs text-fg-muted">{t('export.privacy')}</p>
          {busy && <p role="status" className="flex items-center gap-2 text-sm text-fg-muted"><Loader2 className="size-4 animate-spin" /> {busy}</p>}
          {done && <p role="status" className="text-sm font-medium text-success">{done}</p>}
          {error && <p role="alert" className="text-sm font-medium text-danger">{error}</p>}
        </div>
        <div className="flex justify-end gap-2 border-t border-line px-6 py-3" onClick={(e) => e.stopPropagation()}>
          <Button variant="secondary" disabled={!docs.length || nothing || !!busy} onClick={() => void run('folder')}><FolderDown className="size-4" /> {t('export.toFolder')}</Button>
          <Button disabled={!docs.length || nothing || !!busy} onClick={() => void run('download')}><Download className="size-4" /> {t('export.download')}</Button>
        </div>
      </Card>
    </div>,
    document.body,
  )
}
