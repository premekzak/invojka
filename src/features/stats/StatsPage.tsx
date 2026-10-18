import { ChevronLeft, ChevronRight, Download } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { csvAmount, csvTable } from '@/domain/accounting'
import { today } from '@/domain/id'
import { debtors, periodStats, revenueByCurrency, topCustomers, yearStats, type StatsBasis, type StatsGrain } from '@/domain/stats'
import { downloadBlob } from '@/features/invoices/PdfPreview'
import { useStore } from '@/state/store'
import { BarChart } from '@/ui/BarChart'
import { useFormat } from '@/ui/format'
import { Button, Card, Select, cn } from '@/ui/primitives'

/** What the revenue section shows: one year by month or by quarter, or every year (the owner's choice, 2026-10-18). */
type View = StatsGrain | 'years'

const pct = (a: number, b: number) => (b ? `${a >= b ? '+' : ''}${Math.round(((a - b) / b) * 100)} %` : '–')
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)

/** A segmented control, the same as the invoice list's status filter: the chosen part is a white segment on a tinted track. */
function Segmented<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex gap-0.5 rounded-2xl bg-surface-3 p-[3px] dark:bg-surface-2">
      {options.map(([v, text]) => (
        <button key={v} type="button" role="radio" aria-checked={value === v} onClick={() => onChange(v)}
          className={cn('rounded-lg px-3 py-1 text-sm font-medium whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-link',
            value === v ? 'bg-surface text-fg dark:bg-surface-3' : 'text-fg-muted hover:text-fg')}>
          {text}
        </button>
      ))}
    </div>
  )
}

/** ‹ 2026 ›: one year back or forward, within the years that have data. */
function YearStepper({ year, min, max, onChange, label }: { year: number; min: number; max: number; onChange: (y: number) => void; label: string }) {
  const { t } = useTranslation()
  const arrow = 'grid size-8 place-items-center rounded-lg text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg disabled:opacity-40 disabled:hover:bg-transparent'
  return (
    <div role="group" aria-label={label} className="inline-flex items-center gap-1">
      <button type="button" className={arrow} disabled={year <= min} aria-label={t('stats.prevYear')} onClick={() => onChange(year - 1)}><ChevronLeft className="size-4" /></button>
      <span className="min-w-12 text-center text-lg font-semibold tabular-nums" aria-live="polite">{year}</span>
      <button type="button" className={arrow} disabled={year >= max} aria-label={t('stats.nextYear')} onClick={() => onChange(year + 1)}><ChevronRight className="size-4" /></button>
    </div>
  )
}

/** The section title with the secondary choices on the right: what the figures count by, and the CSV. */
function RevenueHeader({ title, basis, onBasis, onCsv }: { title: string; basis: StatsBasis; onBasis: (b: StatsBasis) => void; onCsv: () => void }) {
  const { t } = useTranslation()
  return (
    <div className="mb-3 space-y-1">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 className="font-display text-2xl font-bold">{title}</h2>
        <div className="flex items-center gap-2">
          <label htmlFor="stats-basis" className="text-sm text-fg-muted">{t('stats.basis')}</label>
          <Select id="stats-basis" className="h-8 w-auto py-0 text-sm" value={basis} onChange={(e) => onBasis(e.target.value as StatsBasis)}>
            <option value="issue">{t('stats.byIssue')}</option>
            <option value="taxable">{t('stats.byTaxable')}</option>
            <option value="paid">{t('stats.byPaid')}</option>
          </Select>
          <Button variant="secondary" size="sm" onClick={onCsv}><Download className="size-4" /> {t('stats.csv')}</Button>
        </div>
      </div>
      <p className="max-w-prose text-xs text-fg-muted">{t(`stats.basisHint.${basis}`)}</p>
    </div>
  )
}

