import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { today } from '@/domain/id'
import { nextNumber } from '@/domain/numbering'
import { SCHEMA_VERSION, Settings } from '@/domain/schema'
import { czechIban } from '@/domain/spayd'
import type { VatMode } from '@/domain/vat'
import { importCsv, type ImportResult } from '@/import/csv'
import { guessPattern, importFakturoid, isFakturoidCsv } from '@/import/fakturoid'
import { useStore } from '@/state/store'
import { AresLookup } from '@/features/customers/AresLookup'
import { OpeningBalance } from '@/features/settings/OpeningBalance'
import { TaxSettings } from '@/features/settings/SettingsPage'
import { FsAccessAdapter } from '@/storage/fsAccess'
import { Button, Card, Choice, Field, cn } from '@/ui/primitives'
import { DropZone, ImportNotes, importErrorText } from './ImportParts'

type Supplier = Settings['supplier']

/** Where the user comes from; it decides which steps follow (docs/product.md#first-run-from-download-to-first-invoice). */
type Source = 'new' | 'fakturoid' | 'idoklad' | 'other'
type Step = 'start' | 'import' | 'continue' | 'supplier' | 'vat' | 'taxes'
const SOURCES: Source[] = ['new', 'fakturoid', 'idoklad', 'other']

// A company's legal form in its name: the sole trader's tax and insurance don't apply. ARES says it more reliably.
const COMPANY = /(^|[\s,])(s\.\s?r\.\s?o|spol\.|a\.\s?s|v\.\s?o\.\s?s|k\.\s?s|z\.\s?s|z\.\s?ú)\.?($|[\s,])/i

const emptySupplier: Supplier = {
  name: '', ic: '', dic: '', email: '', phone: '', web: '', registration: '',
  address: { street: '', zip: '', city: '', country: 'Česká republika' },
  bank: { account: '', bankCode: '', iban: '', swift: '' },
}

/** Fill only the fields still empty, so an import never overwrites what the user typed. */
function fillBlanks<T extends object>(current: T, from: Partial<T>): T {
  const out = { ...current } as Record<string, unknown>
  for (const [k, v] of Object.entries(from)) {
    const now = (current as Record<string, unknown>)[k]
    if (v && typeof v === 'object') out[k] = fillBlanks((now ?? {}) as object, v as object)
    else if (v && !now) out[k] = v
  }
  return out as T
}

const defaultTaxes = () => Settings.parse({ schemaVersion: SCHEMA_VERSION, supplier: { name: '-' }, vatMode: 'nonPayer' }).taxes

