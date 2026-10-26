import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { Invoice } from '@/domain/schema'
import { monthlyRevenue, yearlyRevenue } from '@/domain/stats'
import { RunResult } from '@/features/rates/RatesPanel'
import { useRates } from '@/features/rates/useRates'
import { useStore } from '@/state/store'
import { BarChart } from '@/ui/BarChart'
import { useFormat } from '@/ui/format'
import { Card } from '@/ui/primitives'

/** Revenue by month (against the year before) and by year. `invoices` narrows it, e.g. to one customer; the default is all of them. */
export function RevenueCharts({ today, invoices: only }: { today: string; invoices?: Invoice[] }) {
  const { t } = useTranslation()
  const f = useFormat()
  const all = useStore((s) => s.invoices)
  const invoices = only ?? all
  const year = Number(today.slice(0, 4))
  const month = Number(today.slice(5, 7)) - 1

  const locale = f.lang === 'cs' ? 'cs-CZ' : 'en-GB'
  const compact = useMemo(() => new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 }), [locale])
  const axis = (minor: number) => compact.format(minor / 100)
  const months = useMemo(
    () => Array.from({ length: 12 }, (_, i) => new Intl.DateTimeFormat(locale, { month: 'short' }).format(new Date(2000, i, 1)).replace('.', '')),
    [locale],
  )

  const { thisYear, lastYear, yearly } = useMemo(() => ({
    thisYear: monthlyRevenue(invoices, year),
    lastYear: monthlyRevenue(invoices, year - 1),
    yearly: yearlyRevenue(invoices, year),
  }), [invoices, year])

  // Months after the current one haven't happened yet: no bar rather than a misleading zero.
  const current = thisYear.values.map((v, i) => (i <= month ? v : null))

  // A customer billed only in earlier years would get an empty month chart: show the years alone, full width.
  const recent = current.some((v) => v) || lastYear.values.some((v) => v)

  const pct = (a: number, b: number) => {
    if (!b) return undefined
    const p = Math.round(((a - b) / b) * 100)
    return `${p > 0 ? '+' : ''}${p} %`
  }

  const missing = yearly.missingRate
  const rates = useRates()
  return (
    <div className="grid grid-cols-5 gap-x-6 gap-y-4 mobile-stack">
      {recent && <section className="col-span-3">
        <h2 className="mb-3 font-display text-2xl font-bold">{t('home.byMonth')}</h2>
        <Card className="px-6 py-5">
          <BarChart
            categories={months}
            series={[
              { key: 'this', label: String(year), color: 'var(--color-series-1)', values: current },
              { key: 'last', label: String(year - 1), color: 'var(--color-series-2)', values: lastYear.values },
            ]}
            formatAxis={axis}
            formatValue={(v) => f.money(v)}
            partial={{ indexes: [month], note: t('home.ytd', { date: f.date(today) }) }}
            tooltipExtra={(i) => {
              const p = current[i] != null ? pct(current[i]!, lastYear.values[i]) : undefined
              return p && t('home.vsLastYear', { pct: p, year: year - 1 })
            }}
            tableLabel={t('home.table')}
            chartLabel={t('home.chart')}
          />
        </Card>
      </section>}
      <section className={recent ? 'col-span-2' : 'col-span-5'}>
        <h2 className="mb-3 font-display text-2xl font-bold">{t('home.byYear')}</h2>
        <Card className="px-6 py-5">
          <BarChart
            categories={yearly.years.map(String)}
            tickFormat={(y) => (yearly.years.length <= 8 ? y : `’${y.slice(2)}`)}
            series={[{ key: 'rev', label: t('home.byYear'), color: 'var(--color-series-1)', values: yearly.values }]}
            formatAxis={axis}
            formatValue={(v) => f.money(v)}
            partial={{ indexes: [yearly.years.length - 1], note: t('home.ytd', { date: f.date(today) }) }}
            labelIndexes={[yearly.values.indexOf(Math.max(...yearly.values)), yearly.years.length - 1]}
            tooltipExtra={(i) => i > 0 ? (pct(yearly.values[i], yearly.values[i - 1]) && t('home.vsLastYear', { pct: pct(yearly.values[i], yearly.values[i - 1]), year: yearly.years[i - 1] })) : undefined}
            tableLabel={t('home.table')}
            chartLabel={t('home.chart')}
          />
        </Card>
      </section>
      {(missing.count > 0 || rates.run.busy || rates.run.filled !== undefined) && (
        <div className="col-span-5 -mt-2 flex items-center gap-3 text-xs text-fg-subtle">
          {missing.count > 0 && <span>{t('home.missingRate', { count: missing.count, currencies: missing.currencies.join(', ') })}</span>}
          {missing.count > 0 && !rates.run.busy && (
            <>
              <button className="font-medium text-link underline underline-offset-2 decoration-line-strong hover:decoration-current" onClick={() => void rates.fillFromEcb()}>{t('rates.fillNow')}</button>
              <a href="#/settings?tab=rates" className="hover:underline">{t('rates.otherOptions')}</a>
            </>
          )}
          <RunResult run={rates.run} />
        </div>
      )}
    </div>
  )
}
