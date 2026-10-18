import { Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { invoiceTotals } from '@/domain/invoice'
import type { RecurringItem } from '@/domain/recurring'
import { useFormat } from '@/ui/format'
import { Card, cn } from '@/ui/primitives'

export const RECURRING_ID = 'recurring-invoices'

const action = 'inline-flex h-8 items-center rounded-lg border border-line bg-surface-2 px-3 text-sm font-medium whitespace-nowrap transition-colors hover:bg-surface-3'

/**
 * This period's regular invoices: who is due (with "Vystavit", the usual copy of the last invoice), who has a draft,
 * who comes later, and who is done. Invojka issues nothing by itself (docs/invoicing-rules.md#regular-invoices).
 */
export function RecurringInvoices({ items, on }: { items: RecurringItem[]; on: string }) {
  const { t } = useTranslation()
  const f = useFormat()
  const month = new Intl.DateTimeFormat(f.lang === 'cs' ? 'cs-CZ' : 'en-GB', { month: 'long', year: 'numeric' }).format(new Date(`${on}T12:00:00`))
  return (
    <section id={RECURRING_ID} className="scroll-mt-24">
      <h2 className="mb-3 font-display text-2xl font-bold">{t('recurring.title', { month })}</h2>
      <Card className="overflow-hidden">
        {items.map(({ customer, state, from, invoice, last }, i) => (
          <div key={customer.id} className={cn('grid grid-cols-[1fr_auto_auto] items-center gap-4 px-6 py-2.5 text-sm', i % 2 === 1 && 'bg-row-hover')}>
            <div className="min-w-0">
              <a href={`#/customers/${customer.id}`} className="block truncate font-medium hover:underline">{customer.name}</a>
              <div className="truncate text-xs text-fg-muted">
                {t(`recurring.every.${customer.recurring!.every}`, { day: customer.recurring!.day })}
                {last && ` · ${t('recurring.last', { amount: f.money(invoiceTotals(last).total, last.currency), date: f.date(last.issueDate) })}`}
              </div>
            </div>
            <span className={cn('text-xs whitespace-nowrap', state === 'due' ? 'font-medium text-fg' : 'text-fg-muted')}>
              {state === 'done' && <Check aria-hidden="true" className="mr-1 inline size-3.5 text-success" />}
              {t(`recurring.state.${state}`, { date: f.date(from), number: invoice?.number })}
            </span>
            {state === 'due' ? <a href={`#/invoices/new?customer=${customer.id}`} className={action}>{t('recurring.issue')}</a>
              : invoice ? <a href={`#/invoices/${invoice.id}`} className={action}>{t(state === 'draft' ? 'recurring.finish' : 'recurring.open')}</a>
              : <span />}
          </div>
        ))}
      </Card>
    </section>
  )
}
