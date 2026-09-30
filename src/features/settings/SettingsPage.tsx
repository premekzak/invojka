import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { today } from '@/domain/id'
import { CURRENCIES } from '@/domain/money'
import { nextNumber } from '@/domain/numbering'
import type { Settings } from '@/domain/schema'
import { czechIban } from '@/domain/spayd'
import { VAT_RATES } from '@/domain/vat'
import { RatesPanel } from '@/features/rates/RatesPanel'
import { useStore } from '@/state/store'
import { FsAccessAdapter } from '@/storage/fsAccess'
import { Button, Card, Choice, Field } from '@/ui/primitives'

const selectCls = 'h-10 w-full rounded-lg border border-line bg-surface px-3 text-sm focus:border-accent focus:outline-none'

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card className="p-6">
      <h2 className="mb-4 font-serif text-2xl font-semibold">{title}</h2>
      {children}
    </Card>
  )
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium text-fg-muted">{label}</span>
      <select className={selectCls} value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  )
}

export function SettingsPage() {
  const { t } = useTranslation()
  const { settings, saveSettings, invoices, adapter, open, demo } = useStore()
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
    next = nextNumber(s.numbering.pattern, Number(today().slice(0, 4)), invoices.map((i) => i.number))
  } catch {
    next = '?'
  }

  return (
    <div className="space-y-6">
      <h1 className="font-serif text-4xl leading-[1.2] font-semibold">{t('settings.title')}</h1>

      <Section title={t('settings.supplier')}>
        <div className="grid grid-cols-6 gap-4">
          <Field className="col-span-6" label={t('fields.name')} value={s.supplier.name} onChange={(e) => sup({ name: e.target.value })} />
          <Field className="col-span-3" label={t('fields.ic')} value={s.supplier.ic} onChange={(e) => sup({ ic: e.target.value })} />
          <Field className="col-span-3" label={t('fields.dic')} value={s.supplier.dic} onChange={(e) => sup({ dic: e.target.value })} />
          <Field className="col-span-6" label={t('fields.street')} value={s.supplier.address.street} onChange={(e) => addr({ street: e.target.value })} />
          <Field className="col-span-2" label={t('fields.zip')} value={s.supplier.address.zip} onChange={(e) => addr({ zip: e.target.value })} />
          <Field className="col-span-2" label={t('fields.city')} value={s.supplier.address.city} onChange={(e) => addr({ city: e.target.value })} />
          <Field className="col-span-2" label={t('fields.country')} value={s.supplier.address.country} onChange={(e) => addr({ country: e.target.value })} />
          <Field className="col-span-2" label={t('fields.email')} value={s.supplier.email} onChange={(e) => sup({ email: e.target.value })} />
          <Field className="col-span-2" label={t('fields.phone')} value={s.supplier.phone} onChange={(e) => sup({ phone: e.target.value })} />
          <Field className="col-span-2" label={t('fields.web')} value={s.supplier.web} onChange={(e) => sup({ web: e.target.value })} />
          <Field className="col-span-6" label={t('fields.registration')} value={s.supplier.registration} onChange={(e) => sup({ registration: e.target.value })} />
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
        <div className="grid grid-cols-3 gap-3">
          {(['nonPayer', 'payer', 'identifiedPerson'] as const).map((m) => (
            <Choice key={m} selected={s.vatMode === m} onClick={() => update({ vatMode: m })} title={t(`vatMode.${m}`)} hint={t(`vatMode.${m}Hint`)} />
          ))}
        </div>
        {s.vatMode === 'payer' && (
          <div className="mt-4 w-48">
            <Select label={t('settings.defaultVatRate')} value={String(s.defaultVatRate)} onChange={(v) => update({ defaultVatRate: Number(v) })}
              options={VAT_RATES.map((r) => [String(r), `${r} %`])} />
          </div>
        )}
      </Section>

      <Section title={t('settings.defaults')}>
        <div className="grid grid-cols-4 gap-4">
          <Field label={t('settings.dueDays')} type="number" min={0} value={s.defaults.dueDays} onChange={(e) => defaults({ dueDays: Math.max(0, Number(e.target.value)) })} />
          <Select label={t('settings.currency')} value={s.defaults.currency} onChange={(v) => defaults({ currency: v })} options={CURRENCIES.map((c) => [c, c])} />
          <Select label={t('settings.invoiceLanguage')} value={s.defaults.invoiceLanguage} onChange={(v) => defaults({ invoiceLanguage: v as 'cs' | 'en' })}
            options={[['cs', 'Čeština'], ['en', 'English']]} />
          <Field label={t('settings.unit')} value={s.defaults.unit} placeholder="ks, hod…" onChange={(e) => defaults({ unit: e.target.value })} />
          <div className="col-span-2">
            <Field label={t('settings.pattern')} value={s.numbering.pattern} className="font-mono" onChange={(e) => update({ numbering: { pattern: e.target.value } })} />
            <p className="mt-1 text-xs text-fg-subtle">{t('settings.patternHint', { next })}</p>
          </div>
          <Field className="col-span-2" label={t('settings.note')} value={s.defaults.note} onChange={(e) => defaults({ note: e.target.value })} />
        </div>
      </Section>

      <Section title={t('rates.title')}>
        <div id="rates"><RatesPanel /></div>
      </Section>

      <Section title={t('settings.app')}>
        <div className="grid grid-cols-4 items-end gap-4">
          <Select label={t('settings.uiLanguage')} value={s.ui.language} onChange={(v) => update({ ui: { ...s.ui, language: v as 'cs' | 'en' } })}
            options={[['cs', 'Čeština'], ['en', 'English']]} />
          <Select label={t('settings.theme')} value={s.ui.theme} onChange={(v) => update({ ui: { ...s.ui, theme: v as Settings['ui']['theme'] } })}
            options={[['system', t('settings.themeSystem')], ['light', t('settings.themeLight')], ['dark', t('settings.themeDark')]]} />
          <div className="col-span-2 flex items-center justify-between gap-3 rounded-lg bg-surface-2 px-3 py-2 text-sm">
            <span className="truncate"><span className="text-fg-muted">{t('settings.folder')}:</span> {adapter?.name}</span>
            <Button size="sm" variant="secondary" disabled={demo} onClick={async () => {
              try {
                const next = await FsAccessAdapter.pick()
                await useStore.getState().flush()
                await open(next)
              } catch (e) { if ((e as Error).name !== 'AbortError') throw e }
            }}>{t('settings.changeFolder')}</Button>
          </div>
        </div>
        <DemoToggle />
      </Section>
    </div>
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
    <div className="mt-6 flex items-start justify-between gap-6 border-t border-line pt-5">
      <div className="space-y-1">
        <div className="text-sm font-medium">{t('demo.title')}</div>
        <p className="max-w-prose text-xs text-fg-muted">{t('demo.hint')}</p>
        {error && <p className="text-xs text-danger">{error}</p>}
      </div>
      <Button size="sm" variant={demo ? 'primary' : 'secondary'} className="shrink-0" onClick={() => void toggle()}>
        {demo ? t('demo.off') : t('demo.on')}
      </Button>
    </div>
  )
}
