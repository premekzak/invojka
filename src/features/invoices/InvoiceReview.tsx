import { Loader2, TriangleAlert } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { invoiceTotals } from '@/domain/invoice'
import type { Invoice, Settings } from '@/domain/schema'
import { missingSupplierDetails } from '@/domain/supplier'
import { renderPdf } from '@/pdf'
import { useFormat } from '@/ui/format'
import { Card } from '@/ui/primitives'

const linkCls = 'text-left text-sm font-medium text-link underline underline-offset-2 decoration-line-strong hover:decoration-current'
const frameCls = 'h-[calc(100vh-16rem)] min-h-[32rem] w-full'

/**
 * The last step before issuing: the document itself, as the customer will get it (the same PDF that issuing stores),
 * beside what still has to be fixed (blocking), what is worth a second look (not blocking) and the ways back to each
 * step. `invoice` must keep its identity between renders (the PDF is rendered again whenever it changes).
 */
export function InvoiceReview({ invoice, provisionalNumber, settings, problems, due, dueLabel, onEdit, onEditSupplier }: {
  /** The document as it will be issued, with its final number. */
  invoice: Invoice; settings: Settings
  /** The number the draft has had so far; said when issuing changes it. */
  provisionalNumber: string
  problems: { id: string; message: string; step: number }[]
  due: number; dueLabel: string
  onEdit: (step: number, focusId?: string) => void; onEditSupplier: () => void
}) {
  const { t } = useTranslation()
  const f = useFormat()
  const [url, setUrl] = useState<string>()
  const [error, setError] = useState<string>()

  useEffect(() => {
    let gone = false
    let objectUrl: string | undefined
    setError(undefined)
    renderPdf(invoice, settings, 'invoice')
      .then((blob) => {
        if (gone) return
        objectUrl = URL.createObjectURL(blob)
        setUrl(objectUrl)
      })
      .catch((e: Error) => { if (!gone) setError(e.message) })
    return () => {
      gone = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [invoice, settings])

  const missing = missingSupplierDetails(settings, invoice.paymentMethod).map((k) => t(`editor.review.missing.${k}`))
  const warnings = [
    missing.length > 0 && { key: 'supplier', message: t('editor.review.supplierIncomplete', { list: missing.join(', ') }), action: t('editor.review.editSupplier'), go: onEditSupplier },
    invoice.lines.some((l) => !l.description.trim()) && { key: 'line', message: t('editor.review.emptyLine'), action: t('editor.review.editLines'), go: () => onEdit(2) },
    invoiceTotals(invoice).total === 0 && { key: 'zero', message: t('editor.review.zeroTotal'), action: t('editor.review.editLines'), go: () => onEdit(2) },
  ].filter((w): w is { key: string; message: string; action: string; go: () => void } => !!w)

  return (
    <div className="col-span-3 grid grid-cols-[minmax(0,1fr)_20rem] items-start gap-6 mobile-stack">
      <Card className="overflow-hidden">
        {error ? <p className="p-6 text-sm text-danger">{t('pdf.saveFailed')}: {error}</p>
          : url ? <iframe title={t('editor.review.pdfTitle')} src={url} className={`block ${frameCls}`} />
          : <div className={`grid place-items-center bg-surface-2 text-fg-muted ${frameCls}`}><Loader2 className="size-6 animate-spin" /></div>}
      </Card>

      <Card className="space-y-5 px-6 py-5">
        {problems.length > 0 && (
          <div role="alert" className="space-y-2 rounded-lg bg-error-chip p-4 text-sm">
            <p className="flex items-center gap-2 font-medium text-error"><TriangleAlert aria-hidden="true" className="size-4" /> {t('editor.review.blocked')}</p>
            <ul className="space-y-2">
              {problems.map((p) => (
                <li key={p.id} className="space-y-0.5">
                  <p>{p.message}</p>
                  <button type="button" className={linkCls} onClick={() => onEdit(p.step, p.id)}>{t('editor.review.fix')}</button>
                </li>
              ))}
            </ul>
          </div>
        )}
        {warnings.length > 0 && (
          <div role="status" className="space-y-2 rounded-lg bg-surface-2 p-4 text-sm">
            <p className="font-medium">{t('editor.review.warnings')}</p>
            <ul className="space-y-2">
              {warnings.map((w) => (
                <li key={w.key} className="space-y-0.5">
                  <p>{w.message}</p>
                  <button type="button" className={linkCls} onClick={w.go}>{w.action}</button>
                </li>
              ))}
            </ul>
          </div>
        )}
        {problems.length === 0 && <p className="text-sm text-fg-muted">{t('editor.review.ready')}</p>}

        <dl className="space-y-1.5 text-sm">
          <div className="flex justify-between gap-4 text-fg-muted">
            <dt>{t('invoices.number')}</dt>
            <dd className="tabular-nums">{invoice.number}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-4 text-lg font-semibold">
            <dt>{dueLabel}</dt>
            <dd className="tabular-nums">{f.money(due, invoice.currency)}</dd>
          </div>
          {invoice.kind !== 'advanceTaxDoc' && (
            <div className="flex justify-between gap-4 text-fg-muted">
              <dt>{t('invoices.due')}</dt>
              <dd className="tabular-nums">{f.date(invoice.dueDate)}</dd>
            </div>
          )}
        </dl>

        {invoice.number !== provisionalNumber && <p className="text-xs text-fg-muted">{t('editor.review.renumbered', { old: provisionalNumber, number: invoice.number })}</p>}

        <ul className="space-y-2 border-t border-line pt-4">
          <li><button type="button" className={linkCls} onClick={() => onEdit(1, 'invoice-customer')}>{t('editor.review.editCustomer')}</button></li>
          <li><button type="button" className={linkCls} onClick={() => onEdit(2)}>{t('editor.review.editLines')}</button></li>
          <li><button type="button" className={linkCls} onClick={() => onEdit(3)}>{t('editor.review.editPayment')}</button></li>
          <li><button type="button" className={linkCls} onClick={onEditSupplier}>{t('editor.review.editSupplier')}</button></li>
        </ul>
      </Card>
    </div>
  )
}
