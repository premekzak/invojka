import { Archive, ArchiveRestore, FilePlus2, Trash2 } from 'lucide-react'
import { BackButton } from '@/ui/BackButton'
import { useMemo, useState, type ReactNode } from 'react'
import { aresByIc, normalizeIc, type AresParty } from '@/ares/ares'
import { useTranslation } from 'react-i18next'
import { newId, today } from '@/domain/id'
import { displayStatus, invoiceTotals, snapshotOf } from '@/domain/invoice'
import { INVOICE_LANGS, LANG_NAMES } from '@/domain/language'
import { CURRENCIES } from '@/domain/money'
import type { Customer } from '@/domain/schema'
import { customerStats, emptyCustomerStats, type CustomerStats } from '@/domain/stats'
import { useStore } from '@/state/store'
import { RevenueCharts } from '@/features/home/RevenueCharts'
import { StatusBadge, useFormat } from '@/ui/format'
import { Button, Card, Checkbox, cn, Field, Labeled, Select, Textarea } from '@/ui/primitives'
import { navigate, type Route } from '@/ui/router'
import { AresLookup } from './AresLookup'

/** What a customer paid: CZK, plus any amount without an exchange rate in its own currency ("8 500 Kč + 1 500 NZ$"). */
export function formatPaid(f: ReturnType<typeof useFormat>, s: CustomerStats): string {
  const foreign = Object.entries(s.paidUnconverted).map(([cur, v]) => f.money(v, cur))
  return [...(s.paid || !foreign.length ? [f.money(s.paid)] : []), ...foreign].join(' + ')
}

export const emptyCustomer = (name = ''): Customer => ({
  id: newId(), name, ic: '', dic: '', address: { street: '', zip: '', city: '', country: '' },
  email: '', cc: [], phone: '', web: '', contactName: '', reverseCharge: false, note: '', archived: false,
})

function Sel({ label, children, value, onChange }: { label: string; children: ReactNode; value: string; onChange: (v: string) => void }) {
  return (
    <Labeled label={label}>
      <Select value={value} onChange={(e) => onChange(e.target.value)}>{children}</Select>
    </Labeled>
  )
}

export function CustomerDetail({ route }: { route: Route }) {
  const { t } = useTranslation()
  const id = route.path[1]
  const [initial] = useState(() => (id === 'new' ? emptyCustomer() : useStore.getState().customers.find((c) => c.id === id)))
  if (!initial) return <p className="text-fg-muted">{t('customers.notFound')}</p>
  return <CustomerForm initial={initial} isNew={id === 'new'} />
}

