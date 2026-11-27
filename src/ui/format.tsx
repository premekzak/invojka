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

/**
 * An amount in a table column: the figure carries the weight and the currency is quieter (the number first, its label
 * second), so a column of amounts reads as numbers. The text is the same as `money()` gives, only split at the digits.
 */
export function Money({ minor, currency = 'CZK', className }: { minor: number; currency?: string; className?: string }) {
  const text = useFormat().money(minor, currency)
  const first = text.search(/\d/), last = text.length - [...text].reverse().join('').search(/\d/)
  // A minus sign belongs to the figure, whichever side of the currency the locale puts it on.
  const sign = /^[-−]/.test(text) ? text[0] : ''
  const unit = 'font-normal text-fg-muted'
  return (
    <span className={cn('font-semibold whitespace-nowrap tabular-nums', className)}>
      {sign}<span className={unit}>{text.slice(sign.length, first)}</span>{text.slice(first, last)}<span className={unit}>{text.slice(last)}</span>
    </span>
  )
}

export function StatusBadge({ status }: { status: DisplayStatus }) {
  const { t } = useTranslation()
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-xs font-medium whitespace-nowrap', statusCls[status].label)}>
      <span aria-hidden="true" className={cn('size-1.5 shrink-0 rounded-full', statusCls[status].dot)} />
      {t(`status.${status}`)}
    </span>
  )
}
