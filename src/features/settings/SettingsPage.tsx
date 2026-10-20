import { useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { today } from '@/domain/id'
import { DEFAULT_TEMPLATES, PLACEHOLDER_NAMES, templateFor, type EmailKind } from '@/domain/email'
import { usedNumbers, withVatMode } from '@/domain/invoice'
import { INVOICE_LANGS, LANG_NAMES, type InvoiceLang } from '@/domain/language'
import { canEstimate, EXPENSE_RATES, flatBandLimits, flatTaxMonthly, RATES, TAX_REGIMES, type ExpenseRate, type FlatBand, type TaxRegime } from '@/domain/taxes'
import { CURRENCIES, toMajor, toMinor } from '@/domain/money'
import { nextNumber } from '@/domain/numbering'
import { INVOICE_COLORS, PaymentMethod, SCHEMES, type Invoice, type Settings } from '@/domain/schema'
import { PdfPreview } from '@/features/invoices/PdfPreview'
import { PDF_COLORS } from '@/pdf/palette'
import { useFormat } from '@/ui/format'
import { shrinkImage } from '@/ui/image'
import { navigate, useRoute } from '@/ui/router'
import { czechIban } from '@/domain/spayd'
import { VAT_RATES } from '@/domain/vat'
import { RatesPanel } from '@/features/rates/RatesPanel'
import { ImportHistory } from './ImportHistory'
import { OpeningBalance } from './OpeningBalance'
import { openBusiness } from '@/features/shell/BusinessSwitcher'
import { useStore } from '@/state/store'
import { FsAccessAdapter, type RememberedFolder } from '@/storage/fsAccess'
import { clearUrlLanguage, setUiLanguage, type Lang } from '@/i18n'
import { Button, Card, Checkbox, Choice, Field, Input, InputAffix, Labeled, Select, SettingRow, Textarea, cn } from '@/ui/primitives'

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 font-display text-2xl font-bold">{title}</h2>
      <Card className="px-6 py-5">{children}</Card>
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

/** One picture (logo or stamp): a preview, choose, remove. Shrunk to `max` before it's stored in the settings. */
function PictureField({ label, hint, value, max, onChange }: {
  label: string; hint: string; value?: string; max: [number, number]; onChange: (v: string | undefined) => void
}) {
  const { t } = useTranslation()
  const [error, setError] = useState(false)
  return (
    <div className="space-y-1.5">
      <span className="block text-sm font-medium text-fg">{label}</span>
      <div className="flex items-center gap-3">
        <div className="grid h-16 w-40 place-items-center rounded-lg border border-line p-1" style={{ backgroundColor: PDF_COLORS.paper }}>
          {value ? <img src={value} alt="" className="max-h-full max-w-full object-contain" /> : <span className="text-xs text-fg-subtle">{t('look.none')}</span>}
        </div>
        <label className="inline-flex h-8 cursor-pointer items-center rounded-lg border border-line bg-surface-2 px-3 text-sm font-medium transition-colors hover:bg-surface-3 focus-within:outline-2 focus-within:outline-link">
          {value ? t('look.replace') : t('look.choose')}
          <input type="file" accept="image/png,image/jpeg,image/gif,image/webp" className="sr-only" onChange={async (e) => {
            const file = e.target.files?.[0]
            e.target.value = ''
            if (!file) return
            try { setError(false); onChange(await shrinkImage(file, ...max)) } catch { setError(true) }
          }} />
        </label>
        {value && <Button size="sm" variant="ghost" onClick={() => onChange(undefined)}>{t('look.remove')}</Button>}
      </div>
      <p className={cn('max-w-prose text-xs', error ? 'font-medium text-danger' : 'text-fg-muted')}>{error ? t('look.badImage') : hint}</p>
    </div>
  )
}

/**
 * How the invoice PDF looks: colour, logo, stamp and footer, with a preview on the latest invoice. The PDF stays
 * neutral unless a colour is chosen (docs/ui.md).
 */
function InvoiceLook({ settings: s, update, sample }: { settings: Settings; update: (patch: Partial<Settings>) => void; sample?: Invoice }) {
  const { t } = useTranslation()
  const [preview, setPreview] = useState(false)
  const look = (patch: Partial<Settings['invoice']>) => update({ invoice: { ...s.invoice, ...patch } })
  return (
    <div className="space-y-5">
      <div role="radiogroup" aria-labelledby="look-color" className="space-y-1.5">
        <span id="look-color" className="block text-sm font-medium text-fg">{t('look.color')}</span>
        <div className="flex flex-wrap gap-2">
          {INVOICE_COLORS.map((c) => (
            <button key={c} type="button" role="radio" aria-checked={s.invoice.color === c} onClick={() => look({ color: c })}
              className={cn('flex items-center gap-2 rounded-lg border px-2.5 py-1 text-sm transition-colors',
                s.invoice.color === c ? 'border-link bg-surface-2 text-fg' : 'border-line text-fg-muted hover:border-line-strong')}>
              <span aria-hidden="true" className="size-4 rounded" style={{ backgroundColor: PDF_COLORS.accents[c] }} />
              {t(`look.colors.${c}`)}
            </button>
          ))}
        </div>
        <p className="max-w-prose text-xs text-fg-muted">{t('look.colorHint')}</p>
      </div>
      <div className="grid grid-cols-2 gap-6 mobile-stack">
        <PictureField label={t('look.logo')} hint={t('look.logoHint')} value={s.invoice.logo} max={[600, 200]} onChange={(v) => look({ logo: v })} />
        <PictureField label={t('look.stamp')} hint={t('look.stampHint')} value={s.invoice.stamp} max={[480, 240]} onChange={(v) => look({ stamp: v })} />
      </div>
      <Field label={t('look.footer')} hint={t('look.footerHint')} value={s.invoice.footer} onChange={(e) => look({ footer: e.target.value })} />
      {sample && (
        <div>
          <Button variant="secondary" onClick={() => setPreview(true)}>{t('look.preview', { number: sample.number })}</Button>
          {preview && <PdfPreview invoice={sample} onClose={() => setPreview(false)} />}
        </div>
      )}
    </div>
  )
}

/**
 * The price list (ceník): items typed once and picked by their description on an invoice line, which fills in the unit,
 * the price and (for a payer) the VAT rate.
 */
function PriceList({ settings: s, update }: { settings: Settings; update: (patch: Partial<Settings>) => void }) {
  const { t } = useTranslation()
  const payer = s.vatMode === 'payer'
  const items = s.priceList
  const setItem = (i: number, patch: Partial<Settings['priceList'][number]>) => update({ priceList: items.map((x, j) => (j === i ? { ...x, ...patch } : x)) })
  return (
    <div className="space-y-3">
      <p className="max-w-prose text-xs text-fg-muted">{t('priceList.hint')}</p>
      {items.length > 0 && (
        <div className="space-y-2">
          <div className="grid grid-cols-12 gap-2 text-xs font-medium text-fg-muted max-md:hidden">
            <span className={payer ? 'col-span-6' : 'col-span-7'}>{t('editor.description')}</span>
            <span className="col-span-2">{t('editor.unit')}</span>
            <span className="col-span-2 text-right">{t('editor.unitPrice')}</span>
            {payer && <span className="col-span-1">{t('editor.vat')}</span>}
          </div>
          {items.map((item, i) => (
            <div key={i} className="grid grid-cols-12 items-center gap-2 mobile-stack">
              <Input className={payer ? 'col-span-6' : 'col-span-7'} aria-label={t('editor.description')} value={item.description} onChange={(e) => setItem(i, { description: e.target.value })} />
              <Input className="col-span-2" aria-label={t('editor.unit')} value={item.unit} placeholder="ks" onChange={(e) => setItem(i, { unit: e.target.value })} />
              <Input className="col-span-2 text-right tabular-nums" aria-label={t('editor.unitPrice')} inputMode="decimal" defaultValue={toMajor(item.unitPrice)}
                onBlur={(e) => { const n = Number(e.target.value.replace(/\s/g, '').replace(',', '.')); if (Number.isFinite(n)) setItem(i, { unitPrice: toMinor(n) }) }} />
              {payer && (
                <Select className="col-span-1 pr-6 pl-2" aria-label={t('editor.vat')} value={item.vatRate} onChange={(e) => setItem(i, { vatRate: Number(e.target.value) })}>
                  {VAT_RATES.map((r) => <option key={r} value={r}>{r} %</option>)}
                </Select>
              )}
              <Button size="sm" variant="ghost" className="col-span-1" aria-label={t('priceList.remove')} onClick={() => update({ priceList: items.filter((_, j) => j !== i) })}>×</Button>
            </div>
          ))}
        </div>
      )}
      <Button variant="secondary" size="sm" onClick={() => update({ priceList: [...items, { description: '', unit: s.defaults.unit, unitPrice: 0, vatRate: payer ? s.defaultVatRate : 0 }] })}>
        {t('priceList.add')}
      </Button>
    </div>
  )
}

/**
 * The e-mail texts for sending an invoice and a reminder, in each invoice language. A field left as the built-in text
 * stores nothing, so later improvements to the built-in text still reach the user.
 */
function EmailTemplates({ settings: s, update }: { settings: Settings; update: (patch: Partial<Settings>) => void }) {
  const { t } = useTranslation()
  const [lang, setLang] = useState<InvoiceLang>(s.defaults.invoiceLanguage)
  const set = (kind: EmailKind, patch: Partial<{ subject: string; body: string }> | undefined) => {
    const current = templateFor(s, kind, lang)
    const next = patch && { ...current, ...patch }
    const isDefault = !next || (next.subject === DEFAULT_TEMPLATES[kind][lang].subject && next.body === DEFAULT_TEMPLATES[kind][lang].body)
    update({ emailTemplates: { ...s.emailTemplates, [kind]: { ...s.emailTemplates?.[kind], [lang]: isDefault ? undefined : next } } })
  }
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-prose text-xs text-fg-muted">{t('settings.emailHint', { placeholders: Object.values(PLACEHOLDER_NAMES[lang]).map((p) => `{${p}}`).join(' ') })}</p>
        <div role="radiogroup" aria-label={t('settings.emailLanguage')} className="flex gap-1.5">
          {INVOICE_LANGS.map((l) => (
            <button key={l} type="button" role="radio" aria-checked={lang === l} onClick={() => setLang(l)}
              className={cn('rounded border px-2.5 py-0.5 text-xs transition-colors', lang === l ? 'border-link bg-surface-2 text-link' : 'border-line text-fg-muted hover:border-line-strong')}>
              {LANG_NAMES[l]}
            </button>
          ))}
        </div>
      </div>
      {(['invoice', 'reminder'] as const).map((kind) => {
        const tpl = templateFor(s, kind, lang)
        const own = !!s.emailTemplates?.[kind]?.[lang]
        return (
          <div key={kind} className="space-y-3">
            <div className="flex items-baseline justify-between">
              <h3 className="text-sm font-semibold">{t(`settings.emailKind.${kind}`)}</h3>
              {own && <button type="button" onClick={() => set(kind, undefined)} className="text-xs text-link underline underline-offset-2 decoration-line-strong hover:decoration-current">{t('settings.emailReset')}</button>}
            </div>
            <Field label={t('email.subject')} value={tpl.subject} onChange={(e) => set(kind, { subject: e.target.value })} />
            <Labeled label={t('email.body')}>
              <Textarea rows={8} value={tpl.body} onChange={(e) => set(kind, { body: e.target.value })} />
            </Labeled>
          </div>
        )
      })}
    </div>
  )
}