/** One year by month or quarter, against the year before. */
function PeriodView({ year, grain, basis, onBasis, on }: { year: number; grain: StatsGrain; basis: StatsBasis; onBasis: (b: StatsBasis) => void; on: string }) {
  const { t } = useTranslation()
  const f = useFormat()
  const invoices = useStore((s) => s.invoices)
  const thisYear = Number(on.slice(0, 4))
  const now = useMemo(() => periodStats(invoices, year, basis, grain), [invoices, year, basis, grain])
  const before = useMemo(() => periodStats(invoices, year - 1, basis, grain), [invoices, year, basis, grain])

  const locale = f.lang === 'cs' ? 'cs-CZ' : 'en-GB'
  const categories = grain === 'month'
    ? Array.from({ length: 12 }, (_, i) => new Intl.DateTimeFormat(locale, { month: 'long' }).format(new Date(2000, i, 1)))
    : [1, 2, 3, 4].map((q) => t('stats.quarter', { q }))
  // The chart's month labels as Home writes them (led, úno … čvn, čvc), so June and July don't both read "čer".
  const labels = grain === 'month'
    ? Array.from({ length: 12 }, (_, i) => new Intl.DateTimeFormat(locale, { month: 'short' }).format(new Date(2000, i, 1)).replace('.', ''))
    : categories
  const month = Number(on.slice(5, 7)) - 1
  const current = grain === 'month' ? month : Math.floor(month / 3)
  /** A period of this year that hasn't come yet: no bar, and a dash in the table rather than 0 Kč and "-100 %". */
  const future = (i: number) => year === thisYear && i > current
  const values = now.values.map((v, i) => (future(i) ? null : v))
  const compact = new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 })

  function downloadCsv() {
    const rows = [[t('stats.period'), String(year), t('stats.count'), String(year - 1), t('stats.yoy')],
      ...categories.map((c, i) => [c, csvAmount(now.values[i]!), String(now.counts[i]), csvAmount(before.values[i]!), pct(now.values[i]!, before.values[i]!)]),
      [t('stats.total'), csvAmount(sum(now.values)), String(sum(now.counts)), csvAmount(sum(before.values)), pct(sum(now.values), sum(before.values))]]
    downloadBlob(new Blob([csvTable(rows)], { type: 'text/csv' }), `statistiky-${year}-${grain}-${basis}.csv`)
  }

  return (
    <section>
      <RevenueHeader title={t(grain === 'month' ? 'stats.titleMonths' : 'stats.titleQuarters', { year })} basis={basis} onBasis={onBasis} onCsv={downloadCsv} />
      <Card className="p-5">
        <BarChart
          categories={labels}
          series={[
            { key: 'this', label: String(year), color: 'var(--color-series-1)', values },
            { key: 'last', label: String(year - 1), color: 'var(--color-series-2)', values: before.values },
          ]}
          formatAxis={(v) => compact.format(v / 100)}
          formatValue={(v) => f.money(v)}
          partial={year === thisYear ? { indexes: [current], note: t('home.ytd', { date: f.date(on) }) } : undefined}
          tooltipExtra={(i) => (values[i] != null && before.values[i] ? t('home.vsLastYear', { pct: pct(now.values[i]!, before.values[i]!), year: year - 1 }) : undefined)}
          tableLabel={t('home.table')}
          chartLabel={t('home.chart')}
        />
      </Card>
      <Card className="mt-4 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-fg-muted">
            <tr>
              <th className="py-2.5 pr-4 pl-5 font-medium">{t('stats.period')}</th>
              <th className="px-4 py-2.5 text-right font-medium">{year}</th>
              <th className="px-4 py-2.5 text-right font-medium">{t('stats.count')}</th>
              <th className="px-4 py-2.5 text-right font-medium">{year - 1}</th>
              <th className="py-2.5 pr-5 pl-4 text-right font-medium">{t('stats.yoy')}</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {categories.map((c, i) => (
              <tr key={c} className="even:bg-row-hover">
                <td className="py-2 pr-4 pl-5">{c}</td>
                <td className="px-4 py-2 text-right">{future(i) ? '–' : f.money(now.values[i]!)}</td>
                <td className="px-4 py-2 text-right text-fg-muted">{future(i) ? '–' : now.counts[i]}</td>
                <td className="px-4 py-2 text-right text-fg-muted">{f.money(before.values[i]!)}</td>
                <td className="py-2 pr-5 pl-4 text-right text-fg-muted">{future(i) ? '–' : pct(now.values[i]!, before.values[i]!)}</td>
              </tr>
            ))}
            <tr className="border-t border-line font-semibold">
              <td className="py-2.5 pr-4 pl-5">{t('stats.total')}</td>
              <td className="px-4 py-2.5 text-right">{f.money(sum(now.values))}</td>
              <td className="px-4 py-2.5 text-right">{sum(now.counts)}</td>
              <td className="px-4 py-2.5 text-right">{f.money(sum(before.values))}</td>
              <td className="py-2.5 pr-5 pl-4 text-right">{pct(sum(now.values), sum(before.values))}</td>
            </tr>
          </tbody>
        </table>
      </Card>
      {now.missingRate.count > 0 && (
        <p className="mt-2 text-xs text-fg-muted">{t('home.missingRate', { count: now.missingRate.count, currencies: now.missingRate.currencies.join(', ') })}</p>
      )}
    </section>
  )
}

