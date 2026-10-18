import { Copy, Download, Mail, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { composeEmail, mailtoLink, type EmailKind } from '@/domain/email'
import { today } from '@/domain/id'
import type { Invoice } from '@/domain/schema'
import { pdfPath, renderPdf } from '@/pdf'
import { useStore } from '@/state/store'
import { Button, Card, Field, Labeled, Textarea } from '@/ui/primitives'
import { downloadBlob } from './PdfPreview'

const split = (s: string) => s.split(/[,;]\s*/).map((x) => x.trim()).filter(Boolean)

/**
 * A pre-filled e-mail for an invoice or a reminder, opened in the user's own mail program (`mailto:`). Invojka sends
 * nothing itself and can't attach files that way, so the PDF is one click away to attach by hand (docs/email.md).
 */
export function EmailDialog({ invoice, kind, onSent, onClose }: { invoice: Invoice; kind: EmailKind; onSent: () => void; onClose: () => void }) {
  const { t } = useTranslation()
  const { settings, customers, adapter } = useStore()
  const customer = customers.find((c) => c.id === invoice.customerId)
  const [draft] = useState(() => composeEmail(invoice, settings!, kind, today()))
  const [to, setTo] = useState(customer?.email ?? '')
  const [cc, setCc] = useState(customer?.cc.join(', ') ?? '')
  const [subject, setSubject] = useState(draft.subject)
  const [body, setBody] = useState(draft.body)
  const [note, setNote] = useState<string>()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const fileName = pdfPath(invoice).split('/').pop()!

  function open() {
    window.location.href = mailtoLink(split(to), split(cc), subject, body)
    onSent()
    setNote(t(kind === 'reminder' ? 'email.remindedNote' : 'email.sentNote'))
  }

  async function download() {
    downloadBlob(await renderPdf(invoice, settings!), fileName)
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(`${subject}\n\n${body}`)
      setNote(t('email.copied'))
    } catch {
      setNote(t('email.copyFailed'))
    }
  }

  // Portal: the animated page container would otherwise trap this fixed overlay.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-scrim/50 p-6 backdrop-blur-sm" onClick={onClose}>
      <Card className="animate-rise flex max-h-full w-full max-w-2xl flex-col overflow-hidden">
        <div className="flex items-center gap-2 border-b border-line px-5 py-3" onClick={(e) => e.stopPropagation()}>
          <Mail aria-hidden="true" className="size-4 text-fg-muted" />
          <h2 className="font-medium">{t(kind === 'reminder' ? 'email.reminderTitle' : 'email.invoiceTitle', { number: invoice.number })}</h2>
          <Button size="sm" variant="ghost" className="ml-auto" aria-label={t('common.close')} onClick={onClose}><X className="size-4" /></Button>
        </div>
        <div className="flex-1 space-y-4 overflow-auto p-5" onClick={(e) => e.stopPropagation()}>
          <div className="grid grid-cols-2 gap-4">
            <Field label={t('email.to')} hint={!to ? t('email.noAddress') : undefined} value={to} onChange={(e) => setTo(e.target.value)} />
            <Field label={t('email.cc')} value={cc} onChange={(e) => setCc(e.target.value)} />
          </div>
          <Field label={t('email.subject')} value={subject} onChange={(e) => setSubject(e.target.value)} />
          <Labeled label={t('email.body')} hint={<>{t('email.bodyHint')} <a href="#/settings?tab=emails" onClick={onClose} className="text-link underline underline-offset-2 decoration-line-strong hover:decoration-current">{t('email.editTemplates')}</a></>}>
            <Textarea rows={11} value={body} onChange={(e) => setBody(e.target.value)} />
          </Labeled>
          <p className="max-w-prose text-xs text-fg-muted">{t('email.attach', { file: fileName, folder: adapter?.name ?? '' })}</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line px-5 py-3" onClick={(e) => e.stopPropagation()}>
          {note && <p role="status" className="mr-auto text-xs font-medium text-success">{note}</p>}
          <Button variant="ghost" onClick={() => void copy()}><Copy className="size-4" /> {t('email.copy')}</Button>
          <Button variant="secondary" onClick={() => void download()}><Download className="size-4" /> {t('email.downloadPdf')}</Button>
          <Button onClick={open}><Mail className="size-4" /> {t('email.open')}</Button>
        </div>
      </Card>
    </div>,
    document.body,
  )
}
