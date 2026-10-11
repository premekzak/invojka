import { Check, FileUp } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { SCHEMA_VERSION, Settings } from '@/domain/schema'
import { czechIban } from '@/domain/spayd'
import type { VatMode } from '@/domain/vat'
import { importCsv, type ImportResult } from '@/import/csv'
import { useStore } from '@/state/store'
import { Button, Card, Choice, Field, cn } from '@/ui/primitives'

type Supplier = Settings['supplier']

const emptySupplier: Supplier = {
  name: '', ic: '', dic: '', email: '', phone: '', web: '', registration: '',
  address: { street: '', zip: '', city: '', country: 'Česká republika' },
  bank: { account: '', bankCode: '', iban: '', swift: '' },
}

export function Onboarding() {
  const { t, i18n } = useTranslation()
  const { saveSettings, replaceAll, adapter } = useStore()
  const [step, setStep] = useState(0)
  const [supplier, setSupplier] = useState<Supplier>(emptySupplier)
  const [vatMode, setVatMode] = useState<VatMode>('nonPayer')
  const [files, setFiles] = useState<{ customers?: string; invoices?: string }>({})
  const [result, setResult] = useState<ImportResult>()
  const [importError, setImportError] = useState<string>()

  const set = (patch: Partial<Supplier>) => setSupplier((s) => ({ ...s, ...patch }))
  const setAddr = (patch: Partial<Supplier['address']>) => set({ address: { ...supplier.address, ...patch } })
  const setBank = (patch: Partial<Supplier['bank']>) => set({ bank: { ...supplier.bank, ...patch } })

  async function readFile(kind: 'customers' | 'invoices', f: File | undefined) {
    if (!f) return
    const next = { ...files, [kind]: await f.text() }
    setFiles(next)
    setResult(undefined)
    setImportError(undefined)
    if (next.customers && next.invoices) {
      try {
        setResult(importCsv(next.customers, next.invoices, vatMode))
      } catch (e) {
        setImportError((e as Error).message)
      }
    }
  }

  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string>()

  async function finish() {
    const bank = { ...supplier.bank }
    if (!bank.iban && bank.account && bank.bankCode) bank.iban = czechIban(bank.account, bank.bankCode)
    saveSettings(Settings.parse({
      schemaVersion: SCHEMA_VERSION,
      supplier: { ...supplier, bank },
      vatMode,
      ui: { language: i18n.language === 'cs' ? 'cs' : 'en' },
      defaults: { invoiceLanguage: i18n.language === 'cs' ? 'cs' : 'en' },
    }))
    if (result) replaceAll({ customers: result.customers, invoices: result.invoices })
    // Wait until the files are really on disk; closing the tab mid-save would otherwise leave them empty.
    setSaving(true)
    setSaveError(undefined)
    await useStore.getState().flush()
    setSaving(false)
    const { saveState, saveError: err } = useStore.getState()
    if (saveState === 'saved') useStore.getState().setPhase({ kind: 'ready' })
    else setSaveError(err ?? saveState)
  }

  const steps = [t('onboarding.supplier'), t('onboarding.vat'), t('onboarding.import')]

  // The name is the one required field: Continue shows the error instead of being disabled.
  const [showErrors, setShowErrors] = useState(false)
  const nameError = supplier.name.trim() ? undefined : t('validation.name')
  function next() {
    if (step === 0 && nameError) {
      setShowErrors(true)
      document.getElementById('supplier-name')?.focus()
      return
    }
    setStep(step + 1)
  }

  return (
    <div className="grid min-h-screen place-items-center p-6">
      <Card className="animate-rise w-full max-w-2xl p-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <p className="text-sm text-fg-subtle">{t('onboarding.step', { n: step + 1, total: steps.length })}</p>
            <h1 className="mt-1 font-serif text-4xl leading-[1.2] font-semibold">{steps[step]}</h1>
          </div>
          <div className="flex gap-1.5">
            {steps.map((_, i) => (
              <div key={i} className={cn('h-1 w-8 rounded-sm transition-colors', i <= step ? 'bg-accent' : 'bg-surface-3')} />
            ))}
          </div>
        </div>

        <div key={step} className="animate-rise">
          {step === 0 && (
            <div className="space-y-6">
              <p className="max-w-prose text-sm text-fg-muted">{t('onboarding.supplierHint')}</p>
              <div className="grid grid-cols-6 gap-4">
                <Field className="col-span-6" id="supplier-name" label={t('fields.name')} required error={showErrors ? nameError : undefined}
                  value={supplier.name} onChange={(e) => set({ name: e.target.value })} onBlur={() => setShowErrors(true)} autoFocus />
                <Field className="col-span-3" label={t('fields.ic')} value={supplier.ic} onChange={(e) => set({ ic: e.target.value })} />
                <Field className="col-span-3" label={t('fields.dic')} value={supplier.dic} onChange={(e) => set({ dic: e.target.value })} />
                <Field className="col-span-6" label={t('fields.street')} value={supplier.address.street} onChange={(e) => setAddr({ street: e.target.value })} />
                <Field className="col-span-2" label={t('fields.zip')} value={supplier.address.zip} onChange={(e) => setAddr({ zip: e.target.value })} />
                <Field className="col-span-4" label={t('fields.city')} value={supplier.address.city} onChange={(e) => setAddr({ city: e.target.value })} />
                <Field className="col-span-3" label={t('fields.email')} type="email" value={supplier.email} onChange={(e) => set({ email: e.target.value })} />
                <Field className="col-span-3" label={t('fields.phone')} value={supplier.phone} onChange={(e) => set({ phone: e.target.value })} />
                <Field className="col-span-4" label={t('fields.account')} placeholder="123456789" value={supplier.bank.account} onChange={(e) => setBank({ account: e.target.value })} />
                <Field className="col-span-2" label={t('fields.bankCode')} placeholder="0800" value={supplier.bank.bankCode} onChange={(e) => setBank({ bankCode: e.target.value })} />
                <Field className="col-span-6" label={t('fields.registration')} value={supplier.registration} onChange={(e) => set({ registration: e.target.value })} />
              </div>
            </div>
          )}

          {step === 1 && (
            <div role="radiogroup" aria-label={t('onboarding.vat')} className="space-y-3">
              {(['nonPayer', 'payer', 'identifiedPerson'] as const).map((m) => (
                <Choice key={m} selected={vatMode === m} onClick={() => setVatMode(m)} title={t(`vatMode.${m}`)} hint={t(`vatMode.${m}Hint`)} />
              ))}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <p className="max-w-prose text-sm text-fg-muted">{t('onboarding.importHint')}</p>
              <div className="grid grid-cols-2 gap-4">
                {(['customers', 'invoices'] as const).map((kind) => (
                  <label key={kind} className={cn(
                    'flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed p-6 text-center text-sm transition-colors',
                    files[kind] ? 'border-line-strong bg-surface-2' : 'border-line hover:border-accent',
                  )}>
                    {files[kind] ? <Check className="size-6 text-success" /> : <FileUp className="size-6 text-fg-subtle" />}
                    <span className="font-medium">{t(kind === 'customers' ? 'onboarding.customersCsv' : 'onboarding.invoicesCsv')}</span>
                    <input type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => readFile(kind, e.target.files?.[0])} />
                  </label>
                ))}
              </div>
              {importError && <p className="rounded-lg bg-surface-2 p-3 text-sm text-danger">{importError}</p>}
              {result && (
                <div className="animate-rise space-y-2 rounded-xl bg-surface-2 p-4 text-sm">
                  <p className="font-medium">{t('onboarding.importSummary', { invoices: result.invoices.length, customers: result.customers.length })}</p>
                  {result.merges.length > 0 && (
                    <div>
                      <p className="text-fg-muted">{t('onboarding.merged')}:</p>
                      <ul className="mt-1 list-inside list-disc text-fg-muted">
                        {result.merges.map((m) => <li key={m.kept}>{m.kept} ← {m.merged.join(', ')}</li>)}
                      </ul>
                    </div>
                  )}
                  {result.warnings.map((w) => <p key={w} className="text-warning">{w}</p>)}
                </div>
              )}
            </div>
          )}
        </div>

        {saveError && <p className="mt-6 rounded-lg bg-surface-2 p-3 text-sm text-danger">{t('save.error')}: {saveError}</p>}

        <div className="mt-8 flex items-center justify-between border-t border-line pt-6">
          <span className="text-xs text-fg-subtle">{adapter?.name}</span>
          <div className="flex gap-2">
            {step > 0 && <Button variant="ghost" onClick={() => setStep(step - 1)}>{t('common.back')}</Button>}
            {step < steps.length - 1
              ? <Button onClick={next}>{t('common.continue')}</Button>
              : <Button onClick={() => void finish()} disabled={saving}>{saving ? t('save.saving') : t('onboarding.finish')}</Button>}
          </div>
        </div>
      </Card>
    </div>
  )
}
