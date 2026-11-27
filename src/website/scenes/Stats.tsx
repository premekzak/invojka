import { BarChart } from '@/ui/BarChart'
import { Card } from '@/ui/primitives'
import { Segmented } from '@/ui/Segmented'
import { app, date, LANG, LOCALE, money as minorMoney } from '../locale'
import { click, Stage, useScene, type Frame } from '../scene/Stage'

/* The scene "statistics": revenue by month against last year, the same by years, then the biggest customers. It
   follows the Statistiky screen (src/features/stats/StatsPage.tsx) and draws with the app's own BarChart and
   Segmented; when that screen changes, change this with it. All names and numbers are made up; the months add up to
   the year and the customers stay under it. */

const t = app.stats
const noop = () => {}
const compact = new Intl.NumberFormat(LOCALE, { notation: 'compact', maximumFractionDigits: 1 })
const axis = (minor: number) => compact.format(minor / 100)
const money = (minor: number) => minorMoney(minor)
const whole = (thousands: number) => minorMoney(thousands * 100_000, true)
const k = (thousands: (number | null)[]) => thousands.map((v) => (v == null ? null : v * 100_000))

const MONTHS = LANG === 'en'
  ? ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  : ['led', 'úno', 'bře', 'dub', 'kvě', 'čvn', 'čvc', 'srp', 'zář', 'říj', 'lis', 'pro']
const THIS = k([74, 69, 85, 92, 78, 104, 61, 58, 97, 112, 89, null])
const LAST = k([62, 58, 71, 80, 66, 90, 45, 52, 88, 95, 84, 70])
const YEARS = ['2019', '2020', '2021', '2022', '2023', '2024', '2025', '2026']
const BY_YEAR = k([310, 420, 515, 560, 640, 720, 861, 919]) as number[]
const NOTE = app.home.ytd.replace('{{date}}', date(27, 11, 2026))

const TOP = [
  { name: 'Studio Meruňka s.r.o.', revenue: 248, share: 27, days: 12 },
  { name: 'Pekařství U Klásku s.r.o.', revenue: 186, share: 20, days: 9 },
  { name: 'Zahradnictví Na Stráni', revenue: 131, share: 14, days: 21 },
  { name: 'Kavárna Pod Věží', revenue: 96, share: 10, days: 14 },
  { name: 'Truhlářství Dub a syn', revenue: 74, share: 8, days: 30 },
]

type View = 'months' | 'quarters' | 'years'
type State = { phase: number; screen: 'revenue' | 'top'; view: View; cursor: string | null; press: boolean }

const INITIAL: State = { phase: 0, screen: 'revenue', view: 'months', cursor: null, press: false }

const FRAMES: Frame<State>[] = [
  // 1 This year by month, beside last year.
  { wait: 3600, set: INITIAL },
  // 2 All the years.
  ...click<State>('years', 2800),
  { wait: 0, set: { phase: 1, view: 'years' } },
  // 3 The biggest customers.
  { wait: 3400, set: { phase: 2, screen: 'top', cursor: null } },
]

function Revenue({ s }: { s: State }) {
  return (
    <>
      <div className="flex items-center justify-between gap-4">
        <span className="font-display text-2xl font-semibold">{s.view === 'years' ? t.titleYears : t.titleMonths.replace('{{year}}', '2026')}</span>
        <div className="relative">
          <Segmented<View> label={t.view} value={s.view} onChange={noop}
            options={[['months', t.viewMonths], ['quarters', t.viewQuarters], ['years', t.viewYears]]} />
          {/* Where the pointer lands: the last segment. */}
          <span data-cue="years" className="absolute top-1/2 right-10" />
        </div>
      </div>
      {/* Keyed, so the bars grow again when the view changes. */}
      <Card key={s.view} className="scene-bars px-6 py-5">
        {s.view === 'years' ? (
          <BarChart categories={YEARS} height={260}
            series={[{ key: 'rev', label: t.titleYears, color: 'var(--color-series-1)', end: 'var(--color-series-1-end)', values: BY_YEAR }]}
            formatAxis={axis} formatValue={money} partial={{ indexes: [7], note: NOTE }} labelIndexes={[6, 7]}
            tableLabel={app.home.table} chartLabel={app.home.chart} />
        ) : (
          <BarChart categories={MONTHS} height={260}
            series={[
              { key: 'this', label: '2026', color: 'var(--color-series-1)', end: 'var(--color-series-1-end)', values: THIS },
              { key: 'last', label: '2025', color: 'var(--color-series-2)', end: 'var(--color-series-2-end)', values: LAST },
            ]}
            formatAxis={axis} formatValue={money} partial={{ indexes: [10], note: NOTE }}
            tableLabel={app.home.table} chartLabel={app.home.chart} />
        )}
      </Card>
    </>
  )
}

function Top() {
  return (
    <>
      <span className="font-display text-2xl font-semibold">{t.topTitle} 2026</span>
      <Card className="animate-rise overflow-hidden">
        <table className="w-full text-sm leading-label">
          <thead className="text-left text-xs text-fg-muted">
            <tr>
              <th className="py-2.5 pr-3 pl-6 font-medium">{app.invoices.customer}</th>
              <th className="px-3 py-2.5 text-right font-medium">{t.amount}</th>
              <th className="px-3 py-2.5 text-right font-medium">{t.share}</th>
              <th className="py-2.5 pr-6 pl-3 text-right font-medium">{t.daysToPay}</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {TOP.map((r, i) => (
              <tr key={r.name} className="even:bg-stripe">
                <td className="py-3 pr-3 pl-6">{r.name}</td>
                <td className="px-3 py-3 text-right">{whole(r.revenue)}</td>
                <td className="px-3 py-3 text-right text-fg-muted">
                  <span className="flex items-center justify-end gap-2">
                    <span className="block h-2 w-28">
                      <span className="scene-grow-x block h-full rounded-r-sm bg-series-1" style={{ width: `${(r.share / TOP[0].share) * 100}%`, animationDelay: `${0.15 + i * 0.08}s` }} />
                    </span>
                    <span className="w-10">{r.share}&nbsp;%</span>
                  </span>
                </td>
                <td className="py-3 pr-6 pl-3 text-right text-fg-muted">{r.days}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  )
}

export function StatsScene({ scene }: { scene: ReturnType<typeof useStatsScene> }) {
  const s = scene.state
  return (
    <Stage width={720} height={420} cursor={s.cursor} press={s.press} sceneKey={s.screen}>
      <div className="flex h-full flex-col gap-4 bg-bg p-6">
        {s.screen === 'revenue' ? <Revenue s={s} /> : <Top />}
      </div>
    </Stage>
  )
}

export const useStatsScene = () => useScene('stats', INITIAL, FRAMES)
