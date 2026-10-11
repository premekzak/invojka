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

const statusCls: Record<DisplayStatus, string> = {
  draft: 'text-fg-muted ring-1 ring-inset ring-line',
  issued: 'text-accent ring-1 ring-inset ring-accent',
  overdue: 'bg-warning-chip text-warning-chip-fg',
  paid: 'px-0 text-fg-muted',
  cancelled: 'px-0 text-fg-subtle line-through',
}

export function StatusBadge({ status }: { status: DisplayStatus }) {
  const { t } = useTranslation()
  return (
    <span className={cn('inline-flex items-center rounded px-2 py-0.5 text-xs font-medium whitespace-nowrap', statusCls[status])}>
      {t(`status.${status}`)}
    </span>
  )
}
