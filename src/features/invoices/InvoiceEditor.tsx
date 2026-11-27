import { ArrowLeft, ArrowRight, Ban, BellRing, Check, Copy, Percent, Truck, CircleSlash, CloudDownload, FileDown, FileMinus2, Loader2, Lock, Mail, Plus, ReceiptText, RefreshCw, RotateCcw, Send, Trash2, X } from 'lucide-react'
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type InputHTMLAttributes } from 'react'
import { useTranslation } from 'react-i18next'
import { today } from '@/domain/id'
import { advanceTaxDocDeadline, advanceTaxDocOf, amountDue, creditNotesOf, customerSummaries, discountLines, duplicateInvoice, invoiceHistory, displayStatus, finalInvoiceOf, invoiceTotals, issuedStatus, isoPlusDays, latestFor, newAdvanceTaxDoc, newCreditNote, newFinalInvoice, newInvoice, recentCustomerIds, snapshotDiffers, snapshotOf, withIssueNumber, withKind } from '@/domain/invoice'
import { tampered } from '@/domain/lock'
import { INVOICE_LANGS, LANG_NAMES, type InvoiceLang } from '@/domain/language'
import { CURRENCIES, mulRound, toMajor, toMinor } from '@/domain/money'
import { CASH_LIMIT, hasReceipt, overCashLimit, paysByBank } from '@/domain/payment'
import { PaymentMethod, type Customer, type Invoice, type InvoiceKind, type InvoiceLine } from '@/domain/schema'
import { chargesVat, lineBase, VAT_RATES } from '@/domain/vat'
import { useStore } from '@/state/store'
import { StatusBadge, useFormat } from '@/ui/format'
import { BackButton } from '@/ui/BackButton'
import { markChanged } from '@/ui/highlight'
import { MoreMenu, type MoreItem } from '@/ui/MoreMenu'
import { Button, Card, Checkbox, ErrorSummary, Input, InputAffix, Labeled, Select, Textarea, cn } from '@/ui/primitives'
import { navigate, type Route } from '@/ui/router'
import { emptyCustomer } from '@/features/customers/CustomerDetail'
import { CustomerPicker } from './CustomerPicker'
import { rateDateOf } from '@/domain/fx'
import { fetchEcbRate } from '@/fx/ecb'
import { PdfPreview, savePdfToFolder } from './PdfPreview'
import { EmailDialog } from './EmailDialog'
import type { EmailKind } from '@/domain/email'
import { missingSupplierDetails } from '@/domain/supplier'
import { dayOff, nextWorkday } from '@/domain/workdays'
import { Steps } from '@/ui/Steps'
import { InvoiceReview } from './InvoiceReview'

/** The step of a draft on which each validated field sits. */
const STEP_OF: Record<string, number> = { 'invoice-customer': 1, 'invoice-reason': 1, 'invoice-number': 3 }

/**
 * The step a draft was last on. The first save of a new invoice changes its URL from "new" to its id, and the page is
 * keyed by the URL, so the editor mounts again; without this it would jump to the review in the middle of the work.
 */
let lastStep: { id: string; step: number } | undefined

/** Number input that lets the user type freely ("1 234,50") and commits the parsed value. */
function NumberInput({ value, onChange, className, ...p }: Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & { value: number | undefined; onChange: (n: number) => void }) {
  // `undefined` shows an empty field (e.g. a missing exchange rate), not a misleading 0.
  const show = (v: number | undefined) => (v === undefined ? '' : String(v))
  const [text, setText] = useState(show(value))
  useEffect(() => {
    // Keep what is typed while it still means the same value; an empty field means 0 or nothing.
    setText((t) => ((t.trim() ? Number(t.replace(/\s/g, '').replace(',', '.')) === value : !value) ? t : show(value)))
  }, [value])
  return (
    <Input {...p} inputMode="decimal" className={cn('text-right tabular-nums', className)} value={text}
      onChange={(e) => {
        setText(e.target.value)
        const n = Number(e.target.value.replace(/\s/g, '').replace(',', '.'))
        if (Number.isFinite(n)) onChange(n)
      }}
      onBlur={() => setText(show(value))} />
  )
}

/**
 * A line's description: one row tall like the other fields, growing as the text wraps, so a long description is all visible
 * (the owner, 2026-11-20). Enter adds the next line instead of a line break. A textarea has no datalist, so the price list
 * is offered in a small list under it: items containing what is typed, ↑ ↓ and Enter or a click to take one.
 */
