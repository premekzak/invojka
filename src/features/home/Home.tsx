import { AlertCircle, CheckCircle2, Plus } from 'lucide-react'
import { useMemo } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { daySlot, pickDaily, yearTrend } from '@/domain/greeting'
import { today } from '@/domain/id'
import { displayStatus, invoiceTotals } from '@/domain/invoice'
import { homeStats } from '@/domain/stats'
import { useStore } from '@/state/store'
import { StatusBadge, useFormat } from '@/ui/format'
import { Card, cn } from '@/ui/primitives'
import { RevenueCharts } from './RevenueCharts'

type Task = { key: string; title: string; detail: string; action: string; href: string; warning?: boolean }

/** Things that need checking, built from the data; an empty list shows "Vše v pořádku". A plain white box like the other
 *  tables, so it reads as information, unlike the solid "Nová faktura" tile beside it (the owner's choice "K2", 2026-10-17). */
function Tasks({ tasks }: { tasks: Task[] }) {
  const { t } = useTranslation()
  if (!tasks.length) {
    return (
      <Card className="flex items-center gap-3 p-5">
        <CheckCircle2 className="size-5 shrink-0 text-success" />
        <div>
          <div className="font-medium">{t('home.allGood')}</div>
          <div className="text-xs text-fg-muted">{t('home.allGoodDetail')}</div>
        </div>
      </Card>
    )
  }
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-3 text-xs">
        <AlertCircle className="size-3.5 text-warning" />
        <span className="font-semibold">{t('home.tasks', { count: tasks.length })}</span>
      </div>
      {tasks.map((task, i) => (
        <div key={task.key} className={cn('grid grid-cols-[1.5rem_1fr_auto] items-center gap-3 px-5 py-2.5', i % 2 === 0 && 'bg-row-hover')}>
          <span aria-hidden="true" className={cn('size-2 justify-self-center rounded-full', task.warning ? 'bg-warning' : 'bg-line-strong')} />
          <div className="min-w-0">
            <div className={cn('font-medium', task.warning && 'text-warning')}>{task.title}</div>
            <div className="text-xs text-fg-muted">{task.detail}</div>
          </div>
          <a href={task.href} className="inline-flex h-8 items-center rounded-lg border border-line bg-surface-2 px-3 text-sm font-medium whitespace-nowrap transition-colors hover:bg-surface-3">{task.action}</a>
        </div>
      ))}
    </Card>
  )
}

/** One to two plain sentences instead of a row of number tiles. */
function Summary({ revenue, revenueLast, count, outstanding, overdueSum, overdueCount }: {
  revenue: number; revenueLast: number; count: number; outstanding: number; overdueSum: number; overdueCount: number
}) {
  const { t } = useTranslation()
  const f = useFormat()
  const b = <strong className="font-semibold text-fg tabular-nums" />
  const r = <strong className="font-semibold text-warning tabular-nums" />
  const { trend, pct } = yearTrend(revenue, revenueLast)
  const trendKey = { up: 'home.trendUp', down: 'home.trendDown', same: 'home.trendSame', none: 'home.trendNone' } as const
  const payment = outstanding === 0 ? <Trans i18nKey="home.allPaid" />
    : overdueCount === 0 ? <Trans i18nKey="home.waiting" values={{ amount: f.moneyWhole(outstanding) }} components={{ b }} />
    : <Trans i18nKey={overdueSum >= outstanding ? 'home.waitingAllOverdue' : 'home.waitingSomeOverdue'} count={overdueCount}
        values={{ amount: f.moneyWhole(outstanding), overdue: f.moneyWhole(overdueSum) }} components={{ b, r }} />
  return (
    <p className="max-w-prose text-lg leading-normal text-fg-muted">
      {count === 0 ? t('home.summaryNone') : (
        <><Trans i18nKey="home.summary" count={count} values={{ amount: f.moneyWhole(revenue) }} components={{ b }} />
          <Trans i18nKey={trendKey[trend]} values={{ pct }} components={{ b }} /></>
      )}{' '}
      {payment}
    </p>
  )
}