/** Every year from the first document: chart, table with year-on-year change, CSV. */
function YearsView({ basis, onBasis, on }: { basis: StatsBasis; onBasis: (b: StatsBasis) => void; on: string }) {
  const { t } = useTranslation()
  const f = useFormat()
  const invoices = useStore((s) => s.invoices)
  const thisYear = Number(on.slice(0, 4))
  const ys = useMemo(() => yearStats(invoices, basis, thisYear), [invoices, basis, thisYear])
  const compact = new Intl.NumberFormat(f.lang === 'cs' ? 'cs-CZ' : 'en-GB', { notation: 'compact', maximumFractionDigits: 1 })
  const last = ys.years.length - 1
  // Newest first in the table, like the year stepper's direction of interest.
  const rows = ys.years.map((y, i) => ({ y, value: ys.values[i]!, count: ys.counts[i]!, prev: i > 0 ? ys.values[i - 1] : undefined })).reverse()

  function downloadCsv() {
    const table = [[t('stats.year'), t('stats.amount'), t('stats.count'), t('stats.yoy')],
      ...rows.map((r) => [String(r.y), csvAmount(r.value), String(r.count), r.prev === undefined ? '' : pct(r.value, r.prev)])]
    downloadBlob(new Blob([csvTable(table)], { type: 'text/csv' }), `statistiky-roky-${basis}.csv`)
  }

  return (
    <section>
      <RevenueHeader title={t('stats.titleYears')} basis={basis} onBasis={onBasis} onCsv={downloadCsv} />
      <Card className="p-5">
        <BarChart
          categories={ys.years.map(String)}
          tickFormat={(y) => (ys.years.length <= 8 ? y : `’${y.slice(2)}`)}
          series={[{ key: 'rev', label: t('stats.titleYears'), color: 'var(--color-series-1)', values: ys.values }]}
          formatAxis={(v) => compact.format(v / 100)}
          formatValue={(v) => f.money(v)}
          partial={{ indexes: [last], note: t('home.ytd', { date: f.date(on) }) }}
          labelIndexes={[ys.values.indexOf(Math.max(...ys.values)), last]}
          tooltipExtra={(i) => (i > 0 && ys.values[i - 1] ? t('home.vsLastYear', { pct: pct(ys.values[i]!, ys.values[i - 1]!), year: ys.years[i - 1] }) : undefined)}
          tableLabel={t('home.table')}
          chartLabel={t('home.chart')}
        />
      </Card>
      <Card className="mt-4 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-fg-muted">
            <tr>
              <th className="py-2.5 pr-4 pl-5 font-medium">{t('stats.year')}</th>
              <th className="px-4 py-2.5 text-right font-medium">{t('stats.amount')}</th>
              <th className="px-4 py-2.5 text-right font-medium">{t('stats.count')}</th>
              <th className="py-2.5 pr-5 pl-4 text-right font-medium">{t('stats.yoy')}</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {rows.map((r) => (
              <tr key={r.y} className="even:bg-row-hover">
                <td className="py-2 pr-4 pl-5">{r.y}{r.y === thisYear && <span className="ml-2 text-xs text-fg-muted">{t('home.ytd', { date: f.date(on) })}</span>}</td>
                <td className="px-4 py-2 text-right">{f.money(r.value)}</td>
                <td className="px-4 py-2 text-right text-fg-muted">{r.count}</td>
                <td className="py-2 pr-5 pl-4 text-right text-fg-muted">{r.prev === undefined ? '–' : pct(r.value, r.prev)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      {ys.missingRate.count > 0 && (
        <p className="mt-2 text-xs text-fg-muted">{t('home.missingRate', { count: ys.missingRate.count, currencies: ys.missingRate.currencies.join(', ') })}</p>
      )}
    </section>
  )
}

/**
 * Statistics (like Fakturoid's "Statistiky" and "Žebříčky"). The owner found one bar of year, basis and grain confusing
 * (2026-10-18), so: at the top only what the revenue section shows, ‹ year › and [by month | by quarter | all years];
 * what the figures count by sits next to the section title; the rankings have their own year.
 */
export function StatsPage() {
  const { t } = useTranslation()
  const f = useFormat()
  const invoices = useStore((s) => s.invoices)
  const on = today()
  const thisYear = Number(on.slice(0, 4))
  const [view, setView] = useState<View>('month')
  const [year, setYear] = useState(thisYear)
  const [basis, setBasis] = useState<StatsBasis>('issue')
  const [rankYear, setRankYear] = useState(thisYear)

  const firstYear = useMemo(() => invoices.reduce((m, i) => Math.min(m, Number(i.issueDate.slice(0, 4))), thisYear), [invoices, thisYear])
  const top = useMemo(() => topCustomers(invoices, rankYear, basis).slice(0, 10), [invoices, rankYear, basis])
  const owing = useMemo(() => debtors(invoices, on), [invoices, on])
  const currencies = useMemo(() => revenueByCurrency(invoices, rankYear), [invoices, rankYear])

  return (
    <div className="space-y-10">
      <div className="space-y-4">
        <h1 className="font-display text-4xl leading-[1.2] font-bold tracking-[-0.01em]">{t('stats.title')}</h1>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          {view === 'years'
            ? <span className="min-w-28 text-lg font-semibold tabular-nums text-fg-muted">{firstYear}–{thisYear}</span>
            : <YearStepper year={year} min={firstYear} max={thisYear} onChange={setYear} label={t('stats.year')} />}
          <Segmented label={t('stats.view')} value={view} onChange={setView}
            options={[['month', t('stats.viewMonths')], ['quarter', t('stats.viewQuarters')], ['years', t('stats.viewYears')]]} />
        </div>
      </div>

      {view === 'years'
        ? <YearsView basis={basis} onBasis={setBasis} on={on} />
        : <PeriodView year={year} grain={view} basis={basis} onBasis={setBasis} on={on} />}

      <div className="grid grid-cols-2 gap-6">
        <section>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="font-display text-2xl font-bold">{t('stats.topTitle')}</h2>
            <YearStepper year={rankYear} min={firstYear} max={thisYear} onChange={setRankYear} label={t('stats.topYear')} />
          </div>
          <Card className="overflow-hidden">
            {top.length === 0 ? <p className="p-5 text-sm text-fg-muted">{t('stats.noData')}</p> : (
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-fg-muted">
                  <tr>
                    <th className="py-2.5 pr-3 pl-5 font-medium">{t('invoices.customer')}</th>
                    <th className="px-3 py-2.5 text-right font-medium">{t('stats.amount')}</th>
                    <th className="px-3 py-2.5 text-right font-medium">{t('stats.share')}</th>
                    <th className="py-2.5 pr-5 pl-3 text-right font-medium" title={t('stats.daysToPayHint')}>{t('stats.daysToPay')}</th>
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  {top.map((r) => (
                    <tr key={r.customerId} className="even:bg-row-hover">
                      <td className="max-w-48 truncate py-2 pr-3 pl-5"><a href={`#/customers/${r.customerId}`} className="hover:underline">{r.name}</a></td>
                      <td className="px-3 py-2 text-right">{f.moneyWhole(r.revenue)}</td>
                      <td className="px-3 py-2 text-right text-fg-muted">{Math.round(r.share * 100)} %</td>
                      <td className="py-2 pr-5 pl-3 text-right text-fg-muted">{r.daysToPay ?? '–'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>

          {currencies.length > 1 && (
            <>
              <h2 className="mt-10 mb-3 font-display text-2xl font-bold">{t('stats.byCurrency', { year: rankYear })}</h2>
              <Card className="overflow-hidden">
                <table className="w-full text-sm tabular-nums">
                  <tbody>
                    {currencies.map((c) => (
                      <tr key={c.currency} className="even:bg-row-hover">
                        <td className="py-2 pr-3 pl-5">{c.currency}</td>
                        <td className="px-3 py-2 text-right">{f.money(c.amount, c.currency)}</td>
                        <td className="py-2 pr-5 pl-3 text-right text-fg-muted">{c.czk === undefined ? t('stats.noRate') : f.moneyWhole(c.czk)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            </>
          )}
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="font-display text-2xl font-bold">{t('stats.debtors')}</h2>
            <span className="text-sm text-fg-muted">{t('stats.asOf', { date: f.date(on) })}</span>
          </div>
          <Card className="overflow-hidden">
            {owing.length === 0 ? <p className="p-5 text-sm text-fg-muted">{t('stats.noDebtors')}</p> : (
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-fg-muted">
                  <tr>
                    <th className="py-2.5 pr-3 pl-5 font-medium">{t('invoices.customer')}</th>
                    <th className="px-3 py-2.5 text-right font-medium">{t('stats.overdue')}</th>
                    <th className="px-3 py-2.5 text-right font-medium">{t('stats.invoices')}</th>
                    <th className="py-2.5 pr-5 pl-3 text-right font-medium">{t('stats.oldest')}</th>
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  {owing.map((d) => (
                    <tr key={d.customerId ?? d.name} className="even:bg-row-hover">
                      <td className="max-w-48 truncate py-2 pr-3 pl-5">
                        {d.customerId ? <a href={`#/invoices?customer=${d.customerId}&status=overdue`} className="hover:underline">{d.name}</a> : d.name}
                      </td>
                      <td className="px-3 py-2 text-right text-warning">{f.moneyWhole(d.overdue)}</td>
                      <td className="px-3 py-2 text-right text-fg-muted">{d.count}</td>
                      <td className="py-2 pr-5 pl-3 text-right text-fg-muted">{t('stats.days', { count: d.oldestDays })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </section>
      </div>
    </div>
  )
}