/** The settings categories, in the order of the tabs. */
export const SETTINGS_TABS = ['business', 'invoices', 'emails', 'taxes', 'rates', 'app'] as const
export type SettingsTab = (typeof SETTINGS_TABS)[number]

/**
 * Sole traders: the regime (a tax return with flat-rate expenses, the flat-rate tax and its band, or one Invojka can't
 * estimate), the activity and the expense rate. The expense rate also sets the flat-tax band limits.
 */
export function TaxSettings({ settings: s, update }: { settings: Settings; update: (patch: Partial<Settings>) => void }) {
  const { t } = useTranslation()
  const f = useFormat()
  const set = (patch: Partial<Settings['taxes']>) => update({ taxes: { ...s.taxes, ...patch } })
  const rates = RATES[Number(today().slice(0, 4))]
  const flat = s.taxes.regime === 'flat'
  const estimated = canEstimate(s.taxes.regime)
  const kc = (n: number) => f.moneyWhole(n * 100)
  return (
    <div className="space-y-4">
      <Checkbox label={t('taxes.selfEmployed')} hint={t('taxes.selfEmployedHint')} checked={s.taxes.selfEmployed}
        onChange={(e) => set({ selfEmployed: e.target.checked })} />
      {s.taxes.selfEmployed && (
        <div className="grid max-w-2xl grid-cols-2 gap-4 mobile-stack">
          <Labeled className="col-span-2" label={t('taxes.regime')} error={flat && s.vatMode === 'payer' ? t('taxes.regimePayer') : undefined}
            hint={t(`taxes.regimeHints.${s.taxes.regime}`)}>
            <Options value={s.taxes.regime} onChange={(v) => set({ regime: v as TaxRegime })}
              options={TAX_REGIMES.map((r) => [r, t(`taxes.regimes.${r}`)])} />
          </Labeled>
          {flat && (
            <Labeled className="col-span-2" label={t('taxes.flatBand')}
              hint={t('taxes.flatBandHint', { limit: kc(flatBandLimits(s.taxes.expenseRate)[s.taxes.flatBand - 1]!), rate: s.taxes.expenseRate })}>
              <Options value={String(s.taxes.flatBand)} onChange={(v) => set({ flatBand: Number(v) as FlatBand })}
                options={([1, 2, 3] as const).map((b) => [String(b), rates
                  ? t('taxes.flatBandOption', { band: b, amount: kc(flatTaxMonthly(rates, b)) }) : t('taxes.flatBandShort', { band: b })])} />
            </Labeled>
          )}
          {estimated && <>
            <Labeled label={t('taxes.activity')} hint={t(s.taxes.activity === 'main' ? 'taxes.activityMain' : 'taxes.activitySecondary')}>
              <Options value={s.taxes.activity} onChange={(v) => set({ activity: v as 'main' | 'secondary' })}
                options={[['main', t('taxes.activities.main')], ['secondary', t('taxes.activities.secondary')]]} />
            </Labeled>
            <Labeled label={t('taxes.expenseRate')} hint={flat ? t('taxes.expenseRateFlatHint') : undefined}>
              <Options value={String(s.taxes.expenseRate)} onChange={(v) => set({ expenseRate: Number(v) as ExpenseRate })}
                options={EXPENSE_RATES.map((r) => [String(r), t(`taxes.expenseRates.${r}`)])} />
            </Labeled>
            {s.taxes.activity === 'secondary' && (
              <Checkbox className="col-span-2" label={t('taxes.taxpayerCredit')} hint={t('taxes.taxpayerCreditHint')} checked={s.taxes.taxpayerCredit}
                onChange={(e) => set({ taxpayerCredit: e.target.checked })} />
            )}
          </>}
        </div>
      )}
    </div>
  )
}