function LineDescription({ value, onChange, onEnter, suggestions, onPick, className, placeholder, autoFocus }: {
  value: string; onChange: (text: string) => void; onEnter: () => void
  suggestions: string[]; onPick: (description: string) => void
  className?: string; placeholder?: string; autoFocus?: boolean
}) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const [focused, setFocused] = useState(false)
  const [active, setActive] = useState(-1)
  // `field-sizing: content` does the growing (Chrome and Edge 123+); elsewhere set the height from the content.
  useLayoutEffect(() => {
    const el = ref.current
    if (!el || CSS.supports('field-sizing', 'content')) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight + 2}px`
  }, [value])
  // A textarea that takes focus puts the caret at the start; continue after a prefilled description instead.
  useEffect(() => {
    if (autoFocus) ref.current?.setSelectionRange(ref.current.value.length, ref.current.value.length)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const q = value.trim().toLocaleLowerCase()
  const matches = focused ? suggestions.filter((s) => s !== value && s.toLocaleLowerCase().includes(q)).slice(0, 8) : []
  useEffect(() => setActive(-1), [value])
  return (
    <div className={cn('relative', className)}>
      <textarea ref={ref} rows={1} value={value} placeholder={placeholder} autoFocus={autoFocus}
        className="control block min-h-9 w-full resize-none overflow-hidden px-3 py-[7px] text-sm leading-5 [field-sizing:content] placeholder:text-fg-subtle"
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        onChange={(e) => onChange(e.target.value.replace(/\s*\n\s*/g, ' '))}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' && matches.length) { e.preventDefault(); setActive((a) => Math.min(a + 1, matches.length - 1)) }
          else if (e.key === 'ArrowUp' && active >= 0) { e.preventDefault(); setActive((a) => a - 1) }
          else if (e.key === 'Enter') { e.preventDefault(); if (matches[active]) onPick(matches[active]); else onEnter() }
          else if (e.key === 'Escape') setFocused(false)
        }} />
      {matches.length > 0 && (
        <div className="animate-rise absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-xl border border-line bg-surface p-1">
          {matches.map((m, i) => (
            // mousedown, not click: the textarea's blur would close the list first.
            <button key={m} type="button" onMouseEnter={() => setActive(i)} onMouseDown={(e) => { e.preventDefault(); onPick(m) }}
              className={cn('block w-full rounded-xs px-3 py-2 text-left text-sm leading-label', i === active && 'bg-surface-2')}>
              {m}
            </button>
          ))}
        </div>
      )}
    </div>
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
    // "?corrects=<id>" starts a credit note for that invoice.
    const original = invoices.find((i) => i.id === route.query.get('corrects'))
    if (original) return newCreditNote(settings!, invoices, original)
    // "?settles=<id>" starts the final invoice for a paid proforma.
    const proforma = invoices.find((i) => i.id === route.query.get('settles') && i.kind === 'proforma')
    if (proforma) return newFinalInvoice(settings!, invoices, proforma)
    // "?advanceFor=<id>" starts a VAT payer's tax document for the advance received on that proforma.
    const advanced = invoices.find((i) => i.id === route.query.get('advanceFor') && i.kind === 'proforma')
    if (advanced) return newAdvanceTaxDoc(settings!, invoices, advanced)
    // "?copy=<id>" duplicates that invoice as a new draft.
    const copied = invoices.find((i) => i.id === route.query.get('copy'))
    if (copied) return duplicateInvoice(settings!, invoices, copied)
    return newInvoice(settings!, invoices, customers.find((c) => c.id === route.query.get('customer')))
  })
  // The number of the document a new invoice's lines came from (a copy, or the customer's latest), to say so on the lines step.
  const [prefilledFrom] = useState(() => {
    if (!isNew) return undefined
    const { invoices } = useStore.getState()
    const copied = invoices.find((i) => i.id === route.query.get('copy'))
    if (copied) return copied.number
    const customerId = route.query.get('customer')
    return customerId ? latestFor(invoices, customerId)?.number : undefined
  })
  if (!initial) return <p className="text-fg-muted">{t('editor.notFound')}</p>
  return <Editor initial={initial} isNew={isNew} prefilledFrom={prefilledFrom} />
}

function Editor({ initial, isNew, prefilledFrom }: { initial: Invoice; isNew: boolean; prefilledFrom?: string }) {
  const { t } = useTranslation()
  const f = useFormat()
  const { settings, invoices, customers, upsertInvoice, upsertInvoices, removeInvoice, upsertCustomer } = useStore()
  const [draft, setDraft] = useState(initial)
  const [prefilled, setPrefilled] = useState(prefilledFrom)
  const [saved, setSaved] = useState(isNew ? undefined : initial)
  const [preview, setPreview] = useState<Invoice>()
  const [receipt, setReceipt] = useState<Invoice>()
  const [email, setEmail] = useState<EmailKind>()
  const [deliveryNote, setDeliveryNote] = useState<Invoice>()
  // "Sleva": a percentage typed next to "Přidat položku", turned into one negative line per VAT rate.
  const [discount, setDiscount] = useState<number>()
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
  const credit = draft.kind === 'creditNote'
  const proforma = draft.kind === 'proforma'
  const due = amountDue(draft)
  // A paid proforma leads on to its final invoice; the final invoice links back.
  const settledBy = proforma ? finalInvoiceOf(invoices, draft.id) : undefined
  const advanceOf = draft.advanceId ? invoices.find((i) => i.id === draft.advanceId) : undefined
  // VAT payers: a paid proforma first needs its tax document (within 15 days), then the final invoice.
  const taxDoc = draft.kind === 'advanceTaxDoc'
  const proformaTaxDoc = proforma ? advanceTaxDocOf(invoices, draft.id) : undefined
  const taxDocDeadline = proforma ? advanceTaxDocDeadline(draft) : taxDoc && advanceOf ? advanceTaxDocDeadline(advanceOf) : undefined
  const startAdvanceTaxDoc = () => navigate(`/invoices/new?advanceFor=${draft.id}`)
  /** Starts the final invoice for this paid proforma. */
  const startFinalInvoice = () => navigate(`/invoices/new?settles=${draft.id}`)
  // Issued, paid and cancelled documents are locked (the owner, 2026-10-18); unlocking is per visit, with a warning.
  const [unlocked, setUnlocked] = useState(false)
  const locked = draft.status !== 'draft' && !unlocked
  const corrections = useMemo(() => creditNotesOf(invoices, draft.id), [invoices, draft.id])
  const events = useMemo(() => (saved ? invoiceHistory(draft, invoices) : []), [saved, draft, invoices])
  const allTags = useMemo(() => [...new Set(invoices.flatMap((i) => i.tags))].sort(), [invoices])
  const recentCustomers = useMemo(() => recentCustomerIds(invoices), [invoices])
  const summaries = useMemo(() => customerSummaries(invoices), [invoices])
  const priceNames = useMemo(() => [...new Set(settings!.priceList.map((p) => p.description))], [settings])
  const corrected = credit ? invoices.find((i) => i.id === draft.correctsId) : undefined
  const dirty = !saved || JSON.stringify(draft) !== JSON.stringify(saved)
  // Step one of a brand-new invoice is only "who is it for": the lines, totals and notes come once a customer is picked
  // (the owner, 2026-11-20). The side card stays. Picking fills the invoice from that customer's last one anyway.
  const pickingCustomer = !saved && !draft.customerSnapshot.name
  const numberTaken = invoices.some((i) => i.number === draft.number && i.id !== draft.id)
  const canSave = !!draft.customerSnapshot.name && draft.lines.length > 0 && !numberTaken
  // Saving with mistakes shows them all (and a summary when there is more than one) instead of a disabled button.
  const [showErrors, setShowErrors] = useState(false)
  const errors = [
    !draft.customerSnapshot.name && { id: 'invoice-customer', message: t('validation.customer') },
    numberTaken && { id: 'invoice-number', message: t('editor.numberTaken') },
    credit && !draft.correctionReason.trim() && { id: 'invoice-reason', message: t('validation.reason') },
  ].filter((e): e is { id: string; message: string } => !!e)
  // A taken number shows at once; a missing customer only after a save attempt.
  const errorFor = (id: string) => (showErrors || id === 'invoice-number' ? errors.find((e) => e.id === id)?.message : undefined)
  /** Runs the action when the invoice is valid; otherwise shows the errors and focuses the first one. */
  const guarded = (action: () => void) => () => {
    if (errors.length) {
      setShowErrors(true)
      if (stepped) goTo(problems[0].step, problems[0].id)
      else document.getElementById(errors[0].id)?.focus()
      return
    }
    action()
  }
  // A draft is written in steps (the owner, 2026-11-27): who it is for, what is invoiced, how and when it is paid, then a
  // review of the whole document with "Vystavit". Issued documents keep everything on one screen. A new draft that already
  // has its customer (a copy, a final invoice) opens on the lines, a saved draft on the review.
  const stepped = draft.status === 'draft'
  const [step, setStepState] = useState(() => (lastStep?.id === initial.id ? lastStep.step
    : !initial.customerSnapshot.name || (isNew && initial.kind === 'creditNote') ? 1 : isNew ? 2 : 4))
  const setStep = (n: number) => { lastStep = { id: draft.id, step: n }; setStepState(n) }
  const show = (n: number) => !stepped || step === n
  const problems = errors.map((e) => ({ ...e, step: STEP_OF[e.id] ?? 1 }))
  const focusAfterStep = useRef<string | undefined>(undefined)
  useEffect(() => {
    if (focusAfterStep.current) document.getElementById(focusAfterStep.current)?.focus()
    focusAfterStep.current = undefined
  }, [step])
  /** Opens a step. A mistake on an earlier step (no customer yet) is shown there instead of moving on. */
  function goTo(n: number, focusId?: string) {
    const blocking = problems.find((e) => e.step < n)
    if (blocking) {
      setShowErrors(true)
      focusId = blocking.id
      n = blocking.step
    }
    if (n === step) {
      if (focusId) document.getElementById(focusId)?.focus()
      return
    }
    // Moving between steps keeps the work: the draft is stored as soon as it can be (a customer and a free number), so
    // going back in the browser or closing the tab loses nothing (the owner agreed, 2026-11-27).
    if (dirty && canSave) save()
    focusAfterStep.current = focusId
    setStep(n)
    window.scrollTo({ top: 0 })
  }

  /** Starts a credit note for this invoice, keeping unsaved work first. */
  function startCreditNote() {
    if (dirty && canSave) save()
    navigate(`/invoices/new?corrects=${draft.id}`)
  }

  function pickCustomer(c: Customer) {
    // A brand-new invoice starts from this customer's last one; a saved one only switches the customer.
    if (!saved) {
      const fresh = newInvoice(settings!, invoices, c)
      // The kind of document is chosen above the customer, so it survives the pick (with its own number series).
      setDraft((d) => {
        const base = { ...fresh, id: d.id, issueDate: d.issueDate, dueDate: d.dueDate }
        return d.kind === fresh.kind ? { ...base, number: d.number, variableSymbol: d.variableSymbol } : withKind(base, d.kind, settings!, invoices)
      })
      setPrefilled(latestFor(invoices, c.id)?.number)
      // Continue with the lines, in the first description.
      if (pickingCustomer) setFocusLine(0)
      if (step === 1) setStep(2)
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
    // The store refuses a locked change unless the document was unlocked here (domain/lock.ts).
    const inv = upsertInvoice(cleaned(next), { unlocked })
    setDraft(inv)
    setSaved(inv)
    // Replace the "new" URL so Back doesn't create another invoice.
    if (!saved) history.replaceState(null, '', `#/invoices/${inv.id}`)
    return inv
  }

  /** Saving an issued, paid or cancelled invoice rewrites its PDF in the folder, so the file matches what is shown. */
  function saveChanges() {
    const inv = save()
    if (inv.status === 'draft') return
    setPdfError(undefined)
    savePdfToFolder(inv).catch((e: Error) => setPdfError(e.message))
  }

  /** Takes a change made to `invoices.json` outside Invojka as the document's content, and rewrites its PDF to match. */
  function acceptOutsideChange() {
    const inv = upsertInvoice(cleaned(), { unlocked: true })
    setDraft(inv)
    setSaved(inv)
    setPdfError(undefined)
    savePdfToFolder(inv).catch((e: Error) => setPdfError(e.message))
  }

  // Issued invoices keep the customer details they were printed with. When the customer was edited since,
  // the owner can take the new details on purpose (then save and send the new PDF).
  const currentCustomer = customers.find((c) => c.id === draft.customerId)
  const customerChanged = draft.status !== 'draft' && !!currentCustomer && snapshotDiffers(draft.customerSnapshot, currentCustomer)

  /** Issuing opens the invoice's PDF screen, which stores the PDF in the data folder and says where it went. */
  async function issue() {
    // A foreign-currency invoice gets its rate when issued, so analytics can count it (best effort, offline is fine).
    const rate = draft.currency !== 'CZK' && !draft.exchangeRate ? await loadRate() : undefined
    // A final invoice fully covered by its advance is paid the moment it's issued.
    // The number is given now, after the issued documents of the series; a draft's own number was provisional.
    const { invoice: numbered, moved } = withIssueNumber(settings!, invoices, cleaned())
    const inv = save({ ...issuedStatus(draft, invoices), ...rate, number: numbered.number, variableSymbol: numbered.variableSymbol })
    if (moved.length) upsertInvoices(moved)
    markChanged([inv.id])
    navigate(`/invoices/${inv.id}/pdf?issued=1`)
  }

  /** A saved, issued document shows its PDF screen; a draft or unsaved changes open the preview of what's on screen. */
  const showPdf = () => (saved && !dirty && draft.status !== 'draft' ? navigate(`/invoices/${draft.id}/pdf`) : setPreview(cleaned()))


  // The fields of "Platba a termíny" as pieces, so the step can lay them out in sections with room to breathe and an
  // issued document can keep them in its narrow side column.
  const chipCls = cn('border transition-colors', stepped ? 'h-9 rounded-lg px-4 text-sm' : 'rounded px-2.5 py-0.5 text-xs')
  const kindField = draft.status === 'draft' && !credit && !draft.advanceId && (
            <div role="radiogroup" aria-labelledby="invoice-kind" className="space-y-1.5">
              <span id="invoice-kind" className="block text-sm text-fg-muted">{t('editor.kind')}</span>
              <div className="flex gap-1.5">
                {(['invoice', 'proforma'] as InvoiceKind[]).map((k) => (
                  <button key={k} type="button" role="radio" aria-checked={draft.kind === k}
                    onClick={() => draft.kind !== k && setDraft(withKind(draft, k, settings!, invoices))}
                    className={cn(chipCls,
                      draft.kind === k ? 'border-link bg-surface-2 text-link' : 'border-line text-fg-muted hover:border-line-strong')}>
                    {t(`editor.kinds.${k}`)}
                  </button>
                ))}
              </div>
              {proforma && <p className="max-w-hint text-xs text-fg-muted">{t('editor.proformaHint')}</p>}
            </div>
  )
  const numberField = (
          <Labeled label={t('invoices.number')} error={errorFor('invoice-number')}
      hint={stepped ? t(draft.numberManual ? 'editor.numberManualHint' : 'editor.numberProvisionalHint') : undefined}>
            <Input id="invoice-number" value={draft.number} className="tabular-nums"
              onChange={(e) => set({ number: e.target.value, variableSymbol: e.target.value.replace(/\D/g, ''), numberManual: draft.status === 'draft' ? true : draft.numberManual })} />
          </Labeled>
  )
  const vsField = draft.paymentMethod !== 'cash' && (
            <Labeled label={t('editor.vs')}>
              <Input value={draft.variableSymbol} className="tabular-nums" onChange={(e) => set({ variableSymbol: e.target.value })} />
            </Labeled>
  )
  const issueField = (
            <Labeled label={t('invoices.issued')}>
              <Input type="date" value={draft.issueDate} onChange={(e) => {
                const days = Math.round((Date.parse(draft.dueDate) - Date.parse(draft.issueDate)) / 864e5)
                const ownSupply = isPayer && !proforma && !taxDoc
                set({ issueDate: e.target.value, dueDate: isoPlusDays(e.target.value, days), ...(ownSupply ? { taxableSupplyDate: e.target.value } : {}), ...clearAutoRate(draft) })
              }} />
            </Labeled>
  )
  // A tax document for a received payment has no due date or payment method: the money is already in.
  const dueField = !taxDoc && (
              <Labeled label={t('invoices.due')}>
                <Input type="date" value={draft.dueDate} onChange={(e) => set({ dueDate: e.target.value })} />
              </Labeled>
  )
  // A due date on a weekend or a public holiday is said plainly, with one click to the next working day. No more than
  // that: whether the law moves such a date depends on how the due date was agreed (docs/czech-rules.md).
  const dueOff = taxDoc ? undefined : dayOff(draft.dueDate)
  const dueOffHint = dueOff && (
    <p className="max-w-hint text-xs text-fg-muted">
      {t(`editor.dueOff.${dueOff}`)}{' '}
      <button type="button" className="font-medium text-link underline underline-offset-2 decoration-line-strong hover:decoration-current" onClick={() => set({ dueDate: nextWorkday(draft.dueDate) })}>
        {t('editor.dueOff.move', { date: f.date(nextWorkday(draft.dueDate)) })}
      </button>
    </p>
  )
  const editSupplier = () => { if (dirty && canSave) save(); navigate('/settings') }
  const supplierMissing = missingSupplierDetails(settings!).map((k) => t(`editor.review.missing.${k}`))
  // The review renders the PDF again whenever this object changes, so it must change only with the draft.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const reviewInvoice = useMemo(() => withIssueNumber(settings!, invoices, cleaned()).invoice, [draft, invoices, settings])
  const dueChips = !taxDoc && (
          <div className="flex gap-1.5">
            {[7, 14, 30].map((d) => (
              <button key={d} onClick={() => set({ dueDate: isoPlusDays(draft.issueDate, d) })}
                className={cn(chipCls,
                  isoPlusDays(draft.issueDate, d) === draft.dueDate ? 'border-link bg-surface-2 text-link' : 'border-line text-fg-muted hover:border-line-strong')}>
                {t('editor.days', { count: d })}
              </button>
            ))}
          </div>
  )
  const methodField = !taxDoc && (
          <div role="radiogroup" aria-labelledby="invoice-method" className="space-y-1.5">
            <span id="invoice-method" className="block text-sm text-fg-muted">{t('editor.paymentMethod')}</span>
            <div className="flex gap-1.5">
              {PaymentMethod.options.map((m) => (
                <button key={m} type="button" role="radio" aria-checked={draft.paymentMethod === m} onClick={() => set({ paymentMethod: m })}
                  className={cn(chipCls,
                    draft.paymentMethod === m ? 'border-link bg-surface-2 text-link' : 'border-line text-fg-muted hover:border-line-strong')}>
                  {t(`editor.method.${m}`)}
                </button>
              ))}
            </div>
            {overCashLimit(draft) ? <p className="max-w-hint text-xs font-medium text-warning">{t('editor.cashLimit', { limit: f.moneyWhole(CASH_LIMIT) })}</p>
              : draft.paymentMethod !== 'bank' && <p className="max-w-hint text-xs text-fg-muted">{t(`editor.methodHint.${draft.paymentMethod}`)}</p>}
          </div>
  )
  // Where the money goes, as the PDF prints it. It is the supplier's account from Settings, so here it is only shown,
  // with the way to change it; a missing one is said in the warning colour, because the customer couldn't pay.
  const bank = settings!.supplier.bank
  const hasAccount = !!(bank.account || bank.iban)
  const accountField = paysByBank(draft) && (
    <div className="space-y-1.5">
      <span className="block text-sm text-fg-muted">{t('editor.account')}</span>
      {hasAccount ? (
        <p className="flex min-h-9 flex-col justify-center text-sm tabular-nums">
          {bank.account && <span>{bank.account}/{bank.bankCode}</span>}
          {bank.iban && <span className={cn(bank.account && 'text-xs text-fg-muted')}>IBAN {bank.iban.replace(/(.{4})/g, '$1 ').trim()}</span>}
        </p>
      ) : <p className="flex min-h-9 items-center text-sm font-medium text-warning">{t('editor.accountMissing')}</p>}
      <p className="max-w-hint text-xs text-fg-muted">
        {!hasAccount && <>{t('editor.accountMissingHint')} </>}
        <a href="#/settings" className="text-link underline underline-offset-2 decoration-line-strong hover:decoration-current" onClick={(e) => {
          // Keep the work: store the draft before leaving for Settings.
          e.preventDefault()
          if (dirty && canSave) save()
          navigate('/settings')
        }}>{t(hasAccount ? 'editor.accountEdit' : 'editor.accountAdd')}</a>
      </p>
    </div>
  )
  const duzpField = isPayer && !proforma && (
            <Labeled label={taxDoc ? t('editor.paymentReceived') : t('editor.taxableSupplyDate')}>
              <Input type="date" value={draft.taxableSupplyDate ?? ''} onChange={(e) => set({ taxableSupplyDate: e.target.value || undefined, ...clearAutoRate(draft) })} />
            </Labeled>
  )
  const currencyField = (
            <Labeled label={t('editor.currency')}>
              <Select value={draft.currency} onChange={(e) => set({ currency: e.target.value, exchangeRate: undefined, exchangeRateSource: undefined })}>
                {[...new Set([...CURRENCIES, draft.currency])].map((c) => <option key={c}>{c}</option>)}
              </Select>
            </Labeled>
  )
  const languageField = (
            <Labeled label={t('editor.language')}>
              <Select value={draft.language} onChange={(e) => set({ language: e.target.value as InvoiceLang })}>
                {INVOICE_LANGS.map((l) => <option key={l} value={l}>{LANG_NAMES[l]}</option>)}
              </Select>
            </Labeled>
  )
  const reverseField = isPayer && (
            <Checkbox label={t('editor.reverseCharge')} checked={draft.reverseCharge} onChange={(e) => set({ reverseCharge: e.target.checked })} />
  )
  const rateField = draft.currency !== 'CZK' && (
            <div className="space-y-1.5">
              <label htmlFor="invoice-rate" className="block text-sm text-fg-muted">{t('editor.exchangeRate', { currency: draft.currency })}</label>
              <div className="flex gap-2">
                <NumberInput id="invoice-rate" className="flex-1" value={draft.exchangeRate}
                  onChange={(n) => set({ exchangeRate: n > 0 ? n : undefined, exchangeRateSource: n > 0 ? 'manual' : undefined })} />
                <Button variant="secondary" disabled={rateBusy} title={t('rates.ecbOne')} onClick={() => void loadRate()}>
                  {rateBusy ? <Loader2 className="size-4 animate-spin" /> : <CloudDownload className="size-4" />} ECB
                </Button>
              </div>
              <p className="text-xs text-fg-muted">
                {rateError ? <span className="text-danger">{rateError}</span>
                  : draft.exchangeRate ? <>{t(`rates.source.${draft.exchangeRateSource ?? 'manual'}`)} · ≈ {f.money(mulRound(totals.total, draft.exchangeRate))}</>
                  : t('rates.noneYet')}
              </p>
            </div>
  )
  const paidField = draft.status === 'paid' && (
            <Labeled label={t('editor.paidDate')}>
              <Input type="date" value={draft.paidDate ?? ''} onChange={(e) => set({ paidDate: e.target.value || undefined })} />
            </Labeled>
  )
  // Tags stay editable on a locked invoice: they're the user's own filing, not what the customer got.
  const tagsField = (
    <>
          <Labeled label={t('editor.tags')} hint={t('editor.tagsHint')}>
            <Input list="tag-list" defaultValue={draft.tags.join(', ')} key={draft.id}
              onBlur={(e) => {
                const tags = [...new Set(e.target.value.split(',').map((x) => x.trim()).filter(Boolean))]
                if (tags.join() !== draft.tags.join()) set({ tags })
              }} />
          </Labeled>
          <datalist id="tag-list">{allTags.map((tag) => <option key={tag} value={tag} />)}</datalist>
    </>
  )
  const historyBlock = events.length > 0 && (
            <div className="space-y-1.5 border-t border-line pt-4">
              <span className="block text-sm text-fg-muted">{t('editor.history')}</span>
              <ol className="space-y-1 text-xs text-fg-muted">
                {events.map((e, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="w-20 shrink-0 tabular-nums">{f.date(e.date)}</span>
                    <span>{t(`editor.event.${e.type}`)}{e.number && <> <a href={`#/invoices/${e.id}`} className="text-link underline underline-offset-2 decoration-line-strong hover:decoration-current">{e.number}</a></>}</span>
                  </li>
                ))}
              </ol>
            </div>
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="relative flex items-center gap-3">
          <BackButton />
          <h1 className="font-display text-3xl leading-[1.2] font-semibold whitespace-nowrap">
            {taxDoc ? (!saved ? t('editor.newTaxDocTitle') : t('editor.taxDocTitle', { number: draft.number }))
              : credit ? (!saved ? t('editor.newCreditTitle') : t('editor.creditTitle', { number: draft.number }))
              : proforma ? (!saved ? t('editor.newProformaTitle') : t('editor.proformaTitle', { number: draft.number }))
              : !saved ? t('editor.newTitle') : t('editor.title', { number: draft.number })}
          </h1>
        </div>
        {saved && <StatusBadge status={status} />}
        {/* The lock and its key sit together by the status, so the action buttons stay on one row. */}
        {locked && (
          <span className="inline-flex items-center gap-1.5 text-xs whitespace-nowrap text-fg-muted">
            <Lock aria-hidden="true" className="size-3.5" />{t('editor.locked')}
            <button type="button" title={t('editor.unlockHint')} onClick={() => setUnlocked(true)}
              className="font-medium text-link underline underline-offset-2 decoration-line-strong hover:decoration-current">{t('editor.unlock')}</button>
          </span>
        )}
        <div className="ml-auto flex flex-wrap justify-end gap-2 [&>button]:whitespace-nowrap">
          {/* The main action first, then the secondary ones, Delete, and the more menu last (the owner, 2026-10-18). */}
          {draft.status === 'draft' ? (
            // "Vystavit" is the last step's button, under the review; up here a draft can only be put aside.
            <Button variant="secondary" disabled={!dirty} onClick={guarded(() => save())}>{t('editor.saveDraft')}</Button>
          ) : (
            // Locked, only the note, rate and paid date can change; Save shows up once one of them does.
            (!locked || dirty) && <Button disabled={!dirty} onClick={guarded(saveChanges)}>{t('common.save')}</Button>
          )}
          {/* Sending happens in the user's own mail program; an overdue one gets a reminder instead (docs/email.md). */}
          {draft.status === 'issued' && !draft.uncollectible && (draft.kind === 'invoice' || proforma) && (
            <Button variant="secondary" onClick={() => setEmail(status === 'overdue' ? 'reminder' : 'invoice')}>
              {status === 'overdue' ? <><BellRing className="size-4" /> {t('email.remind')}</> : <><Mail className="size-4" /> {t('email.send')}</>}
            </Button>
          )}
          <Button variant="secondary" disabled={!draft.customerSnapshot.name} onClick={showPdf}>
            <FileDown className="size-4" /> PDF
          </Button>
          {draft.status === 'issued' && (
            <Button variant="secondary" onClick={() => save({ status: 'paid', paidDate: today(), paidAmount: due, uncollectible: undefined })}>
              <Check className="size-4" /> {t('invoices.markPaid')}
            </Button>
          )}
          {hasReceipt(draft) && (
            <Button variant="secondary" onClick={() => setReceipt(cleaned())}>
              <ReceiptText className="size-4" /> {t('editor.receipt')}
            </Button>
          )}
          {draft.status === 'draft' && saved && (
            <Button variant="ghost" onClick={() => { removeInvoice(draft.id); navigate('/invoices') }}>
              <Trash2 className="size-4" /> {t('editor.delete')}
            </Button>
          )}
          <MoreMenu items={([
            draft.status === 'issued' && { key: 'cancel', icon: <Ban className="size-4" />, label: t('editor.cancel'), onClick: () => save({ status: 'cancelled' }) },
            draft.status === 'cancelled' && { key: 'restore', icon: <RotateCcw className="size-4" />, label: t('editor.restore'), onClick: () => save({ status: 'issued' }) },
            draft.kind === 'invoice' && (draft.status === 'issued' || draft.status === 'paid') && { key: 'credit', icon: <FileMinus2 className="size-4" />, label: t('editor.creditNote'), onClick: startCreditNote },
            draft.status === 'issued' && status !== 'overdue' && (draft.kind === 'invoice' || proforma) && { key: 'remind', icon: <BellRing className="size-4" />, label: t('email.remind'), onClick: () => setEmail('reminder') },
            draft.status === 'paid' && { key: 'unpaid', icon: <X className="size-4" />, label: t('editor.markUnpaid'), onClick: () => save({ status: 'issued', paidDate: undefined, paidAmount: undefined }) },
            draft.kind === 'invoice' && !!saved && { key: 'copy', icon: <Copy className="size-4" />, label: t('editor.duplicate'), onClick: () => { if (dirty && canSave) save(); navigate(`/invoices/new?copy=${draft.id}`) } },
            draft.kind === 'invoice' && draft.status !== 'draft' && { key: 'delivery', icon: <Truck className="size-4" />, label: t('editor.deliveryNote'), onClick: () => setDeliveryNote(cleaned()) },
            draft.kind === 'invoice' && draft.status === 'issued' && !draft.uncollectible && { key: 'writeOff', icon: <CircleSlash className="size-4" />, label: t('editor.writeOff'), onClick: () => save({ uncollectible: today() }) },
            draft.uncollectible && draft.status === 'issued' && { key: 'unWriteOff', icon: <RotateCcw className="size-4" />, label: t('editor.unWriteOff'), onClick: () => save({ uncollectible: undefined }) },
          ] as (MoreItem | false)[]).filter((x): x is MoreItem => !!x)} />
        </div>
      </div>
      {stepped && (
        <Steps label={t('editor.steps.label')} current={step} onGo={(n) => goTo(n)}
          steps={[t('editor.steps.customer'), t('editor.steps.lines'), t('editor.steps.payment'), t('editor.steps.review')]} />
      )}
      {unlocked && draft.status !== 'draft' && (
        <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-surface-2 p-4 text-sm">
          <div className="min-w-0 max-w-hint flex-1">
            <p className="font-medium text-warning">{t('editor.unlockedTitle')}</p>
            <p className="text-xs text-fg-muted">{t(credit ? 'editor.unlockedHintCredit' : 'editor.unlockedHint')}</p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => { setUnlocked(false); if (saved) setDraft(saved) }}><Lock className="size-4" /> {t('editor.lockAgain')}</Button>
          </div>
        </div>
      )}
      {saved && tampered(saved) && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-surface-2 p-4 text-sm">
          <div className="min-w-0 max-w-hint flex-1">
            <p className="font-medium text-warning">{t('editor.tamperedTitle')}</p>
            <p className="text-xs text-fg-muted">{t('editor.tamperedHint')}</p>
          </div>
          <Button size="sm" variant="secondary" onClick={acceptOutsideChange}>{t('editor.tamperedAccept')}</Button>
        </div>
      )}
      {proforma && draft.status === 'paid' && !settledBy && (
        <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-surface-2 p-4 text-sm">
          {isPayer && !proformaTaxDoc ? (
            <>
              <div className="min-w-0 max-w-hint flex-1">
                <p className={cn('font-medium', today() > taxDocDeadline! && 'text-warning')}>{t('editor.taxDocNeeded', { date: f.date(taxDocDeadline!) })}</p>
                <p className="text-xs text-fg-muted">{t('editor.taxDocNeededHint')}</p>
              </div>
              <Button size="sm" onClick={startAdvanceTaxDoc}><Send className="size-4" /> {t('editor.advanceTaxDoc')}</Button>
            </>
          ) : (
            <>
              <div className="min-w-0 max-w-hint flex-1">
                <p className="font-medium">{t('editor.proformaPaid')}</p>
                <p className="text-xs text-fg-muted">{t(isPayer ? 'editor.proformaPaidHintPayer' : 'editor.proformaPaidHint')}</p>
              </div>
              <Button size="sm" onClick={startFinalInvoice}><Send className="size-4" /> {t('editor.finalInvoice')}</Button>
            </>
          )}
        </div>
      )}
      {proformaTaxDoc && (
        <p className="text-sm text-fg-muted">
          {t('editor.taxDocIssued')}{' '}
          <a href={`#/invoices/${proformaTaxDoc.id}`} className="text-link underline underline-offset-2 decoration-line-strong hover:decoration-current">{proformaTaxDoc.number}</a>
        </p>
      )}
      {settledBy && (
        <p className="text-sm text-fg-muted">
          {t('editor.settledBy')}{' '}
          <a href={`#/invoices/${settledBy.id}`} className="text-link underline underline-offset-2 decoration-line-strong hover:decoration-current">{settledBy.number}</a>
        </p>
      )}
      {corrections.length > 0 && (
        <p className="text-sm text-fg-muted">
          {t('editor.correctedBy')}{' '}
          {corrections.map((c, i) => (
            <span key={c.id}>{i > 0 && ', '}
              <a href={`#/invoices/${c.id}`} className="text-link underline underline-offset-2 decoration-line-strong hover:decoration-current">{c.number}</a>
              {' '}<span className="tabular-nums">({f.money(invoiceTotals(c).total, c.currency)})</span>
            </span>
          ))}
        </p>
      )}
      {pdfError && <p className="rounded-lg bg-surface-2 p-3 text-sm text-danger">{t('pdf.saveFailed')}: {pdfError}</p>}
      {showErrors && errors.length > 1 && <ErrorSummary title={t('validation.invoiceSummary')} errors={errors} />}
      {preview && <PdfPreview invoice={preview} onClose={() => setPreview(undefined)} />}
      {receipt && <PdfPreview invoice={receipt} kind="receipt" onClose={() => setReceipt(undefined)} />}
      {deliveryNote && <PdfPreview invoice={deliveryNote} kind="deliveryNote" onClose={() => setDeliveryNote(undefined)} />}
      {email && (
        <EmailDialog invoice={cleaned()} kind={email} onClose={() => setEmail(undefined)}
          onSent={() => save(email === 'reminder' ? { reminders: [...draft.reminders, today()] } : { sentAt: today() })} />
      )}
      {(draft.sentAt || draft.reminders.length > 0) && (
        <p className="text-sm text-fg-muted">
          {draft.sentAt && t('email.sentOn', { date: f.date(draft.sentAt) })}
          {draft.sentAt && draft.reminders.length > 0 && ' · '}
          {draft.reminders.length > 0 && t('email.remindedOn', { count: draft.reminders.length, date: f.date(draft.reminders.at(-1)!) })}
        </p>
      )}

      <div className="grid grid-cols-3 gap-6 mobile-stack">
        {(!stepped || step < 3) && (
        <Card className={cn(stepped ? 'col-span-3' : 'col-span-2', 'space-y-5 px-6 py-5')}>
          {show(1) && <>
          {stepped && supplierMissing.length > 0 && (
            <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-surface-2 p-4 text-sm">
              <p className="min-w-0 max-w-hint flex-1">{t('editor.review.supplierIncomplete', { list: supplierMissing.join(', ') })}</p>
              <Button size="sm" variant="secondary" onClick={editSupplier}>{t('editor.review.editSupplier')}</Button>
            </div>
          )}
          {stepped && kindField}
          <fieldset disabled={locked || credit || taxDoc} className="min-w-0 space-y-5">
          <Labeled label={t('invoices.customer')} required error={errorFor('invoice-customer')} hint={pickingCustomer ? t('editor.pickCustomerFirst') : undefined}>
            <CustomerPicker id="invoice-customer" customers={customers} value={draft.customerId} name={draft.customerSnapshot.name} onChange={pickCustomer} recent={recentCustomers} summaries={summaries}
              onCreate={(name) => { const c = emptyCustomer(name); upsertCustomer(c); pickCustomer(c) }}
              autoFocus={!saved && !draft.customerId} />
          </Labeled>
          {draft.customerSnapshot.name && (
            <p className="-mt-2 text-xs text-fg-muted">
              {[draft.customerSnapshot.address.street, draft.customerSnapshot.address.zip, draft.customerSnapshot.address.city, draft.customerSnapshot.address.country].filter(Boolean).join(', ')}
              {draft.customerSnapshot.ic && ` · ${t('fields.ic')} ${draft.customerSnapshot.ic}`}
              {draft.customerSnapshot.dic && ` · ${t('fields.dic')} ${draft.customerSnapshot.dic}`}
              {draft.customerId && (
                <a href={`#/customers/${draft.customerId}`} className="ml-2 text-link underline underline-offset-2 decoration-line-strong hover:decoration-current" onClick={(e) => {
                  // Keep the work: store the invoice (as a draft if new) before leaving; drafts pick up the edited customer details.
                  e.preventDefault()
                  if (dirty && canSave) save()
                  navigate(`/customers/${draft.customerId}`)
                }}>{t('customers.edit')}</a>
              )}
            </p>
          )}
          {customerChanged && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-surface-2 p-4 text-sm">
              <div className="min-w-0 max-w-hint flex-1">
                <p className="font-medium">{t('editor.customerChanged')}</p>
                <p className="text-xs text-fg-muted">{t('editor.customerChangedHint')}</p>
              </div>
              <Button size="sm" variant="secondary" onClick={() => set({ customerSnapshot: snapshotOf(currentCustomer!) })}>
                <RefreshCw className="size-4" /> {t('editor.useNewDetails')}
              </Button>
            </div>
          )}
          </fieldset>

          {taxDoc && (
            <div className="space-y-1">
              <p className="text-sm text-fg-muted">
                {t('editor.forProforma')}{' '}
                {advanceOf ? <a href={`#/invoices/${advanceOf.id}`} className="text-link underline underline-offset-2 decoration-line-strong hover:decoration-current">{draft.advanceNumber}</a>
                  : draft.advanceNumber}
              </p>
              {draft.status === 'draft' && taxDocDeadline && (
                <p className={cn('max-w-hint text-xs', draft.issueDate > taxDocDeadline ? 'font-medium text-warning' : 'text-fg-muted')}>
                  {t(draft.issueDate > taxDocDeadline ? 'editor.taxDocLate' : 'editor.taxDocDeadline', { date: f.date(taxDocDeadline) })}
                </p>
              )}
            </div>
          )}

          {credit && (
            <fieldset disabled={locked} className="min-w-0 space-y-3">
              <p className="text-sm text-fg-muted">
                {t('editor.corrects')}{' '}
                {corrected ? <a href={`#/invoices/${corrected.id}`} className="text-link underline underline-offset-2 decoration-line-strong hover:decoration-current">{draft.correctsNumber}</a>
                  : draft.correctsNumber}
              </p>
              <Labeled label={t('editor.reason')} required hint={t('editor.reasonHint')} error={errorFor('invoice-reason')}>
                <Input id="invoice-reason" value={draft.correctionReason} placeholder={t('editor.reasonPlaceholder')}
                  onChange={(e) => set({ correctionReason: e.target.value })} />
              </Labeled>
            </fieldset>
          )}

          </>}
          {show(2) && <>
          {/* As a step the currency comes before the prices typed in it (the owner, 2026-11-27), with its rate and, for a
              VAT payer, reverse charge, which decides whether the lines carry VAT. */}
          {stepped && (
            <div className="flex flex-wrap items-start gap-x-6 gap-y-4">
              <div className="w-40">{currencyField}</div>
              {rateField && <div className="w-72">{rateField}</div>}
              {reverseField && <div className="flex h-9 items-center self-end">{reverseField}</div>}
            </div>
          )}
          {stepped && prefilled && !saved && (
            <p className="text-sm text-fg-muted">
              {t('editor.prefilled', { number: prefilled })}{' '}
              <button type="button" className="font-medium text-link underline underline-offset-2 decoration-line-strong hover:decoration-current" onClick={() => {
                set({ lines: [{ description: '', quantity: 1, unit: settings!.defaults.unit, unitPrice: 0, vatRate: isPayer ? settings!.defaultVatRate : 0 }] })
                setPrefilled(undefined)
              }}>{t('editor.startBlank')}</button>
            </p>
          )}
          <fieldset disabled={locked} className="min-w-0">

          <div>
            <div className="mb-2 grid grid-cols-12 gap-2 text-xs font-medium text-fg-muted max-md:hidden">
              <span className={vatOn ? 'col-span-5' : 'col-span-6'}>{t('editor.description')}</span>
              <span className="col-span-1 text-right">{t('editor.qty')}</span>
              <span className="col-span-1">{t('editor.unit')}</span>
              <span className="col-span-2 text-right">{t('editor.unitPrice')}</span>
              {vatOn && <span className="col-span-1">{t('editor.vat')}</span>}
              <span className="col-span-2 text-right">{t('invoices.total')}</span>
            </div>
            <div className="space-y-2">
              {draft.lines.map((l, i) => (
                // Top-aligned: when a long description grows, the other fields stay level with its first row.
                <div key={i} className="group relative grid grid-cols-12 items-start gap-2 mobile-stack">
                  <LineDescription className={vatOn ? 'col-span-5' : 'col-span-6'} value={l.description} placeholder={t('editor.descriptionPlaceholder')}
                    autoFocus={focusLine === i} onEnter={addLine} suggestions={priceNames}
                    onChange={(description) => setLine(i, { description })}
                    onPick={(description) => {
                      // Picking an item of the price list (ceník) fills in its unit, price and VAT rate.
                      const item = settings!.priceList.find((p) => p.description === description)
                      if (item) setLine(i, { description: item.description, unit: item.unit, unitPrice: item.unitPrice, vatRate: isPayer ? item.vatRate : 0 })
                    }} />
                  <NumberInput className="col-span-1 px-2" value={l.quantity} onChange={(n) => setLine(i, { quantity: n })} />
                  <Input className="col-span-1 px-2" value={l.unit} placeholder="ks" onChange={(e) => setLine(i, { unit: e.target.value })} />
                  <NumberInput className="col-span-2" value={toMajor(l.unitPrice)} onChange={(n) => setLine(i, { unitPrice: toMinor(n) })} />
                  {vatOn && (
                    <Select className="col-span-1 pr-6 pl-2" aria-label={t('editor.vat')} value={l.vatRate} onChange={(e) => setLine(i, { vatRate: Number(e.target.value) })}>
                      {VAT_RATES.map((r) => <option key={r} value={r}>{r} %</option>)}
                    </Select>
                  )}
                  <span className="col-span-2 flex h-9 items-center justify-end pr-1 text-sm font-medium tabular-nums">{f.money(lineBase(l), draft.currency)}</span>
                  {draft.lines.length > 1 && (
                    <button onClick={() => set({ lines: draft.lines.filter((_, j) => j !== i) })}
                      className="absolute top-1.5 -right-8 rounded p-1 text-fg-subtle opacity-0 transition-opacity group-hover:opacity-100 hover:text-danger">
                      <X className="size-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Button variant="ghost" size="sm" onClick={addLine}>
                <Plus className="size-4" /> {t('editor.addLine')}
              </Button>
              {!credit && (discount === undefined ? (
                <Button variant="ghost" size="sm" onClick={() => setDiscount(10)}><Percent className="size-4" /> {t('editor.addDiscount')}</Button>
              ) : (
                <span className="inline-flex items-center gap-2 text-sm">
                  <InputAffix aria-label={t('editor.discountPercent')} unit="%" className="h-8 w-24" type="number" min={1} max={100} value={discount}
                    onChange={(e) => setDiscount(Number(e.target.value))} />
                  <Button size="sm" variant="secondary" disabled={!discount || discount <= 0 || discount > 100}
                    onClick={() => { set({ lines: [...cleaned().lines, ...discountLines(cleaned(), discount!, t('editor.discountLabel'))] }); setDiscount(undefined) }}>
                    {t('editor.applyDiscount')}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setDiscount(undefined)}>{t('common.cancel')}</Button>
                </span>
              ))}
            </div>
            {credit && <p className="mt-1 max-w-hint text-xs text-fg-muted">{t('editor.creditLinesHint')}</p>}
          </div>
          </fieldset>

          <div className="flex justify-end pt-4">
            <dl className="w-72 space-y-1.5 text-sm">
              {vatOn && totals.byRate.map((r) => (
                <div key={r.rate} className="flex justify-between text-fg-muted">
                  <dt>{t('editor.baseAt', { rate: r.rate })}</dt>
                  <dd className="tabular-nums">{f.money(r.base, draft.currency)} + {f.money(r.vat, draft.currency)}</dd>
                </div>
              ))}
              {draft.advanceId && !taxDoc && (
                <>
                  <div className="flex justify-between text-fg-muted">
                    <dt>{t('invoices.total')}</dt>
                    <dd className="tabular-nums">{f.money(totals.total, draft.currency)}</dd>
                  </div>
                  <div className="flex justify-between text-fg-muted">
                    <dt>{t('editor.advancePaid')}{draft.advanceTaxDocNumber && ` (${draft.advanceTaxDocNumber})`}{' '}
                      {advanceOf ? <a href={`#/invoices/${advanceOf.id}`} className="text-link underline underline-offset-2 decoration-line-strong hover:decoration-current">{draft.advanceNumber}</a>
                        : draft.advanceNumber}
                    </dt>
                    <dd className="tabular-nums">{f.money(-(draft.advanceAmount ?? 0), draft.currency)}</dd>
                  </div>
                </>
              )}
              <div className="flex justify-between pt-1 text-lg font-semibold">
                <dt>{taxDoc ? t('editor.received') : credit ? t('editor.difference') : draft.advanceId ? t('editor.balanceDue') : t('editor.toPay')}</dt>
                <dd className="tabular-nums">{f.money(due, draft.currency)}</dd>
              </div>
              {draft.reverseCharge && <p className="text-xs text-fg-muted">{t('editor.reverseChargeNote')}</p>}
            </dl>
          </div>

          <Labeled label={t('editor.note')}>
            <Textarea value={draft.note} onChange={(e) => set({ note: e.target.value })} />
          </Labeled>
          <Labeled label={t('editor.privateNote')} hint={t('editor.privateNoteHint')}>
            <Textarea value={draft.privateNote} onChange={(e) => set({ privateNote: e.target.value })} />
          </Labeled>
          </>}
        </Card>
        )}
        {stepped && step === 4 && (
          <InvoiceReview invoice={reviewInvoice} provisionalNumber={draft.number} settings={settings!} problems={problems} due={due} onEdit={goTo} onEditSupplier={editSupplier}
            dueLabel={taxDoc ? t('editor.received') : credit ? t('editor.difference') : draft.advanceId ? t('editor.balanceDue') : t('editor.toPay')} />
        )}

        {show(3) && (stepped ? (
        // As a step: when it is due, how it is paid, then the document itself (the owner, 2026-11-27).
        <Card className="col-span-3 space-y-6 px-6 py-6">
          <section className="space-y-4">
            <h2 className="text-base font-semibold">{t('editor.sections.dates')}</h2>
            <div className="grid grid-cols-3 gap-x-6 gap-y-4 mobile-stack">
              {issueField}
              {dueField && <div className="space-y-2">{dueField}{dueChips}{dueOffHint}</div>}
              {duzpField}
            </div>
          </section>
          <section className="space-y-4 border-t border-line pt-6">
            <h2 className="text-base font-semibold">{t('editor.sections.payment')}</h2>
            {methodField}
            {/* How, where to, under which symbol. The currency is with the prices, on the lines step. */}
            <div className="grid grid-cols-3 gap-x-6 gap-y-4 mobile-stack">
              {accountField}
              {vsField}
            </div>
          </section>
          <section className="space-y-4 border-t border-line pt-6">
            <h2 className="text-base font-semibold">{t('editor.sections.document')}</h2>
            <div className="grid grid-cols-3 gap-x-6 gap-y-4 mobile-stack">
              {numberField}
              {languageField}
              {tagsField}
            </div>
          </section>
        </Card>
        ) : (
        <Card className="h-fit space-y-4 px-6 py-5">
          <fieldset disabled={locked} className="min-w-0 space-y-4">
            {kindField}
            {numberField}
            {vsField}
            <div className="grid grid-cols-2 gap-3 mobile-stack">{issueField}{dueField}</div>
            {dueChips}
            {methodField}
            {duzpField}
            <div className="grid grid-cols-2 gap-3 mobile-stack">{currencyField}{languageField}</div>
            {reverseField}
          </fieldset>
          {rateField}
          {paidField}
          {tagsField}
          {historyBlock}
        </Card>
        ))}
      </div>
      {stepped && (
        <div className="flex flex-wrap items-center gap-2">
          {step > 1 && <Button variant="secondary" onClick={() => goTo(step - 1)}><ArrowLeft className="size-4" /> {t('common.back')}</Button>}
          <div className="ml-auto flex flex-wrap items-center justify-end gap-x-3 gap-y-2">
            {/* The payment step rarely changes, so the lines step says what it holds and offers to skip it. */}
            {step === 2 && <>
              <span className="text-xs text-fg-muted tabular-nums">
                {[!taxDoc && `${t('invoices.due')} ${t('editor.days', { count: Math.round((Date.parse(draft.dueDate) - Date.parse(draft.issueDate)) / 864e5) })}`,
                  !taxDoc && t(`editor.method.${draft.paymentMethod}`), `${t('invoices.number')} ${draft.number}`].filter(Boolean).join(' · ')}
              </span>
              <Button variant="secondary" onClick={() => goTo(4)}>{t('editor.steps.toReview')}</Button>
            </>}
            {step < 4 ? <Button onClick={() => goTo(step + 1)}>{t('common.continue')} <ArrowRight className="size-4" /></Button>
              : <Button onClick={guarded(() => void issue())}><Send className="size-4" /> {t('editor.issue')}</Button>}
          </div>
        </div>
      )}
    </div>
  )
}
