import { ArrowLeft, Ban, Check, CloudDownload, FileDown, Loader2, Plus, RotateCcw, Send, Trash2, X } from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { today } from '@/domain/id'
import { displayStatus, invoiceTotals, isoPlusDays, newInvoice, snapshotOf } from '@/domain/invoice'
import { CURRENCIES, toMajor, toMinor } from '@/domain/money'
import type { Customer, Invoice, InvoiceLine } from '@/domain/schema'
import { chargesVat, lineBase, VAT_RATES } from '@/domain/vat'
import { useStore } from '@/state/store'
import { StatusBadge, useFormat } from '@/ui/format'
import { Button, Card, Input, cn } from '@/ui/primitives'
import { navigate, type Route } from '@/ui/router'
import { emptyCustomer } from '@/features/customers/CustomerDetail'
import { CustomerPicker } from './CustomerPicker'
import { rateDateOf } from '@/domain/fx'
import { fetchEcbRate } from '@/fx/ecb'
import { PdfPreview, savePdfToFolder } from './PdfPreview'

const selectCls = 'h-10 w-full rounded-lg border border-line bg-surface px-3 text-sm focus:border-accent focus:outline-none'

function L({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={cn('block space-y-1.5', className)}>
      <span className="text-xs font-medium text-fg-muted">{label}</span>
      {children}
    </label>
  )
}

/** Number input that lets the user type freely ("1 234,50") and commits the parsed value. */
function NumberInput({ value, onChange, className, ...p }: { value: number; onChange: (n: number) => void; className?: string; placeholder?: string }) {
  const [text, setText] = useState(String(value))
  useEffect(() => {
    setText((t) => (Number(t.replace(/\s/g, '').replace(',', '.')) === value ? t : String(value)))
  }, [value])
  return (
    <Input {...p} inputMode="decimal" className={cn('text-right tabular-nums', className)} value={text}
      onChange={(e) => {
        setText(e.target.value)
        const n = Number(e.target.value.replace(/\s/g, '').replace(',', '.'))
        if (Number.isFinite(n)) onChange(n)
      }}
      onBlur={() => setText(String(value))} />
  )
}

export function InvoiceEditor({ route }: { route: Route }) {
  const { t } = useTranslation()
  const id = route.path[1]
  const isNew = id === 'new'
  // Build the initial invoice once per route; later store updates (autosave) must not reset the form.
  const [initial] = useState<Invoice | undefined>(() => {
    const { settings, invoices, customers } = useStore.getState()
    if (!isNew) return invoices.find((i) => i.id === id)
    return newInvoice(settings!, invoices, customers.find((c) => c.id === route.query.get('customer')))
  })
  if (!initial) return <p className="text-fg-muted">{t('editor.notFound')}</p>
  return <Editor initial={initial} isNew={isNew} />
}

