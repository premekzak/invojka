import { useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { today } from '@/domain/id'
import { CURRENCIES } from '@/domain/money'
import { nextNumber } from '@/domain/numbering'
import type { Settings } from '@/domain/schema'
import { czechIban } from '@/domain/spayd'
import { VAT_RATES } from '@/domain/vat'
import { RatesPanel } from '@/features/rates/RatesPanel'
import { openBusiness } from '@/features/shell/BusinessSwitcher'
import { useStore } from '@/state/store'
import { FsAccessAdapter, type RememberedFolder } from '@/storage/fsAccess'
import { Button, Card, Choice, Field, InputAffix, Labeled, Select, SettingRow } from '@/ui/primitives'

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 font-display text-2xl font-bold tracking-[-0.015em]">{title}</h2>
      <Card className="p-5">{children}</Card>
    </section>
  )
}

function Options({ value, onChange, options, ...p }: { value: string; onChange: (v: string) => void; options: [string, string][]; 'aria-label'?: string }) {
  return (
    <Select value={value} onChange={(e) => onChange(e.target.value)} {...p}>
      {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </Select>
  )
}

function SelectField({ label, ...p }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return <Labeled label={label}><Options {...p} /></Labeled>
}

export function SettingsPage() {
  const { t } = useTranslation()
  const { settings, saveSettings, invoices } = useStore()
  const s = settings!
  const update = (patch: Partial<Settings>) => saveSettings({ ...s, ...patch })
  const sup = (patch: Partial<Settings['supplier']>) => update({ supplier: { ...s.supplier, ...patch } })
  const addr = (patch: Partial<Settings['supplier']['address']>) => sup({ address: { ...s.supplier.address, ...patch } })
  const bank = (patch: Partial<Settings['supplier']['bank']>) => {
    const b = { ...s.supplier.bank, ...patch }
    // Keep the IBAN in sync with a Czech account number unless the user typed an IBAN themselves.
    if (('account' in patch || 'bankCode' in patch) && b.account && b.bankCode) b.iban = czechIban(b.account, b.bankCode)
    sup({ bank: b })
  }
  const defaults = (patch: Partial<Settings['defaults']>) => update({ defaults: { ...s.defaults, ...patch } })

  let next = ''
  try {
    next = nextNumber(s.numbering.pattern, today(), invoices.map((i) => i.number))
  } catch {
    next = '?'
  }

  return (
    <div className="space-y-10">
      <h1 className="font-display text-4xl leading-[1.2] font-bold tracking-[-0.03em]">{t('settings.title')}</h1>

      <Section title={t('settings.supplier')}>
        <div className="grid grid-cols-6 gap-4">
          <Field className="col-span-6" label={t('fields.name')} required error={s.supplier.name.trim() ? undefined : t('validation.name')}
            value={s.supplier.name} onChange={(e) => sup({ name: e.target.value })} />
          <Field className="col-span-3" label={t('fields.ic')} value={s.supplier.ic} onChange={(e) => sup({ ic: e.target.value })} />
          <Field className="col-span-3" label={t('fields.dic')} value={s.supplier.dic} onChange={(e) => sup({ dic: e.target.value })} />
          <Field className="col-span-6" label={t('fields.street')} value={s.supplier.address.street} onChange={(e) => addr({ street: e.target.value })} />
          <Field className="col-span-2" label={t('fields.zip')} value={s.supplier.address.zip} onChange={(e) => addr({ zip: e.target.value })} />
          <Field className="col-span-2" label={t('fields.city')} value={s.supplier.address.city} onChange={(e) => addr({ city: e.target.value })} />
          <Field className="col-span-2" label={t('fields.country')} value={s.supplier.address.country} onChange={(e) => addr({ country: e.target.value })} />
          <Field className="col-span-2" label={t('fields.email')} value={s.supplier.email} onChange={(e) => sup({ email: e.target.value })} />
          <Field className="col-span-2" label={t('fields.phone')} value={s.supplier.phone} onChange={(e) => sup({ phone: e.target.value })} />
          <Field className="col-span-2" label={t('fields.web')} value={s.supplier.web} onChange={(e) => sup({ web: e.target.value })} />
          <Field className="col-span-6" label={t('fields.registration')} hint={t('fields.registrationHint')} value={s.supplier.registration} onChange={(e) => sup({ registration: e.target.value })} />
        </div>
      </Section>

      <Section title={t('settings.bank')}>
        <div className="grid grid-cols-6 gap-4">
          <Field className="col-span-4" label={t('fields.account')} value={s.supplier.bank.account} onChange={(e) => bank({ account: e.target.value })} />
          <Field className="col-span-2" label={t('fields.bankCode')} value={s.supplier.bank.bankCode} onChange={(e) => bank({ bankCode: e.target.value })} />
          <Field className="col-span-4" label={t('fields.iban')} value={s.supplier.bank.iban} onChange={(e) => bank({ iban: e.target.value })} />
          <Field className="col-span-2" label={t('fields.swift')} value={s.supplier.bank.swift} onChange={(e) => bank({ swift: e.target.value })} />
        </div>
      </Section>

      <Section title={t('settings.vat')}>
        <div role="radiogroup" aria-label={t('settings.vat')} className="grid grid-cols-3 gap-3">
          {(['nonPayer', 'payer', 'identifiedPerson'] as const).map((m) => (
            <Choice key={m} selected={s.vatMode === m} onClick={() => update({ vatMode: m })} title={t(`vatMode.${m}`)} hint={t(`vatMode.${m}Hint`)} />
          ))}
        </div>
        {s.vatMode === 'payer' && (
          <div className="mt-4 w-48">
            <SelectField label={t('settings.defaultVatRate')} value={String(s.defaultVatRate)} onChange={(v) => update({ defaultVatRate: Number(v) })}
              options={VAT_RATES.map((r) => [String(r), `${r} %`])} />
          </div>
        )}
      </Section>

      <Section title={t('settings.defaults')}>
        <div className="grid grid-cols-4 gap-4">
          <Labeled label={t('settings.dueDays')}>
            <InputAffix unit={t('common.days')} type="number" min={0} value={s.defaults.dueDays} onChange={(e) => defaults({ dueDays: Math.max(0, Number(e.target.value)) })} />
          </Labeled>
          <SelectField label={t('settings.currency')} value={s.defaults.currency} onChange={(v) => defaults({ currency: v })} options={CURRENCIES.map((c) => [c, c])} />
          <SelectField label={t('settings.invoiceLanguage')} value={s.defaults.invoiceLanguage} onChange={(v) => defaults({ invoiceLanguage: v as 'cs' | 'en' })}
            options={[['cs', 'Čeština'], ['en', 'English']]} />
          <Field label={t('settings.unit')} value={s.defaults.unit} placeholder="ks, hod…" onChange={(e) => defaults({ unit: e.target.value })} />
          <Field className="col-span-2" label={t('settings.pattern')} hint={t('settings.patternHint', { next })} value={s.numbering.pattern}
            inputClassName="font-mono" onChange={(e) => update({ numbering: { pattern: e.target.value } })} />
          <Field className="col-span-2" label={t('settings.note')} value={s.defaults.note} onChange={(e) => defaults({ note: e.target.value })} />
        </div>
      </Section>

      <Section title={t('rates.title')}>
        <div id="rates"><RatesPanel /></div>
      </Section>

      {/* Single-value settings are rows: text on the left, the control on the right (design system: SettingRow). */}
      <section>
        <h2 className="mb-3 font-display text-2xl font-bold tracking-[-0.015em]">{t('settings.app')}</h2>
        <Card className="divide-y divide-line">
          <SettingRow title={t('settings.uiLanguage')}>
            <Options aria-label={t('settings.uiLanguage')} value={s.ui.language} onChange={(v) => update({ ui: { ...s.ui, language: v as 'cs' | 'en' } })}
              options={[['cs', 'Čeština'], ['en', 'English']]} />
          </SettingRow>
          <SettingRow title={t('settings.theme')}>
            <Options aria-label={t('settings.theme')} value={s.ui.theme} onChange={(v) => update({ ui: { ...s.ui, theme: v as Settings['ui']['theme'] } })}
              options={[['system', t('settings.themeSystem')], ['light', t('settings.themeLight')], ['dark', t('settings.themeDark')]]} />
          </SettingRow>
          <FolderRow />
          <DemoToggle />
        </Card>
      </section>
    </div>
  )
}

/** The current business's folder. With more than one business it can be taken off the list (its files stay). */
function FolderRow() {
  const { t } = useTranslation()
  const { adapter, demo } = useStore()
  const [others, setOthers] = useState<RememberedFolder[]>([])
  const [error, setError] = useState('')
  useEffect(() => {
    if (!demo) void FsAccessAdapter.list(adapter).then((l) => setOthers(l.filter((f) => !f.current)))
  }, [adapter, demo])
  const remove = async () => {
    if (!(adapter instanceof FsAccessAdapter) || !others[0]) return
    setError('')
    const r = await openBusiness(others[0].adapter)
    if (r === 'ok') await adapter.forgetFolder()
    else setError(r === 'denied' ? t('business.denied', { folder: others[0].adapter.name }) : t('business.unsaved'))
  }
  return (
    <SettingRow title={t('settings.folder')} hint={<>{t('business.folderHint', { folder: adapter?.name })}
      {others.length > 0 && <span className="mt-1 block">{t('business.removeHint')}</span>}
      {error && <span className="mt-1 block font-medium text-danger">{error}</span>}</>}>
      {others.length > 0 && <Button className="w-full" variant="secondary" disabled={demo} onClick={() => void remove()}>{t('business.remove')}</Button>}
    </SettingRow>
  )
}

function DemoToggle() {
  const { t } = useTranslation()
  const { demo, enterDemo, exitDemo } = useStore()
  const [error, setError] = useState('')
  const toggle = async () => {
    setError('')
    try {
      await (demo ? exitDemo() : enterDemo(t('demo.badge')))
    } catch {
      setError(t('demo.unsaved'))
    }
  }
  return (
    <SettingRow title={t('demo.title')} hint={<>{t('demo.hint')}{error && <span className="mt-1 block font-medium text-danger">{error}</span>}</>}>
      <Button className="w-full" variant={demo ? 'primary' : 'secondary'} onClick={() => void toggle()}>
        {demo ? t('demo.off') : t('demo.on')}
      </Button>
    </SettingRow>
  )
}
