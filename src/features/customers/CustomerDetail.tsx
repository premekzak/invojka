import { Archive, ArchiveRestore, ArrowLeft, FilePlus2, Trash2 } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { newId, today } from '@/domain/id'
import { displayStatus, invoiceTotals, snapshotOf, totalCzk } from '@/domain/invoice'
import { CURRENCIES } from '@/domain/money'
import type { Customer } from '@/domain/schema'
import { useStore } from '@/state/store'
import { StatusBadge, useFormat } from '@/ui/format'
import { Button, Card, Checkbox, Field, Labeled, Select, Textarea } from '@/ui/primitives'
import { navigate, type Route } from '@/ui/router'

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
  const revenue = mine.reduce((s, i) => s + (i.status === 'paid' || i.status === 'issued' ? totalCzk(i) ?? 0 : 0), 0)

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
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => history.back()}><ArrowLeft className="size-4" /></Button>
        <h1 className="font-serif text-4xl leading-[1.2] font-semibold">{saved ? saved.name : t('customers.newTitle')}</h1>
        {c.archived && <span className="rounded bg-surface-3 px-2 py-0.5 text-xs text-fg-muted">{t('customers.archived')}</span>}
        <div className="ml-auto flex gap-2">
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
          {saved && (
            <Button variant="secondary" onClick={() => navigate(`/invoices/new?customer=${c.id}`)}>
              <FilePlus2 className="size-4" /> {t('customers.newInvoice')}
            </Button>
          )}
          <Button disabled={!dirty} onClick={trySave}>{t('common.save')}</Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-10">
          <section>
            <h2 className="mb-3 font-serif text-2xl font-semibold">{t('customers.details')}</h2>
            <Card className="p-5">
              <div className="grid grid-cols-6 gap-4">
                <Field className="col-span-6" id="customer-name" label={t('fields.name')} required error={showErrors ? nameError : undefined}
                  value={c.name} autoFocus={isNew} onChange={(e) => set({ name: e.target.value })} onBlur={() => setShowErrors(true)} />
                <Field className="col-span-3" label={t('fields.ic')} value={c.ic} onChange={(e) => set({ ic: e.target.value.replace(/\s/g, '') })} />
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
            <h2 className="mb-3 font-serif text-2xl font-semibold">{t('customers.invoiceDefaults')}</h2>
            <Card className="p-5">
              <div className="grid grid-cols-6 items-end gap-4">
                <div className="col-span-2">
                  <Sel label={t('editor.currency')} value={c.defaultCurrency ?? ''} onChange={(v) => set({ defaultCurrency: v || undefined })}>
                    <option value="">{t('customers.fromSettings')}</option>
                    {CURRENCIES.map((x) => <option key={x}>{x}</option>)}
                  </Sel>
                </div>
                <div className="col-span-2">
                  <Sel label={t('editor.language')} value={c.defaultLanguage ?? ''} onChange={(v) => set({ defaultLanguage: (v || undefined) as Customer['defaultLanguage'] })}>
                    <option value="">{t('customers.fromSettings')}</option>
                    <option value="cs">Čeština</option>
                    <option value="en">English</option>
                  </Sel>
                </div>
                <Checkbox className="col-span-2 h-10 items-center" label={t('editor.reverseCharge')} checked={c.reverseCharge}
                  onChange={(e) => set({ reverseCharge: e.target.checked })} />
              </div>
              <Labeled className="mt-4" label={t('customers.note')}>
                <Textarea value={c.note} onChange={(e) => set({ note: e.target.value })} />
              </Labeled>
            </Card>
          </section>
        </div>

        <section>
          <h2 className="mb-3 font-serif text-2xl font-semibold">{t('invoices.title')}</h2>
          <div className="space-y-5">
            <Card className="grid grid-cols-2 gap-4 p-5">
              <div>
                <div className="text-xs text-fg-muted">{t('customers.invoiceCount')}</div>
                <div className="text-2xl font-semibold tabular-nums">{mine.length}</div>
              </div>
              <div>
                <div className="text-xs text-fg-muted">{t('customers.revenue')}</div>
                <div className="text-2xl font-semibold tabular-nums">{f.money(revenue)}</div>
              </div>
            </Card>
            {mine.length > 0 && (
              <Card className="divide-y divide-line">
                {mine.slice(0, 12).map((inv) => (
                  <a key={inv.id} href={`#/invoices/${inv.id}`} className="flex items-center gap-3 px-5 py-3 text-sm transition-colors hover:bg-surface-2">
                    <span className="tabular-nums text-xs text-fg-muted">{inv.number}</span>
                    <span className="flex-1 text-right tabular-nums">{f.money(invoiceTotals(inv).total, inv.currency)}</span>
                    <StatusBadge status={displayStatus(inv, today())} />
                  </a>
                ))}
                {mine.length > 12 && (
                  <a href={`#/invoices?customer=${c.id}`} className="block px-5 py-3 text-center text-sm text-accent underline underline-offset-2 decoration-line-strong hover:decoration-current">{t('home.all')}</a>
                )}
              </Card>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
