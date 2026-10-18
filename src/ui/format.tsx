import { format, parseISO } from 'date-fns'
import { useTranslation } from 'react-i18next'
import type { DisplayStatus } from '@/domain/invoice'
import { formatMoney } from '@/domain/money'
import { cn } from './primitives'

export function useFormat() {
  const { i18n } = useTranslation()
  const lang = i18n.language === 'cs' ? 'cs' : 'en'
  return {
    lang,
    date: (iso: string | undefined) => (iso ? format(parseISO(iso), lang === 'cs' ? 'd. M. yyyy' : 'd MMM yyyy') : ''),
    money: (minor: number, currency = 'CZK') => formatMoney(minor, currency, lang),
    /** Rounded to whole units, for running text ("164 500 Kč"). */
    moneyWhole: (minor: number, currency = 'CZK') => formatMoney(minor, currency, lang, true),
  }
}

// Every status is the same soft rounded label with a dot (the owner's choice "T-C", 2026-10-17). Status labels aren't
// clickable, so none uses the accent. The dot also works in grayscale: hollow for a draft, filled otherwise, and the
// words always say it.
const statusCls: Record<DisplayStatus, { label: string; dot: string }> = {
  draft: { label: 'bg-surface-2 text-fg-muted', dot: 'ring-[1.5px] ring-inset ring-line-strong' },
  issued: { label: 'bg-surface-2 text-fg', dot: 'bg-line-strong' },
  overdue: { label: 'bg-warning-chip text-warning-chip-fg', dot: 'bg-warning' },
  paid: { label: 'bg-success-chip text-success', dot: 'bg-success' },
  cancelled: { label: 'bg-surface-2 text-fg-subtle line-through', dot: 'bg-fg-subtle' },
  // Written off: done with, like cancelled, but not struck through, because it still counts.
  uncollectible: { label: 'bg-surface-2 text-fg-muted', dot: 'bg-fg-subtle' },
}

export function StatusBadge({ status }: { status: DisplayStatus }) {
  const { t } = useTranslation()
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-[12px] px-2.5 py-0.5 text-xs font-medium whitespace-nowrap', statusCls[status].label)}>
      <span aria-hidden="true" className={cn('size-1.5 shrink-0 rounded-full', statusCls[status].dot)} />
      {t(`status.${status}`)}
    </span>
  )
}