export function Home() {
  const { t } = useTranslation()
  const f = useFormat()
  const { settings, invoices, customers } = useStore()
  const on = today()

  const stats = useMemo(() => homeStats(invoices, on), [invoices, on])

  // Chosen once per visit to Home: it follows the time of day but doesn't flip while you look at it.
  const greeting = useMemo(() => {
    const slot = daySlot(new Date().getHours())
    return pickDaily(t(`home.greetings.${slot}`, { returnObjects: true }) as string[], on, slot)
  }, [t, on])

  const recent = useMemo(() => [...invoices].sort((a, b) => b.issueDate.localeCompare(a.issueDate) || b.number.localeCompare(a.number)).slice(0, 6), [invoices])

  const s = settings!.supplier
  const missing = [
    !s.ic && t('fields.ic'),
    !s.address.street && t('fields.street'),
    !s.email && t('fields.email'),
    !s.bank.account && !s.bank.iban && t('fields.account'),
  ].filter(Boolean)

  const noEmail = customers.filter((c) => !c.archived && !c.email).length
  const tasks: Task[] = [
    stats.overdueCount > 0 && { key: 'overdue', warning: true, title: t('home.taskOverdue', { count: stats.overdueCount }),
      detail: t('home.taskOverdueDetail', { amount: f.moneyWhole(stats.overdueSum) }), action: t('home.taskShow'), href: '#/invoices?status=overdue' },
    stats.missingRate.count > 0 && { key: 'rates', title: t('home.taskRates', { count: stats.missingRate.count }),
      detail: t('home.taskRatesDetail', { currencies: stats.missingRate.currencies.join(', ') }), action: t('home.taskFill'), href: '#/settings' },
    missing.length > 0 && { key: 'profile', title: t('home.taskProfile'), detail: t('home.taskProfileDetail', { fields: missing.join(', ') }),
      action: t('home.taskFill'), href: '#/settings' },
    noEmail > 0 && { key: 'customers', title: t('home.taskCustomers', { count: noEmail }), detail: t('home.taskCustomersDetail'),
      action: t('home.taskCheck'), href: '#/customers' },
  ].filter((x): x is Task => !!x)

  return (
    <div className="space-y-10">
      <header className="space-y-3">
        <h1 className="font-display text-4xl leading-[1.2] font-bold tracking-[-0.03em]">{greeting}</h1>
        <Summary revenue={stats.revenue} revenueLast={stats.revenueLast} count={stats.countThisYear}
          outstanding={stats.outstanding} overdueSum={stats.overdueSum} overdueCount={stats.overdueCount} />
      </header>

      {/* Two different things side by side (the owner's choice "K2", 2026-10-17): the permanent "Nová faktura" tile, a solid
          accent block that reads as the main button, and a white table of things to check, which shrinks to "Vše v pořádku". */}
      <div className="grid grid-cols-[17.5rem_1fr] items-stretch gap-5">
        <a href="#/invoices/new" className="flex min-h-48 flex-col justify-between gap-4 rounded-2xl bg-accent p-5 text-accent-fg transition-colors hover:bg-accent-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
          <Plus className="size-11" strokeWidth={2.25} />
          <div>
            <div className="text-lg font-semibold">{t('nav.newInvoice')}</div>
            <div className="mt-0.5 text-xs text-accent-fg/90">{t('home.tileNewHint')}</div>
          </div>
        </a>
        <Tasks tasks={tasks} />
      </div>

      <RevenueCharts today={on} />

      {recent.length > 0 && (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-2xl font-bold tracking-[-0.015em]">{t('home.recent')}</h2>
            <a href="#/invoices" className="text-sm text-accent underline underline-offset-2 decoration-line-strong hover:decoration-current">{t('home.all')}</a>
          </div>
          <Card className="overflow-hidden [&>a:nth-child(even)]:bg-row-hover">
            {recent.map((inv) => (
              <a key={inv.id} href={`#/invoices/${inv.id}`} className="flex items-center gap-4 px-5 py-3 text-sm transition-colors hover:bg-surface-2!">
                <span className="w-24 tabular-nums text-fg-muted">{inv.number}</span>
                <span className="flex-1 truncate font-medium">{inv.customerSnapshot.name}</span>
                <span className="w-28 text-fg-muted">{f.date(inv.issueDate)}</span>
                <span className="w-32 text-right tabular-nums">{f.money(invoiceTotals(inv).total, inv.currency)}</span>
                <span className="w-28 text-right"><StatusBadge status={displayStatus(inv, on)} /></span>
              </a>
            ))}
          </Card>
        </section>
      )}
    </div>
  )
}
