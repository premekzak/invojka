import { format, parseISO } from 'date-fns'
import { Check } from 'lucide-react'
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

// Status labels aren't clickable, so none uses the accent. Draft is a dashed outline (unfinished), issued a solid one.
const statusCls: Record<DisplayStatus, string> = {
  draft: 'border-dashed border-line-strong text-fg-muted',
  issued: 'border-line-strong text-fg',
  overdue: 'bg-warning-chip text-warning-chip-fg',
  // Green text with a check, not a chip (the owner's choice 2026-10-11): calm on a list that is mostly paid, and the icon
  // keeps it apart from the pale red Overdue chip in grayscale.
  paid: 'gap-1 px-0 text-success',
  cancelled: 'px-0 text-fg-subtle line-through',
}

export function StatusBadge({ status }: { status: DisplayStatus }) {
  const { t } = useTranslation()
  return (
    <span className={cn('inline-flex items-center rounded border border-transparent px-2 py-0.5 text-xs font-medium whitespace-nowrap', statusCls[status])}>
      {status === 'paid' && <Check aria-hidden="true" className="size-3.5" strokeWidth={2.5} />}
      {t(`status.${status}`)}
    </span>
  )
}
