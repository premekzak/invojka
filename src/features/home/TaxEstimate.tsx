import { useMemo } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import type { Invoice, Settings } from '@/domain/schema'
import { cashIncome, checkFlatBand, estimate, flatBandLimits, flatTaxBand, flatTaxMonthly, projectYear, RATES } from '@/domain/taxes'
import { useFormat } from '@/ui/format'
import { Card, cn } from '@/ui/primitives'

type Part = { label: string; value: number; color: string }

const SIZE = 280
const R = 115
const STROKE = 34
const C = 2 * Math.PI * R
const GAP = 2

/**
 * Where the income goes: tax, social and health as coloured arcs, what's left as the bare track (the owner asked for a pie
 * here, 2026-10-18). Scaled to the income, or to the payments when they exceed it. The rows beside it are the legend.
 */
function TaxDonut({ parts, base, center, label }: { parts: Part[]; base: number; center: React.ReactNode; label: string }) {
  let at = 0
  return (
    <figure className="relative size-76 max-w-full shrink-0">
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="size-full -rotate-90" role="img" aria-label={label}>
        <circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" strokeWidth={STROKE} className="stroke-surface-3" />
        {base > 0 && parts.filter((p) => p.value > 0).map((p) => {
          const len = (p.value / base) * C
          const arc = (
            <circle key={p.label} cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" strokeWidth={STROKE} stroke={p.color}
              strokeDasharray={`${Math.max(len - GAP, 0.5)} ${C}`} strokeDashoffset={-at}>
              <title>{p.label}</title>
            </circle>
          )
          at += len
          return arc
        })}
      </svg>
      <figcaption className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 px-12 text-center">{center}</figcaption>
    </figure>
  )
}

export const TAX_ESTIMATE_ID = 'tax-estimate'

/**
 * This year's tax and insurance as a sole trader would owe them for the whole year at the pace so far (like Fakturoid's
 * "Průběžný výpočet odvodů"). With flat-rate expenses it compares the flat-rate tax; in the flat-rate tax regime it shows
 * the fixed payments, whether the income fits the band, and compares an ordinary tax return. An estimate, and says so.
 */
