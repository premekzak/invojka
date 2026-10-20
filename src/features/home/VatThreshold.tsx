import { Trans, useTranslation } from 'react-i18next'
import { VAT_LIMIT, VAT_LIMIT_IMMEDIATE, vatThresholdLevel, type VatTurnover } from '@/domain/vatThreshold'
import { useFormat } from '@/ui/format'
import { Card, cn } from '@/ui/primitives'

export const VAT_THRESHOLD_ID = 'vat-threshold'

/**
 * This year's turnover against the VAT registration limit, for non-payers only (like Fakturoid's statistics). In the
 * flat-rate tax regime, near the limit it also says that becoming a VAT payer ends the regime. `opening` is the part of
 * the turnover invoiced before Invojka (CZK minor units), said in the note.
 */
export function VatThreshold({ turnover, flatTax, opening = 0 }: { turnover: VatTurnover; flatTax?: boolean; opening?: number }) {
  const { t } = useTranslation()
  const f = useFormat()
  const level = vatThresholdLevel(turnover.domestic)
  const pct = Math.floor((turnover.domestic / VAT_LIMIT) * 100)
  const b = <strong className="font-semibold text-fg" />
  const { missingRate } = turnover
  return (
    <Card className="px-6 py-5">
      <div id={VAT_THRESHOLD_ID} className="flex scroll-mt-24 items-baseline justify-between gap-4">
        <h2 className="font-medium">{t('vat.title')}</h2>
        <span className="text-sm tabular-nums text-fg-muted">
          <Trans i18nKey="vat.progress" values={{ amount: f.moneyWhole(turnover.domestic), limit: f.moneyWhole(VAT_LIMIT), pct }} components={{ b }} />
        </span>
      </div>
      <div role="meter" aria-label={t('vat.title')} aria-valuemin={0} aria-valuemax={VAT_LIMIT / 100} aria-valuenow={Math.round(turnover.domestic / 100)}
        className="mt-3 h-2 overflow-hidden rounded-full bg-surface-3">
        <div className={cn('h-full rounded-full', level === 'ok' ? 'bg-series-1' : 'bg-warning')} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
      <p className="mt-3 max-w-prose text-xs text-fg-muted">
        {t(level === 'ok' || level === 'near' ? 'vat.hint' : level === 'over' ? 'vat.hintOver' : 'vat.hintOverImmediate',
          { limit: f.moneyWhole(VAT_LIMIT), immediate: f.moneyWhole(VAT_LIMIT_IMMEDIATE) })}
        {flatTax && level !== 'ok' && <> {t('vat.flatTax')}</>}
        {opening > 0 && <> {t('vat.opening', { amount: f.moneyWhole(opening) })}</>}
        {turnover.foreign > 0 && <> {t('vat.foreign', { amount: f.moneyWhole(turnover.foreign) })}</>}
        {missingRate.count > 0 && <> {t('home.missingRate', { count: missingRate.count, currencies: missingRate.currencies.join(', ') })}</>}
        {' '}{t('vat.estimate')}
      </p>
    </Card>
  )
}