function CustomerForm({ initial, isNew }: { initial: Customer; isNew: boolean }) {
  const { t } = useTranslation()
  const f = useFormat()
  const { invoices, upsertCustomer, removeCustomer, upsertInvoice } = useStore()
  const [c, setC] = useState(initial)
  const [saved, setSaved] = useState(isNew ? undefined : initial)
  const set = (patch: Partial<Customer>) => setC((x) => ({ ...x, ...patch }))
  const addr = (patch: Partial<Customer['address']>) => set({ address: { ...c.address, ...patch } })
  const dirty = !saved || JSON.stringify(c) !== JSON.stringify(saved)
  // Errors show after leaving the field or pressing Save, and clear as soon as the value is right.
  const [showErrors, setShowErrors] = useState(false)
  const nameError = c.name.trim() ? undefined : t('validation.name')

  const mine = useMemo(
    () => invoices.filter((i) => i.customerId === c.id).sort((a, b) => b.issueDate.localeCompare(a.issueDate)),
    [invoices, c.id],
  )
  const stats = useMemo(() => customerStats(invoices).get(c.id) ?? emptyCustomerStats(), [invoices, c.id])

  // ARES: a new customer starts with the lookup box; a saved one with an IČ can reload its details.
  const [aresNote, setAresNote] = useState<{ text: string; ok: boolean }>()
  const fromAres = (p: AresParty) => {
    set({ name: p.name, ic: p.ic, dic: p.dic, address: p.address })
    setAresNote({ text: t('ares.filled'), ok: true })
  }
  const validIc = normalizeIc(c.ic)
  async function reloadFromAres() {
    try {
      const p = await aresByIc(validIc!)
      if (p) fromAres(p)
      else setAresNote({ text: t('ares.notFound', { ic: validIc }), ok: false })
    } catch {
      setAresNote({ text: t('ares.error'), ok: false })
    }
  }

  function save(next: Partial<Customer> = {}) {
    const cust = { ...c, ...next, name: c.name.trim() }
    upsertCustomer(cust)
    // Drafts follow the customer's current details; issued invoices keep the snapshot they were issued with.
    for (const inv of mine) if (inv.status === 'draft') upsertInvoice({ ...inv, customerSnapshot: snapshotOf(cust) })
    setC(cust)
    setSaved(cust)
    if (!saved) history.replaceState(null, '', `#/customers/${cust.id}`)
  }

  function trySave() {
    if (nameError) {
      setShowErrors(true)
      document.getElementById('customer-name')?.focus()
      return
    }
    save()
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="relative flex items-center gap-3">
          <BackButton />
          <h1 className="font-display text-4xl leading-[1.2] font-bold tracking-[-0.01em]">{saved ? saved.name : t('customers.newTitle')}</h1>
        </div>
        {c.archived && <span className="rounded bg-surface-3 px-2 py-0.5 text-xs text-fg-muted">{t('customers.archived')}</span>}
        <div className="ml-auto flex flex-wrap justify-end gap-2">
          <Button disabled={!dirty} onClick={trySave}>{t('common.save')}</Button>
          {saved && (
            <Button variant="secondary" onClick={() => navigate(`/invoices/new?customer=${c.id}`)}>
              <FilePlus2 className="size-4" /> {t('customers.newInvoice')}
            </Button>
          )}
          {saved && mine.length === 0 && (
            <Button variant="ghost" onClick={() => { removeCustomer(c.id); navigate('/customers') }}>
              <Trash2 className="size-4" /> {t('editor.delete')}
            </Button>
          )}
          {saved && mine.length > 0 && (
            <Button variant="ghost" onClick={() => save({ archived: !c.archived })} title={t('customers.archiveHint')}>
              {c.archived ? <ArchiveRestore className="size-4" /> : <Archive className="size-4" />}
              {c.archived ? t('customers.unarchive') : t('customers.archive')}
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6 mobile-stack">
        <div className="col-span-2 space-y-10">
          <section>
            <h2 className="mb-3 font-display text-2xl font-bold">{t('customers.details')}</h2>
            <Card className="px-6 py-5">
              <div className="grid grid-cols-6 gap-4 mobile-stack">
                {!saved && <AresLookup className="col-span-6" autoFocus={!c.name} onPick={fromAres} />}
                {aresNote && <p role="status" className={cn('col-span-6 -mt-1 text-xs font-medium', aresNote.ok ? 'text-success' : 'text-fg-muted')}>{aresNote.text}</p>}
                <Field className="col-span-6" id="customer-name" label={t('fields.name')} required error={showErrors ? nameError : undefined}
                  value={c.name} onChange={(e) => set({ name: e.target.value })} onBlur={() => setShowErrors(true)} />
                <Field className="col-span-3" label={t('fields.ic')} value={c.ic} onChange={(e) => set({ ic: e.target.value.replace(/\s/g, '') })}
                  hint={saved && validIc ? (
                    <button type="button" onClick={() => void reloadFromAres()}
                      className="font-medium text-link underline underline-offset-2 decoration-line-strong hover:decoration-current">{t('ares.refresh')}</button>
                  ) : undefined} />
                <Field className="col-span-3" label={t('fields.dic')} value={c.dic} onChange={(e) => set({ dic: e.target.value.replace(/\s/g, '').toUpperCase() })} />
                <Field className="col-span-6" label={t('fields.street')} value={c.address.street} onChange={(e) => addr({ street: e.target.value })} />
                <Field className="col-span-2" label={t('fields.zip')} value={c.address.zip} onChange={(e) => addr({ zip: e.target.value })} />
                <Field className="col-span-2" label={t('fields.city')} value={c.address.city} onChange={(e) => addr({ city: e.target.value })} />
                <Field className="col-span-2" label={t('fields.country')} value={c.address.country} onChange={(e) => addr({ country: e.target.value })} />
                <Field className="col-span-3" label={t('fields.email')} type="email" value={c.email} onChange={(e) => set({ email: e.target.value })} />
                <Field className="col-span-3" label={t('customers.cc')} hint={t('customers.ccHint')} value={c.cc.join(', ')}
                  onChange={(e) => set({ cc: e.target.value.split(/[,;]\s*/).filter(Boolean) })} />
                <Field className="col-span-2" label={t('customers.contactName')} value={c.contactName} onChange={(e) => set({ contactName: e.target.value })} />
                <Field className="col-span-2" label={t('fields.phone')} value={c.phone} onChange={(e) => set({ phone: e.target.value })} />
                <Field className="col-span-2" label={t('fields.web')} value={c.web} onChange={(e) => set({ web: e.target.value })} />
              </div>
            </Card>
          </section>
          <section>
            <h2 className="mb-3 font-display text-2xl font-bold">{t('customers.invoiceDefaults')}</h2>
            <Card className="px-6 py-5">
              <div className="grid grid-cols-6 items-end gap-4 mobile-stack">
                <div className="col-span-2">
                  <Sel label={t('editor.currency')} value={c.defaultCurrency ?? ''} onChange={(v) => set({ defaultCurrency: v || undefined })}>
                    <option value="">{t('customers.fromSettings')}</option>
                    {CURRENCIES.map((x) => <option key={x}>{x}</option>)}
                  </Sel>
                </div>
                <div className="col-span-2">
                  <Sel label={t('editor.language')} value={c.defaultLanguage ?? ''} onChange={(v) => set({ defaultLanguage: (v || undefined) as Customer['defaultLanguage'] })}>
                    <option value="">{t('customers.fromSettings')}</option>
                    {INVOICE_LANGS.map((l) => <option key={l} value={l}>{LANG_NAMES[l]}</option>)}
                  </Sel>
                </div>
                <Checkbox className="col-span-2 h-10 items-center" label={t('editor.reverseCharge')} checked={c.reverseCharge}
                  onChange={(e) => set({ reverseCharge: e.target.checked })} />
              </div>
              {/* Regular invoicing: Home then lists this customer as due each period (domain/recurring.ts). */}
              <div className="mt-4 grid grid-cols-6 items-end gap-4 mobile-stack">
                <Checkbox className="col-span-2 h-10 items-center" label={t('recurring.enable')} checked={!!c.recurring}
                  onChange={(e) => set({ recurring: e.target.checked ? { every: 'month', day: 1 } : undefined })} />
                {c.recurring && (
                  <>
                    <div className="col-span-2">
                      <Sel label={t('recurring.everyLabel')} value={c.recurring.every} onChange={(v) => set({ recurring: { ...c.recurring!, every: v as 'month' | 'quarter' | 'year' } })}>
                        <option value="month">{t('recurring.everyOption.month')}</option>
                        <option value="quarter">{t('recurring.everyOption.quarter')}</option>
                        <option value="year">{t('recurring.everyOption.year')}</option>
                      </Sel>
                    </div>
                    <div className="col-span-2">
                      <Sel label={t('recurring.dayLabel')} value={String(c.recurring.day)} onChange={(v) => set({ recurring: { ...c.recurring!, day: Number(v) } })}>
                        {Array.from({ length: 28 }, (_, i) => <option key={i + 1} value={i + 1}>{t('recurring.dayOption', { day: i + 1 })}</option>)}
                      </Sel>
                    </div>
                  </>
                )}
              </div>
              {c.recurring && <p className="mt-1.5 max-w-prose text-xs text-fg-muted">{t('recurring.enableHint')}</p>}
              <Labeled className="mt-4" label={t('customers.note')}>
                <Textarea value={c.note} onChange={(e) => set({ note: e.target.value })} />
              </Labeled>
            </Card>
          </section>
        </div>

        <section>
          <h2 className="mb-3 font-display text-2xl font-bold">{t('invoices.title')}</h2>
          <div className="space-y-5">
            {/* One figure per row: side by side, an amount like 1 000 000,00 Kč overflowed the narrow column. */}
            <Card className="space-y-4 px-6 py-5">
              <div>
                <div className="text-xs text-fg-muted">{t('customers.paidCount')}</div>
                <div className="text-2xl font-semibold tabular-nums">{stats.paidCount}</div>
                <div className="text-xs text-fg-muted">{t('customers.issuedTotal', { count: stats.count })}</div>
              </div>
              <div className="min-w-0">
                <div className="text-xs text-fg-muted">{t('customers.paid')}</div>
                <div className="text-2xl font-semibold tabular-nums">{formatPaid(f, stats)}</div>
              </div>
            </Card>
            {mine.length > 0 && (
              <Card className="overflow-hidden [&>a:nth-child(even)]:bg-row-hover">
                {mine.slice(0, 12).map((inv) => (
                  <a key={inv.id} href={`#/invoices/${inv.id}`} className="flex items-center gap-3 px-6 py-3 text-sm transition-colors hover:bg-tint!">
                    <span className="tabular-nums text-xs text-fg-muted">{inv.number}</span>
                    <span className="flex-1 text-right tabular-nums">{f.money(invoiceTotals(inv).total, inv.currency)}</span>
                    <StatusBadge status={displayStatus(inv, today())} />
                  </a>
                ))}
                {mine.length > 12 && (
                  <a href={`#/invoices?customer=${c.id}`} className="block px-6 py-3 text-center text-sm text-link underline underline-offset-2 decoration-line-strong hover:decoration-current">{t('home.all')}</a>
                )}
              </Card>
            )}
          </div>
        </section>
      </div>

      {/* The Home charts narrowed to this customer; the statistics page has the tables, quarters and CSV. */}
      {saved && stats.count > 0 && (
        <div className="space-y-3 pt-4">
          <RevenueCharts today={today()} invoices={mine} />
          <a href={`#/stats?customer=${encodeURIComponent(c.id)}`} className="inline-block text-sm font-medium text-link underline underline-offset-2 decoration-line-strong hover:decoration-current">{t('customers.moreStats')}</a>
        </div>
      )}
    </div>
  )
}
