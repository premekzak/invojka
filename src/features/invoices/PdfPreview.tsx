import { Download, FolderDown, Loader2, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import type { Invoice } from '@/domain/schema'
import { pdfPath, renderInvoicePdf } from '@/pdf'
import { useStore } from '@/state/store'
import { Button, Card } from '@/ui/primitives'

export async function savePdfToFolder(inv: Invoice): Promise<string> {
  const { adapter, settings } = useStore.getState()
  const blob = await renderInvoicePdf(inv, settings!)
  const path = pdfPath(inv)
  await adapter!.writeBinary(path, blob)
  return path
}

export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const a = Object.assign(document.createElement('a'), { href: url, download: name })
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

export function PdfPreview({ invoice, onClose }: { invoice: Invoice; onClose: () => void }) {
  const { t } = useTranslation()
  const settings = useStore((s) => s.settings!)
  const adapter = useStore((s) => s.adapter)
  const [blob, setBlob] = useState<Blob>()
  const [url, setUrl] = useState<string>()
  const [error, setError] = useState<string>()
  const [savedTo, setSavedTo] = useState<string>()

  useEffect(() => {
    let revoked = false
    let objectUrl: string | undefined
    renderInvoicePdf(invoice, settings)
      .then((b) => {
        if (revoked) return
        objectUrl = URL.createObjectURL(b)
        setBlob(b)
        setUrl(objectUrl)
      })
      .catch((e: Error) => setError(e.message))
    return () => {
      revoked = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [invoice, settings])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const fileName = pdfPath(invoice).split('/').pop()!

  // Portal: the page container animates with a transform, which would otherwise trap this fixed overlay inside it.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6 backdrop-blur-sm" onClick={onClose}>
      <Card className="animate-rise flex h-full w-full max-w-4xl flex-col overflow-hidden" >
        <div className="flex items-center gap-2 border-b border-line px-4 py-3" onClick={(e) => e.stopPropagation()}>
          <span className="font-medium">{fileName}</span>
          {savedTo && <span className="text-xs text-success">{t('pdf.savedTo', { path: `${adapter?.name}/${savedTo}` })}</span>}
          <div className="ml-auto flex gap-2">
            <Button size="sm" variant="secondary" disabled={!blob} onClick={async () => {
              try { setSavedTo(await savePdfToFolder(invoice)) } catch (e) { setError((e as Error).message) }
            }}>
              <FolderDown className="size-4" /> {t('pdf.saveToFolder')}
            </Button>
            <Button size="sm" variant="secondary" disabled={!blob} onClick={() => blob && downloadBlob(blob, fileName)}>
              <Download className="size-4" /> {t('pdf.download')}
            </Button>
            <Button size="sm" variant="ghost" onClick={onClose}><X className="size-4" /></Button>
          </div>
        </div>
        <div className="flex-1 bg-surface-2" onClick={(e) => e.stopPropagation()}>
          {error ? <p className="p-6 text-sm text-danger">{error}</p>
            : url ? <iframe title={fileName} src={url} className="h-full w-full" />
            : <div className="grid h-full place-items-center text-fg-muted"><Loader2 className="size-6 animate-spin" /></div>}
        </div>
      </Card>
    </div>,
    document.body,
  )
}