export function TaxEstimate({ invoices, settings, on }: { invoices: Invoice[]; settings: Settings; on: string }) {
  const { t } = useTranslation()
  const f = useFormat()
  const year = Number(on.slice(0, 4))
  const rates = RATES[year]
  const rate = settings.taxes.expenseRate
  const data = useMemo(() => {
    const { income, missingRate } = cashIncome(invoices, year, settings.opening)
    const projected = projectYear(income, on)
    const { activity, taxpayerCredit } = settings.taxes
    // The main activity always claims the allowance here; a secondary one only when the user says so.
    const opts = { activity, taxpayerCredit: activity === 'main' || taxpayerCredit }
    return { income, missingRate, projected, est: rates && estimate(projected, rate, rates, opts) }
  }, [invoices, year, on, rate, rates, settings.taxes, settings.opening])
  const kc = (n: number) => f.moneyWhole(n * 100)
  const b = <strong className="font-semibold text-fg tabular-nums" />

  if (!rates || !data.est) {
    return <Card className="px-6 py-5 text-sm text-fg-muted">{t('taxes.noRates', { year })}</Card>
  }
  const { est } = data
  const nonPayer = settings.vatMode === 'nonPayer'
  // The flat-rate tax regime is only for non-payers of VAT; a payer who chose it gets the ordinary estimate and a note.
  const flatRegime = settings.taxes.regime === 'flat' && nonPayer
  const myBand = settings.taxes.flatBand
  const split = rates.flatTax[myBand - 1]!
  const check = flatRegime ? checkFlatBand(data.projected, myBand, rate, rates) : undefined
  // With flat-rate expenses: the band this income would fall into, to compare.
  const band = nonPayer && !flatRegime ? flatTaxBand(data.projected, rate) : undefined
  const flat = band && flatTaxMonthly(rates, band) * 12
  const paid = flatRegime ? { tax: split.tax * 12, social: split.social * 12, health: split.health * 12 } : est
  const total = paid.tax + paid.social + paid.health
  const rows: [string, number, string?][] = [
    [t('taxes.income'), est.income],
    ...(flatRegime ? [] : [[t('taxes.expenses', { rate }), -est.expenses] as [string, number]]),
    [t('taxes.tax'), paid.tax, 'var(--color-cat-1)'],
    [t('taxes.social'), paid.social, 'var(--color-cat-2)'],
    [t('taxes.health'), paid.health, 'var(--color-cat-3)'],
  ]
  const left = est.income - total
  // What the flat-rate tax really costs for this income: the band it fits, after the notice and the difference paid back
  // or refunded. Over 2 M Kč there's nothing to compare: the regime ends and they file a tax return.
  const flatTotal = check && 'diff' in check ? total + (check.state === 'higher' ? check.diff : -check.diff) : total
  const base = Math.max(est.income, total)
  const pct = (n: number) => (base > 0 ? Math.round((n / base) * 100) : 0)
  const parts: Part[] = rows.filter((r) => r[2]).map(([label, value, color]) => ({ label: `${label}: ${kc(value)} (${pct(value)} %)`, value, color: color! }))
  const marker = (color: string) => <span aria-hidden="true" className="mr-2 inline-block size-2.5 rounded-sm align-baseline" style={{ background: color }} />
  return (
    <Card className="px-6 py-5">
      <div id={TAX_ESTIMATE_ID} className="flex scroll-mt-24 items-baseline justify-between gap-4">
        <h2 className="font-medium">{t('taxes.title', { year })}</h2>
        <a href="#/settings?tab=taxes" className="text-xs text-link underline underline-offset-2 decoration-line-strong hover:decoration-current">
          {flatRegime ? t('taxes.settingsFlat', { band: myBand })
            : <>{t(`taxes.activities.${settings.taxes.activity}`)} · {t('taxes.settings', { rate })}</>}
        </a>
      </div>
      {/* Text and rows on the left, the donut centred in the right half (the owner: "plenty of room on the right"). */}
      <div className="grid items-center gap-x-10 gap-y-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div>
          <p className="mt-1 max-w-prose text-sm text-fg-muted">
            {flatRegime && <><Trans i18nKey="taxes.flatMonthly" values={{ band: myBand, amount: kc(flatTaxMonthly(rates, myBand)) }} components={{ b }} /> </>}
            <Trans i18nKey="taxes.pace" values={{ income: kc(data.income), projected: kc(data.projected) }} components={{ b }} />
          </p>
          <dl className="mt-4 grid max-w-md grid-cols-[1fr_auto] gap-x-6 gap-y-1.5 text-sm">
            {rows.map(([label, value, color]) => (
              <div key={label} className="contents">
                <dt className="text-fg-muted">{color ? marker(color) : <span className="mr-2 inline-block w-2.5" />}{label}</dt>
                <dd className="text-right tabular-nums">{kc(value)}</dd>
              </div>
            ))}
            <dt className="border-t border-line pt-1.5 font-semibold"><span className="mr-2 inline-block w-2.5" />{t(flatRegime ? 'taxes.totalFlat' : 'taxes.total')}</dt>
            <dd className="border-t border-line pt-1.5 text-right font-semibold tabular-nums">{kc(total)}</dd>
            <dt className="text-fg-muted">{marker('var(--color-surface-3)')}{t('taxes.left')}</dt>
            <dd className="text-right tabular-nums">{kc(Math.max(left, 0))}</dd>
          </dl>
          {!flatRegime && settings.taxes.activity === 'secondary' && (
            <p className="mt-3 max-w-prose text-xs text-fg-muted">
              {est.social === 0 ? t('taxes.secondaryNoSocial', { limit: kc(rates.secondaryThreshold) }) : t('taxes.secondarySocial', { limit: kc(rates.secondaryThreshold) })}
              {' '}{t('taxes.secondaryHealth')}
            </p>
          )}
          {check && (
            <p className={cn('mt-4 max-w-prose text-sm', (check.state === 'higher' || check.state === 'out') && 'text-warning')}>
              <Trans i18nKey={`taxes.band_${check.state}`} components={{ b }} values={{
                band: myBand, limit: kc(flatBandLimits(rate)[myBand - 1]!), year, next: year + 1,
                newBand: 'band' in check ? check.band : undefined, diff: 'diff' in check ? kc(check.diff) : undefined,
              }} />
            </p>
          )}
          {check && check.state !== 'out' && (
            <p className="mt-3 max-w-prose text-sm">
              <Trans i18nKey={est.total < flatTotal ? 'taxes.standardCheaper' : 'taxes.standardDearer'}
                values={{ rate, amount: kc(est.total), diff: kc(Math.abs(est.total - flatTotal)) }} components={{ b }} />
            </p>
          )}
          {settings.taxes.regime === 'flat' && !nonPayer && <p className="mt-4 max-w-prose text-sm">{t('taxes.flatPayer')}</p>}
          {nonPayer && !flatRegime && (
            <p className="mt-4 max-w-prose text-sm">
              {flat
                ? <Trans i18nKey={flat < est.total ? 'taxes.flatCheaper' : 'taxes.flatDearer'}
                    values={{ band, amount: kc(flat), diff: kc(Math.abs(est.total - flat)) }} components={{ b }} />
                : t('taxes.flatOver')}
              {flat && settings.taxes.activity === 'secondary' && <span className="text-fg-muted"> {t('taxes.flatSecondary')}</span>}
            </p>
          )}
          <p className="mt-3 max-w-prose text-xs text-fg-muted">
            {t(flatRegime ? 'taxes.disclaimerFlat' : 'taxes.disclaimer', { year })}
            {settings.opening.year === year && settings.opening.income > 0 && <> {t('taxes.opening', { amount: f.moneyWhole(settings.opening.income) })}</>}
            {data.missingRate > 0 && <> {t('taxes.missingRate', { count: data.missingRate })}</>}
          </p>
        </div>
        <div className="flex justify-center md:justify-end md:pr-6">
          <TaxDonut parts={parts} base={base} label={t('taxes.chart')}
            center={left >= 0
              ? <>
                  <span className="text-xs text-fg-muted">{t('taxes.left')}</span>
                  <span className="text-2xl font-semibold tabular-nums">{kc(left)}</span>
                  <span className="text-xs text-fg-muted">{t('taxes.leftShare', { pct: pct(left) })}</span>
                </>
              : <span className="text-sm font-medium text-fg-muted">{t('taxes.overIncome')}</span>} />
        </div>
      </div>
    </Card>
  )
}