export function Onboarding() {
  const { t, i18n } = useTranslation()
  const { saveSettings, replaceAll, adapter, previous, open, newBusinessName } = useStore()
  const [source, setSource] = useState<Source>('new')
  const [stepIndex, setStepIndex] = useState(0)
  const [previousName, setPreviousName] = useState('')
  useEffect(() => {
    if (previous instanceof FsAccessAdapter) void FsAccessAdapter.list(previous).then((l) => setPreviousName(l.find((f) => f.current)?.label ?? ''))
  }, [previous])
  const [supplier, setSupplier] = useState<Supplier>(() => ({ ...emptySupplier, name: newBusinessName ?? '' }))
  const [vatMode, setVatMode] = useState<VatMode>('nonPayer')
  const [files, setFiles] = useState<{ customers?: string; invoices?: string; fakturoid?: string }>({})
  const [result, setResult] = useState<ImportResult>()
  const [importError, setImportError] = useState<string>()
  // What a Fakturoid export suggested, shown above the VAT choice.
  const [suggestedVat, setSuggestedVat] = useState<VatMode>()
  const [numbering, setNumbering] = useState<Partial<Settings['numbering']>>({})
  const [lastNumber, setLastNumber] = useState('')
  const [opening, setOpening] = useState<Settings['opening']>({ year: 0, income: 0, turnover: 0 })
  // ARES or the company's name switch off the sole trader's taxes, until the user sets them.
  const [taxes, setTaxes] = useState(defaultTaxes)
  const [taxesTouched, setTaxesTouched] = useState(false)
  const [aresSelfEmployed, setAresSelfEmployed] = useState<boolean>()

  const steps: Step[] = [
    'start',
    ...(source === 'fakturoid' || source === 'idoklad' ? ['import' as const] : source === 'other' ? ['continue' as const] : []),
    'supplier', 'vat', 'taxes',
  ]
  const step = steps[Math.min(stepIndex, steps.length - 1)]
  const isLast = stepIndex >= steps.length - 1

  const set = (patch: Partial<Supplier>) => setSupplier((s) => ({ ...s, ...patch }))
  const setAddr = (patch: Partial<Supplier['address']>) => set({ address: { ...supplier.address, ...patch } })
  const setBank = (patch: Partial<Supplier['bank']>) => set({ bank: { ...supplier.bank, ...patch } })

  // "I invoice elsewhere": the number format and the next number from the last number typed.
  const on = today()
  const year = Number(on.slice(0, 4))
  const typedPattern = lastNumber.trim() ? guessPattern(lastNumber, year) : undefined
  const nextPreview = useMemo(() => {
    try { return nextNumber(typedPattern ?? '{YYYY}{NNNN}', on, typedPattern ? [lastNumber.trim()] : []) } catch { return '' }
  }, [typedPattern, lastNumber, on])

  function chooseSource(s: Source) {
    setSource(s)
    setFiles({})
    setResult(undefined)
    setImportError(undefined)
    setNumbering({})
    setSuggestedVat(undefined)
  }

  async function readFakturoid(f: File | undefined) {
    if (!f) return
    const text = await f.text()
    setFiles({ fakturoid: text })
    setResult(undefined)
    setImportError(undefined)
    try {
      const res = importFakturoid(text, 'payer')
      setResult(res)
      setSupplier((s) => fillBlanks(s, res.supplier))
      setNumbering(res.numbering)
      setSuggestedVat(res.vatMode)
      if (res.vatMode) setVatMode(res.vatMode)
    } catch (e) {
      setImportError(importErrorText(t, e, 'fakturoid'))
    }
  }

  async function readFile(kind: 'customers' | 'invoices', f: File | undefined) {
    if (!f) return
    const text = await f.text()
    const next = { ...files, [kind]: text }
    setFiles(next)
    setResult(undefined)
    setImportError(undefined)
    if (isFakturoidCsv(text)) { setImportError(t('onboarding.looksLikeFakturoid')); return }
    // An empty file is still a file: compare with undefined, so it gets the "empty" message instead of nothing.
    if (next.customers !== undefined && next.invoices !== undefined) {
      try {
        const res = importCsv(next.customers, next.invoices, vatMode)
        setResult(res)
        // Carry on the series of the newest imported invoice.
        const newest = [...res.invoices].sort((a, b) => b.issueDate.localeCompare(a.issueDate))[0]
        const pattern = newest && guessPattern(newest.number, Number(newest.issueDate.slice(0, 4)))
        setNumbering(pattern ? { pattern } : {})
      } catch (e) {
        setImportError(importErrorText(t, e, 'idoklad'))
      }
    }
  }

  // Added a business by mistake: forget the new folder (nothing has been written to it yet) and reopen the one before.
  async function cancelNew() {
    if (!(previous instanceof FsAccessAdapter) || !(await previous.activate())) return
    if (adapter instanceof FsAccessAdapter) await adapter.forgetFolder()
    await open(previous)
  }

  // The user already has Invojka data elsewhere (a folder they moved, a wrong folder picked): open that one instead.
  // This folder has nothing written yet, so it leaves the list of businesses.
  async function pickExisting() {
    try {
      const picked = await FsAccessAdapter.pick()
      if (adapter instanceof FsAccessAdapter && !(await picked.isSame(adapter))) await adapter.forgetFolder()
      await open(picked)
    } catch (e) {
      if ((e as Error).name !== 'AbortError') throw e
    }
  }

  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string>()

  async function finish() {
    const bank = { ...supplier.bank }
    if (!bank.iban && bank.account && bank.bankCode) bank.iban = czechIban(bank.account, bank.bankCode)
    // Imported again with the VAT mode finally chosen; the preview used a guess.
    const imported = source === 'fakturoid' && result && files.fakturoid ? importFakturoid(files.fakturoid, vatMode)
      : source === 'idoklad' && result && files.customers !== undefined && files.invoices !== undefined ? importCsv(files.customers, files.invoices, vatMode)
      : undefined
    const continued = source === 'other' && typedPattern ? { pattern: typedPattern, continueFrom: lastNumber.trim() } : {}
    saveSettings(Settings.parse({
      schemaVersion: SCHEMA_VERSION,
      supplier: { ...supplier, bank },
      vatMode,
      numbering: imported ? numbering : continued,
      ...(source === 'other' && { opening }),
      // The flat-rate tax isn't for payers: a payer who chose it before switching the VAT mode is back on the tax return.
      taxes: vatMode === 'payer' && taxes.regime === 'flat' ? { ...taxes, regime: 'standard' } : taxes,
      // The first-steps checklist on Home starts now.
      ui: { language: i18n.language === 'cs' ? 'cs' : 'en', firstSteps: [] },
      defaults: { invoiceLanguage: i18n.language === 'cs' ? 'cs' : 'en' },
    }))
    if (imported) replaceAll({ customers: imported.customers, invoices: imported.invoices })
    // Wait until the files are really on disk; closing the tab mid-save would otherwise leave them empty.
    setSaving(true)
    setSaveError(undefined)
    await useStore.getState().flush()
    setSaving(false)
    const { saveState, saveError: err } = useStore.getState()
    if (saveState === 'saved') useStore.getState().setPhase({ kind: 'ready' })
    else setSaveError(err ?? saveState)
  }

  const titles: Record<Step, string> = {
    start: t('onboarding.start'), import: t('onboarding.import'), continue: t('onboarding.continue'),
    supplier: t('onboarding.supplier'), vat: t('onboarding.vat'), taxes: t('onboarding.taxes'),
  }

  // The name is the one required field: Continue shows the error instead of being disabled.
  const [showErrors, setShowErrors] = useState(false)
  const nameError = supplier.name.trim() ? undefined : t('validation.name')
  function next() {
    if (step === 'supplier' && nameError) {
      setShowErrors(true)
      document.getElementById('supplier-name')?.focus()
      return
    }
    if (step === 'supplier' && !taxesTouched) setTaxes((x) => ({ ...x, selfEmployed: aresSelfEmployed ?? !COMPANY.test(supplier.name) }))
    setStepIndex(stepIndex + 1)
  }

  // TaxSettings edits a whole Settings; give it one made of the draft.
  // The name isn't checked here (the supplier step does), so a placeholder stands in for an empty one.
  const draft = useMemo(() => Settings.parse({ schemaVersion: SCHEMA_VERSION, supplier: { name: supplier.name || '-' }, vatMode, taxes }),
    [supplier.name, vatMode, taxes])

  return (
    <div className="grid min-h-screen place-items-center p-6">
      <Card className="animate-rise w-full max-w-2xl p-8">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm text-fg-subtle">{t('onboarding.step', { n: stepIndex + 1, total: steps.length })}</p>
            <h1 className="mt-1 font-display text-4xl leading-[1.2] font-bold tracking-[-0.01em]">{titles[step]}</h1>
          </div>
          <div className="flex gap-1.5">
            {steps.map((s, i) => (
              <div key={s} className={cn('h-1 w-8 rounded-sm transition-colors', i <= stepIndex ? 'bg-accent' : 'bg-surface-3')} />
            ))}
          </div>
        </div>

        <div key={step} className="animate-rise">
          {step === 'start' && (
            <div className="space-y-5">
              <p className="max-w-prose text-sm text-fg-muted">{t('onboarding.startHint')}</p>
              <div role="radiogroup" aria-label={t('onboarding.start')} className="space-y-3">
                {SOURCES.map((s) => (
                  <Choice key={s} selected={source === s} onClick={() => chooseSource(s)}
                    title={t(`onboarding.sources.${s}`)} hint={t(`onboarding.sources.${s}Hint`)} />
                ))}
              </div>
              {adapter instanceof FsAccessAdapter && (
                <p className="text-sm text-fg-muted">
                  {t('onboarding.haveData')}{' '}
                  <button className="text-link underline underline-offset-2 decoration-line-strong hover:decoration-current" onClick={() => void pickExisting()}>
                    {t('onboarding.pickExisting')}
                  </button>
                </p>
              )}
            </div>
          )}

          {step === 'import' && (
            <div className="space-y-5">
              <p className="max-w-prose text-sm text-fg-muted">{t(source === 'fakturoid' ? 'onboarding.fakturoidImportHint' : 'onboarding.importHint')}</p>
              {source === 'fakturoid'
                ? <DropZone done={!!result} label={t('onboarding.fakturoidCsv')} onFile={(f) => void readFakturoid(f)} />
                : (
                  <div className="grid grid-cols-2 gap-4 mobile-stack">
                    {(['customers', 'invoices'] as const).map((kind) => (
                      <DropZone key={kind} done={files[kind] !== undefined} label={t(kind === 'customers' ? 'onboarding.customersCsv' : 'onboarding.invoicesCsv')}
                        onFile={(f) => void readFile(kind, f)} />
                    ))}
                  </div>
                )}
              {importError && <p className="rounded-lg bg-surface-2 p-3 text-sm text-danger">{importError}</p>}
              {result && (
                <div className="animate-rise space-y-2 rounded-xl bg-surface-2 p-4 text-sm">
                  <p className="font-medium">{t('onboarding.importSummary', { invoices: result.invoices.length, customers: result.customers.length })}</p>
                  <ImportNotes result={result} />
                </div>
              )}
            </div>
          )}

          {step === 'continue' && (
            <div className="space-y-5">
              <p className="max-w-prose text-sm text-fg-muted">{t('onboarding.continueHint')}</p>
              <Field className="max-w-xs" label={t('onboarding.lastNumber')} placeholder={`${year}0041`} inputClassName="font-mono" autoFocus
                value={lastNumber} onChange={(e) => setLastNumber(e.target.value)}
                hint={nextPreview ? t(typedPattern ? 'onboarding.nextWillBe' : 'onboarding.nextDefault', { next: nextPreview }) : undefined} />
              <div className="space-y-3 pt-2">
                <h2 className="font-medium">{t('opening.title', { year })}</h2>
                <p className="max-w-prose text-sm text-fg-muted">{t('opening.hint')}</p>
                <OpeningBalance value={opening} year={year} onChange={setOpening} />
              </div>
            </div>
          )}

          {step === 'supplier' && (
            <div className="space-y-6">
              <p className="max-w-prose text-sm text-fg-muted">{t('onboarding.supplierHint')}</p>
              {source === 'fakturoid' && result && <p className="max-w-prose rounded-lg bg-surface-2 p-3 text-sm">{t('onboarding.prefilled')}</p>}
              <div className="grid grid-cols-6 gap-4 mobile-stack">
                <AresLookup className="col-span-6" autoFocus={!supplier.name}
                  onPick={(p) => { set({ name: p.name, ic: p.ic, dic: p.dic, address: p.address }); setAresSelfEmployed(p.selfEmployed) }} />
                <Field className="col-span-6" id="supplier-name" label={t('fields.name')} required error={showErrors ? nameError : undefined}
                  value={supplier.name} onChange={(e) => set({ name: e.target.value })} onBlur={() => setShowErrors(true)} />
                <Field className="col-span-3" label={t('fields.ic')} value={supplier.ic} onChange={(e) => set({ ic: e.target.value })} />
                <Field className="col-span-3" label={t('fields.dic')} value={supplier.dic} onChange={(e) => set({ dic: e.target.value })} />
                <Field className="col-span-6" label={t('fields.street')} value={supplier.address.street} onChange={(e) => setAddr({ street: e.target.value })} />
                <Field className="col-span-2" label={t('fields.zip')} value={supplier.address.zip} onChange={(e) => setAddr({ zip: e.target.value })} />
                <Field className="col-span-4" label={t('fields.city')} value={supplier.address.city} onChange={(e) => setAddr({ city: e.target.value })} />
                <Field className="col-span-3" label={t('fields.email')} type="email" value={supplier.email} onChange={(e) => set({ email: e.target.value })} />
                <Field className="col-span-3" label={t('fields.phone')} value={supplier.phone} onChange={(e) => set({ phone: e.target.value })} />
                <Field className="col-span-4" label={t('fields.account')} placeholder="123456789" value={supplier.bank.account} onChange={(e) => setBank({ account: e.target.value })} />
                <Field className="col-span-2" label={t('fields.bankCode')} placeholder="0800" value={supplier.bank.bankCode} onChange={(e) => setBank({ bankCode: e.target.value })} />
                <Field className="col-span-6" label={t('fields.registration')} hint={t('fields.registrationHint')} value={supplier.registration} onChange={(e) => set({ registration: e.target.value })} />
              </div>
            </div>
          )}

          {step === 'vat' && (
            <div className="space-y-4">
              {suggestedVat && <p className="text-sm text-fg-muted">{t('onboarding.vatFromImport', { mode: t(`vatMode.${suggestedVat}`) })}</p>}
              <div role="radiogroup" aria-label={t('onboarding.vat')} className="space-y-3">
                {(['nonPayer', 'payer', 'identifiedPerson'] as const).map((m) => (
                  <Choice key={m} selected={vatMode === m} onClick={() => setVatMode(m)} title={t(`vatMode.${m}`)} hint={t(`vatMode.${m}Hint`)} />
                ))}
              </div>
            </div>
          )}

          {step === 'taxes' && (
            <div className="space-y-5">
              <p className="max-w-prose text-sm text-fg-muted">{t('onboarding.taxesHint')}</p>
              <TaxSettings settings={draft} update={(patch) => { if (patch.taxes) { setTaxes(patch.taxes); setTaxesTouched(true) } }} />
            </div>
          )}
        </div>

        {saveError && <p className="mt-6 rounded-lg bg-surface-2 p-3 text-sm text-danger">{t('save.error')}: {saveError}</p>}

        <div className="mt-8 flex items-center justify-between">
          <div className="space-y-1">
            <span className="block text-xs text-fg-subtle">{adapter?.name}</span>
            {previous instanceof FsAccessAdapter && previousName && (
              <button className="text-xs text-link underline underline-offset-2 decoration-line-strong hover:decoration-current" onClick={() => void cancelNew()}>
                {t('business.cancelNew', { name: previousName })}
              </button>
            )}
          </div>
          <div className="flex gap-2">
            {stepIndex > 0 && <Button variant="ghost" onClick={() => setStepIndex(stepIndex - 1)}>{t('common.back')}</Button>}
            {!isLast
              ? <Button onClick={next}>{step === 'import' && !result ? t('onboarding.skipImport') : t('common.continue')}</Button>
              : <Button onClick={() => void finish()} disabled={saving}>{saving ? t('save.saving') : t('onboarding.finish')}</Button>}
          </div>
        </div>
      </Card>
    </div>
  )
}