/**
 * A segmented control like the invoice list's status filter, but as the page's sub-navigation it is larger and spans
 * the full width, its tabs sharing it evenly (the owner, 2026-10-18).
 */
function Segmented<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div role="tablist" aria-label={label} className="flex w-full flex-wrap gap-1 rounded-2xl bg-track p-1">
      {options.map(([v, text]) => (
        <button key={v} type="button" role="tab" aria-selected={value === v} onClick={() => onChange(v)}
          className={cn('flex-1 rounded-xl px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-link',
            value === v ? 'bg-surface text-fg' : 'text-fg-muted hover:text-fg')}>
          {text}
        </button>
      ))}
    </div>
  )
}

export function SettingsPage() {
  const { t, i18n } = useTranslation()
  const route = useRoute()
  // 'look' was its own tab until the owner merged it into Invoices (2026-10-18); old links still land there.
  const asked = (route.query.get('tab') === 'look' ? 'invoices' : route.query.get('tab')) as SettingsTab | null
  const tab: SettingsTab = asked && SETTINGS_TABS.includes(asked) ? asked : 'business'
  const { settings, saveSettings, invoices, upsertInvoices } = useStore()
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
  /** Drafts follow the new VAT mode; issued invoices keep theirs. */
  const setVatMode = (vatMode: Settings['vatMode']) => {
    const next = { ...s, vatMode }
    saveSettings(next)
    upsertInvoices(invoices.filter((i) => withVatMode(i, next) !== i).map((i) => withVatMode(i, next)))
  }

  // The next number of a series as a preview under its pattern; a pattern being typed may not parse yet.
  const preview = (pattern: string) => {
    try { return nextNumber(pattern, today(), usedNumbers(s, invoices)) } catch { return '?' }
  }
  const next = preview(s.numbering.pattern)

  return (
    <div className="space-y-10">
      <h1 className="font-display text-4xl leading-[1.2] font-bold tracking-[-0.01em]">{t('settings.title')}</h1>

      {/* Settings grew too long for one page (the owner, 2026-10-18), so it's split into categories under a segmented
          control; the tab lives in the URL (#/settings?tab=rates), so other screens can link straight to a part. */}
      <Segmented label={t('settings.title')} value={tab} onChange={(v) => navigate(`/settings?tab=${v}`)}
        options={SETTINGS_TABS.map((k) => [k, t(`settings.tabs.${k}`)])} />

      {tab === 'business' && <>
        <Section title={t('settings.supplier')}>
          <div className="grid grid-cols-6 gap-4 mobile-stack">
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
          <div className="grid grid-cols-6 gap-4 mobile-stack">
            <Field className="col-span-4" label={t('fields.account')} value={s.supplier.bank.account} onChange={(e) => bank({ account: e.target.value })} />
            <Field className="col-span-2" label={t('fields.bankCode')} value={s.supplier.bank.bankCode} onChange={(e) => bank({ bankCode: e.target.value })} />
            <Field className="col-span-4" label={t('fields.iban')} value={s.supplier.bank.iban} onChange={(e) => bank({ iban: e.target.value })} />
            <Field className="col-span-2" label={t('fields.swift')} value={s.supplier.bank.swift} onChange={(e) => bank({ swift: e.target.value })} />
          </div>
        </Section>

        <Section title={t('settings.vat')}>
          <div role="radiogroup" aria-label={t('settings.vat')} className="grid grid-cols-3 gap-3 mobile-stack">
            {(['nonPayer', 'payer', 'identifiedPerson'] as const).map((m) => (
              <Choice key={m} selected={s.vatMode === m} onClick={() => setVatMode(m)} title={t(`vatMode.${m}`)} hint={t(`vatMode.${m}Hint`)} />
            ))}
          </div>
          {s.vatMode === 'payer' && (
            <div className="mt-4 w-48">
              <SelectField label={t('settings.defaultVatRate')} value={String(s.defaultVatRate)} onChange={(v) => update({ defaultVatRate: Number(v) })}
                options={VAT_RATES.map((r) => [String(r), `${r} %`])} />
            </div>
          )}
        </Section>
      </>}
      {tab === 'invoices' && <>
        <Section title={t('settings.defaults')}>
          <div className="grid grid-cols-4 gap-4 mobile-stack">
            <Labeled label={t('settings.dueDays')}>
              <InputAffix unit={t('common.days')} type="number" min={0} value={s.defaults.dueDays} onChange={(e) => defaults({ dueDays: Math.max(0, Number(e.target.value)) })} />
            </Labeled>
            <SelectField label={t('settings.currency')} value={s.defaults.currency} onChange={(v) => defaults({ currency: v })} options={CURRENCIES.map((c) => [c, c])} />
            <SelectField label={t('settings.invoiceLanguage')} value={s.defaults.invoiceLanguage} onChange={(v) => defaults({ invoiceLanguage: v as InvoiceLang })}
              options={INVOICE_LANGS.map((l) => [l, LANG_NAMES[l]])} />
            <SelectField label={t('settings.paymentMethod')} value={s.defaults.paymentMethod} onChange={(v) => defaults({ paymentMethod: v as PaymentMethod })}
              options={PaymentMethod.options.map((m) => [m, t(`editor.method.${m}`)])} />
            <Field className="col-span-2" label={t('settings.pattern')} hint={t('settings.patternHint', { next })} value={s.numbering.pattern}
              inputClassName="font-mono" onChange={(e) => update({ numbering: { ...s.numbering, pattern: e.target.value } })} />
            <Field className="col-span-2" label={t('settings.creditNotePattern')} hint={t('settings.creditNotePatternHint', { next: preview(s.numbering.creditNotePattern) })}
              value={s.numbering.creditNotePattern} inputClassName="font-mono" onChange={(e) => update({ numbering: { ...s.numbering, creditNotePattern: e.target.value } })} />
            <Field className="col-span-2" label={t('settings.proformaPattern')} hint={t('settings.proformaPatternHint', { next: preview(s.numbering.proformaPattern) })}
              value={s.numbering.proformaPattern} inputClassName="font-mono" onChange={(e) => update({ numbering: { ...s.numbering, proformaPattern: e.target.value } })} />
            {s.vatMode === 'payer' && (
              <Field className="col-span-2" label={t('settings.advanceTaxDocPattern')} hint={t('settings.advanceTaxDocPatternHint', { next: preview(s.numbering.advanceTaxDocPattern) })}
                value={s.numbering.advanceTaxDocPattern} inputClassName="font-mono" onChange={(e) => update({ numbering: { ...s.numbering, advanceTaxDocPattern: e.target.value } })} />
            )}
            <Field className="col-span-2" label={t('settings.unit')} value={s.defaults.unit} placeholder="ks, hod…" onChange={(e) => defaults({ unit: e.target.value })} />
            <Field className="col-span-4" label={t('settings.note')} value={s.defaults.note} onChange={(e) => defaults({ note: e.target.value })} />
          </div>
        </Section>

        <Section title={t('priceList.title')}>
          <PriceList settings={s} update={update} />
        </Section>

        <Section title={t('look.title')}>
          <InvoiceLook settings={s} update={update}
            sample={[...invoices].filter((i) => i.status !== 'draft').sort((a, b) => b.issueDate.localeCompare(a.issueDate))[0]} />
        </Section>
      </>}
      {tab === 'emails' && <>
        <Section title={t('settings.emails')}>
          <EmailTemplates settings={s} update={update} />
        </Section>
      </>}
      {tab === 'taxes' && <>
        <Section title={t('taxes.section')}>
          <TaxSettings settings={s} update={update} />
        </Section>
        <Section title={t('opening.title', { year: Number(today().slice(0, 4)) })}>
          <p className="mb-4 max-w-prose text-sm text-fg-muted">{t('opening.settingsHint')}</p>
          <OpeningBalance value={s.opening} year={Number(today().slice(0, 4))} onChange={(opening) => update({ opening })} />
        </Section>
      </>}
      {tab === 'rates' && <>
        <Section title={t('rates.title')}>
          <RatesPanel />
        </Section>
      </>}
      {tab === 'app' && <>
        {/* Single-value settings are rows: text on the left, the control on the right (design system: SettingRow). */}
        <section>
          <h2 className="mb-3 font-display text-2xl font-bold">{t('settings.app')}</h2>
          <Card className="divide-y divide-rule">
            <SettingRow title={t('settings.uiLanguage')}>
              {/* Shows the language on screen, which a ?lang= in the address may have picked; choosing one drops that and saves it. */}
              <Options aria-label={t('settings.uiLanguage')} value={i18n.language === 'en' ? 'en' : 'cs'}
                onChange={(v) => { clearUrlLanguage(); setUiLanguage(v as Lang); update({ ui: { ...s.ui, language: v as Lang } }) }}
                options={[['cs', 'Čeština'], ['en', 'English']]} />
            </SettingRow>
            <SettingRow title={t('settings.theme')}>
              <Options aria-label={t('settings.theme')} value={s.ui.theme} onChange={(v) => update({ ui: { ...s.ui, theme: v as Settings['ui']['theme'] } })}
                options={[['system', t('settings.themeSystem')], ['light', t('settings.themeLight')], ['dark', t('settings.themeDark')]]} />
            </SettingRow>
            <SettingRow title={t('settings.scheme')}>
              <Options aria-label={t('settings.scheme')} value={s.ui.scheme} onChange={(v) => update({ ui: { ...s.ui, scheme: v as Settings['ui']['scheme'] } })}
                options={SCHEMES.map((id) => [id, t(`settings.schemes.${id}`)])} />
            </SettingRow>
            <FolderRow />
            <DemoToggle />
          </Card>
        </section>
        <Section title={t('importHistory.title')}>
          <ImportHistory />
        </Section>
      </>}
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
      await (demo ? exitDemo() : enterDemo('faktury'))
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