function Editor({ initial, isNew }: { initial: Invoice; isNew: boolean }) {
  const { t } = useTranslation()
  const f = useFormat()
  const { settings, invoices, customers, upsertInvoice, removeInvoice, upsertCustomer } = useStore()
  const [draft, setDraft] = useState(initial)
  const [saved, setSaved] = useState(isNew ? undefined : initial)
  const [preview, setPreview] = useState<Invoice>()
  const [pdfError, setPdfError] = useState<string>()
  const [rateBusy, setRateBusy] = useState(false)
  const [rateError, setRateError] = useState<string>()

  /** ECB rate for the invoice's date (DUZP or issue date). Only the currency and date leave the computer. */
  async function loadRate(inv: Invoice = draft): Promise<Partial<Invoice> | undefined> {
    setRateBusy(true)
    setRateError(undefined)
    try {
      const rate = await fetchEcbRate(inv.currency, rateDateOf(inv))
      if (!rate) { setRateError(t('rates.notFound')); return undefined }
      const patch = { exchangeRate: rate, exchangeRateSource: 'ecb' as const }
      set(patch)
      return patch
    } catch (e) {
      setRateError(`${t('rates.failed')}: ${(e as Error).message}`)
      return undefined
    } finally {
      setRateBusy(false)
    }
  }
  /** A fetched rate belongs to a date and currency; a manual one is the user's decision and stays. */
  const clearAutoRate = (d: Invoice): Partial<Invoice> =>
    d.exchangeRateSource === 'manual' ? {} : { exchangeRate: undefined, exchangeRateSource: undefined }
  const set = (patch: Partial<Invoice>) => setDraft((d) => ({ ...d, ...patch }))
  // Index of a just-added line whose description should take focus.
  const [focusLine, setFocusLine] = useState<number>()
  const addLine = () => {
    setFocusLine(draft.lines.length)
    const last = draft.lines.at(-1)
    set({ lines: [...draft.lines, { description: '', quantity: 1, unit: last?.unit ?? '', unitPrice: 0, vatRate: last?.vatRate ?? 0 }] })
  }
  const setLine = (i: number, patch: Partial<InvoiceLine>) =>
    setDraft((d) => ({ ...d, lines: d.lines.map((l, j) => (j === i ? { ...l, ...patch } : l)) }))

  const totals = useMemo(() => invoiceTotals(draft), [draft])
  const vatOn = chargesVat(draft.vatMode, draft.reverseCharge)
  const isPayer = draft.vatMode === 'payer'
  const status = displayStatus(draft)
  const dirty = !saved || JSON.stringify(draft) !== JSON.stringify(saved)
  const numberTaken = invoices.some((i) => i.number === draft.number && i.id !== draft.id)
  const canSave = !!draft.customerSnapshot.name && draft.lines.length > 0 && !numberTaken

  function pickCustomer(c: Customer) {
    // A brand-new invoice starts from this customer's last one; a saved one only switches the customer.
    if (!saved) {
      const fresh = newInvoice(settings!, invoices, c)
      setDraft((d) => ({ ...fresh, id: d.id, number: d.number, variableSymbol: d.variableSymbol, issueDate: d.issueDate, dueDate: d.dueDate }))
    } else {
      set({ customerId: c.id, customerSnapshot: snapshotOf(c) })
    }
  }

  /** The draft as it would be saved: blank lines dropped. */
  function cleaned(next: Partial<Invoice> = {}): Invoice {
    const lines = draft.lines.filter((l) => l.description.trim() || l.unitPrice)
    return { ...draft, ...next, lines: lines.length ? lines : draft.lines.slice(0, 1) }
  }

  function save(next: Partial<Invoice> = {}) {
    const inv = cleaned(next)
    upsertInvoice(inv)
    setDraft(inv)
    setSaved(inv)
    // Replace the "new" URL so Back doesn't create another invoice.
    if (!saved) history.replaceState(null, '', `#/invoices/${inv.id}`)
    return inv
  }

  /** Issuing also stores the PDF in the data folder, so every issued invoice has its document on disk. */
  async function issue() {
    // A foreign-currency invoice gets its rate when issued, so analytics can count it (best effort, offline is fine).
    const rate = draft.currency !== 'CZK' && !draft.exchangeRate ? await loadRate() : undefined
    const inv = save({ status: 'issued', ...rate })
    setPdfError(undefined)
    savePdfToFolder(inv).catch((e: Error) => setPdfError(e.message))
    setPreview(inv)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => history.back()}><ArrowLeft className="size-4" /></Button>
        <h1 className="font-serif text-4xl leading-[1.2] font-semibold">
          {!saved ? t('editor.newTitle') : t('editor.title', { number: draft.number })}
        </h1>
        {saved && <StatusBadge status={status} />}
        <div className="ml-auto flex gap-2">
          {draft.status === 'draft' && saved && (
            <Button variant="ghost" onClick={() => { removeInvoice(draft.id); navigate('/invoices') }}>
              <Trash2 className="size-4" /> {t('editor.delete')}
            </Button>
          )}
          {draft.status === 'issued' && (
            <Button variant="ghost" onClick={() => save({ status: 'cancelled' })}>
              <Ban className="size-4" /> {t('editor.cancel')}
            </Button>
          )}
          {draft.status === 'cancelled' && (
            <Button variant="ghost" onClick={() => save({ status: 'issued' })}>
              <RotateCcw className="size-4" /> {t('editor.restore')}
            </Button>
          )}
          <Button variant="secondary" disabled={!draft.customerSnapshot.name} onClick={() => setPreview(cleaned())}>
            <FileDown className="size-4" /> PDF
          </Button>
          {draft.status === 'issued' && (
            <Button variant="secondary" onClick={() => save({ status: 'paid', paidDate: today(), paidAmount: totals.total })}>
              <Check className="size-4" /> {t('invoices.markPaid')}
            </Button>
          )}
          {draft.status === 'paid' && (
            <Button variant="ghost" onClick={() => save({ status: 'issued', paidDate: undefined, paidAmount: undefined })}>
              <X className="size-4" /> {t('editor.markUnpaid')}
            </Button>
          )}
          {draft.status === 'draft' ? (
            <>
              <Button variant="secondary" disabled={!canSave || !dirty} onClick={() => save()}>{t('editor.saveDraft')}</Button>
              <Button disabled={!canSave} onClick={() => void issue()}><Send className="size-4" /> {t('editor.issue')}</Button>
            </>
          ) : (
            <Button disabled={!canSave || !dirty} onClick={() => save()}>{t('common.save')}</Button>
          )}
        </div>
      </div>
      {pdfError && <p className="rounded-lg bg-danger/10 p-3 text-sm text-danger">{t('pdf.saveFailed')}: {pdfError}</p>}
      {preview && <PdfPreview invoice={preview} onClose={() => setPreview(undefined)} />}

      <div className="grid grid-cols-3 gap-6">
        <Card className="col-span-2 space-y-5 p-6">
          <L label={t('invoices.customer')}>
            <CustomerPicker customers={customers} value={draft.customerId} onChange={pickCustomer}
              onCreate={(name) => { const c = emptyCustomer(name); upsertCustomer(c); pickCustomer(c) }}
              autoFocus={!saved && !draft.customerId} />
          </L>
          {draft.customerSnapshot.name && (
            <p className="-mt-2 text-xs text-fg-muted">
              {[draft.customerSnapshot.address.street, draft.customerSnapshot.address.zip, draft.customerSnapshot.address.city, draft.customerSnapshot.address.country].filter(Boolean).join(', ')}
              {draft.customerSnapshot.ic && ` · ${t('fields.ic')} ${draft.customerSnapshot.ic}`}
              {draft.customerSnapshot.dic && ` · ${t('fields.dic')} ${draft.customerSnapshot.dic}`}
              {draft.customerId && (
                <a href={`#/customers/${draft.customerId}`} className="ml-2 text-accent hover:underline" onClick={(e) => {
                  // Keep the work: store the invoice (as a draft if new) before leaving; drafts pick up the edited customer details.
                  e.preventDefault()
                  if (dirty && canSave) save()
                  navigate(`/customers/${draft.customerId}`)
                }}>{t('customers.edit')}</a>
              )}
            </p>
          )}

          <div>
            <div className="mb-2 grid grid-cols-12 gap-2 text-xs font-medium text-fg-muted">
              <span className={vatOn ? 'col-span-5' : 'col-span-6'}>{t('editor.description')}</span>
              <span className="col-span-1 text-right">{t('editor.qty')}</span>
              <span className="col-span-1">{t('editor.unit')}</span>
              <span className="col-span-2 text-right">{t('editor.unitPrice')}</span>
              {vatOn && <span className="col-span-1">{t('editor.vat')}</span>}
              <span className="col-span-2 text-right">{t('invoices.total')}</span>
            </div>
            <div className="space-y-2">
              {draft.lines.map((l, i) => (
                <div key={i} className="group relative grid grid-cols-12 items-center gap-2">
                  <Input className={vatOn ? 'col-span-5' : 'col-span-6'} value={l.description} placeholder={t('editor.descriptionPlaceholder')}
                    autoFocus={focusLine === i}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addLine() } }}
                    onChange={(e) => setLine(i, { description: e.target.value })} />
                  <NumberInput className="col-span-1 px-2" value={l.quantity} onChange={(n) => setLine(i, { quantity: n })} />
                  <Input className="col-span-1 px-2" value={l.unit} placeholder="ks" onChange={(e) => setLine(i, { unit: e.target.value })} />
                  <NumberInput className="col-span-2" value={toMajor(l.unitPrice)} onChange={(n) => setLine(i, { unitPrice: toMinor(n) })} />
                  {vatOn && (
                    <select className={cn(selectCls, 'col-span-1 px-1')} value={l.vatRate} onChange={(e) => setLine(i, { vatRate: Number(e.target.value) })}>
                      {VAT_RATES.map((r) => <option key={r} value={r}>{r} %</option>)}
                    </select>
                  )}
                  <span className="col-span-2 pr-1 text-right text-sm font-medium tabular-nums">{f.money(lineBase(l), draft.currency)}</span>
                  {draft.lines.length > 1 && (
                    <button onClick={() => set({ lines: draft.lines.filter((_, j) => j !== i) })}
                      className="absolute -right-8 rounded p-1 text-fg-subtle opacity-0 transition-opacity group-hover:opacity-100 hover:text-danger">
                      <X className="size-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <Button variant="ghost" size="sm" className="mt-2"
              onClick={addLine}>
              <Plus className="size-4" /> {t('editor.addLine')}
            </Button>
          </div>

          <div className="flex justify-end border-t border-line pt-4">
            <dl className="w-72 space-y-1.5 text-sm">
              {vatOn && totals.byRate.map((r) => (
                <div key={r.rate} className="flex justify-between text-fg-muted">
                  <dt>{t('editor.baseAt', { rate: r.rate })}</dt>
                  <dd className="tabular-nums">{f.money(r.base, draft.currency)} + {f.money(r.vat, draft.currency)}</dd>
                </div>
              ))}
              <div className="flex justify-between pt-1 text-lg font-semibold">
                <dt>{t('editor.toPay')}</dt>
                <dd className="tabular-nums">{f.money(totals.total, draft.currency)}</dd>
              </div>
              {draft.reverseCharge && <p className="text-xs text-fg-muted">{t('editor.reverseChargeNote')}</p>}
            </dl>
          </div>

          <L label={t('editor.note')}>
            <textarea className="min-h-20 w-full rounded-lg border border-line bg-surface p-3 text-sm focus:border-accent focus:outline-none"
              value={draft.note} onChange={(e) => set({ note: e.target.value })} />
          </L>
        </Card>

        <Card className="h-fit space-y-4 p-6">
          <L label={t('invoices.number')}>
            <Input value={draft.number} className={cn('tabular-nums', numberTaken && 'border-danger')}
              onChange={(e) => set({ number: e.target.value, variableSymbol: e.target.value.replace(/\D/g, '') })} />
            {numberTaken && <span className="text-xs text-danger">{t('editor.numberTaken')}</span>}
          </L>
          <L label={t('editor.vs')}>
            <Input value={draft.variableSymbol} className="tabular-nums" onChange={(e) => set({ variableSymbol: e.target.value })} />
          </L>
          <div className="grid grid-cols-2 gap-3">
            <L label={t('invoices.issued')}>
              <Input type="date" value={draft.issueDate} onChange={(e) => {
                const days = Math.round((Date.parse(draft.dueDate) - Date.parse(draft.issueDate)) / 864e5)
                set({ issueDate: e.target.value, dueDate: isoPlusDays(e.target.value, days), ...(isPayer ? { taxableSupplyDate: e.target.value } : {}), ...clearAutoRate(draft) })
              }} />
            </L>
            <L label={t('invoices.due')}>
              <Input type="date" value={draft.dueDate} onChange={(e) => set({ dueDate: e.target.value })} />
            </L>
          </div>
          <div className="flex gap-1.5">
            {[7, 14, 30].map((d) => (
              <button key={d} onClick={() => set({ dueDate: isoPlusDays(draft.issueDate, d) })}
                className={cn('rounded border px-2.5 py-0.5 text-xs transition-colors',
                  isoPlusDays(draft.issueDate, d) === draft.dueDate ? 'border-accent bg-accent/10 text-accent' : 'border-line text-fg-muted hover:border-fg-subtle')}>
                {t('editor.days', { count: d })}
              </button>
            ))}
          </div>
          {isPayer && (
            <L label={t('editor.taxableSupplyDate')}>
              <Input type="date" value={draft.taxableSupplyDate ?? ''} onChange={(e) => set({ taxableSupplyDate: e.target.value || undefined, ...clearAutoRate(draft) })} />
            </L>
          )}
          <div className="grid grid-cols-2 gap-3">
            <L label={t('editor.currency')}>
              <select className={selectCls} value={draft.currency} onChange={(e) => set({ currency: e.target.value, exchangeRate: undefined, exchangeRateSource: undefined })}>
                {[...new Set([...CURRENCIES, draft.currency])].map((c) => <option key={c}>{c}</option>)}
              </select>
            </L>
            <L label={t('editor.language')}>
              <select className={selectCls} value={draft.language} onChange={(e) => set({ language: e.target.value as 'cs' | 'en' })}>
                <option value="cs">Čeština</option>
                <option value="en">English</option>
              </select>
            </L>
          </div>
          {draft.currency !== 'CZK' && (
            <div className="space-y-1.5">
              <span className="text-xs font-medium text-fg-muted">{t('editor.exchangeRate', { currency: draft.currency })}</span>
              <div className="flex gap-2">
                <NumberInput className="flex-1" value={draft.exchangeRate ?? 0}
                  onChange={(n) => set({ exchangeRate: n > 0 ? n : undefined, exchangeRateSource: n > 0 ? 'manual' : undefined })} />
                <Button variant="secondary" disabled={rateBusy} title={t('rates.ecbOne')} onClick={() => void loadRate()}>
                  {rateBusy ? <Loader2 className="size-4 animate-spin" /> : <CloudDownload className="size-4" />} ECB
                </Button>
              </div>
              <p className="text-xs text-fg-subtle">
                {rateError ? <span className="text-danger">{rateError}</span>
                  : draft.exchangeRate ? <>{t(`rates.source.${draft.exchangeRateSource ?? 'manual'}`)} · ≈ {f.money(Math.round(totals.total * draft.exchangeRate))}</>
                  : t('rates.noneYet')}
              </p>
            </div>
          )}
          {isPayer && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="size-4 accent-accent" checked={draft.reverseCharge} onChange={(e) => set({ reverseCharge: e.target.checked })} />
              {t('editor.reverseCharge')}
            </label>
          )}
          {draft.status === 'paid' && (
            <L label={t('editor.paidDate')}>
              <Input type="date" value={draft.paidDate ?? ''} onChange={(e) => set({ paidDate: e.target.value || undefined })} />
            </L>
          )}
        </Card>
      </div>
    </div>
  )
}
