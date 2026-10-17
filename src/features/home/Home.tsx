import { AlertCircle, ArrowRight, FilePlus2, UserCog, Users } from 'lucide-react'
import { useMemo, type ReactNode } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { daySlot, pickDaily, yearTrend } from '@/domain/greeting'
import { today } from '@/domain/id'
import { displayStatus, invoiceTotals, totalCzk } from '@/domain/invoice'
import { useStore } from '@/state/store'
import { StatusBadge, useFormat } from '@/ui/format'
import { Card, cn } from '@/ui/primitives'
import { navigate } from '@/ui/router'
import { RevenueCharts } from './RevenueCharts'

function Step({ icon, title, hint, onClick, tone = 'default' }: { icon: ReactNode; title: string; hint: string; onClick: () => void; tone?: 'default' | 'warning' }) {
  return (
    <button onClick={onClick} className="group flex w-full items-start gap-4 rounded-2xl border border-line bg-surface p-5 text-left transition-colors hover:border-line-strong">
      {/* The icon sits on the card with no tile behind it (the owner's request, 2026-10-17). */}
      <div className={cn('shrink-0', tone === 'warning' ? 'text-warning' : 'text-title')}>{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="font-medium">{title}</div>
        <div className="mt-0.5 text-sm text-fg-muted">{hint}</div>
      </div>
      <ArrowRight className="mt-2 size-4 shrink-0 text-fg-subtle transition-transform group-hover:translate-x-1" />
    </button>
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
  const year = Number(on.slice(0, 4))
  const sameDayLastYear = `${year - 1}${on.slice(4)}`

  const stats = useMemo(() => {
    let revenue = 0, revenueLast = 0, outstanding = 0, overdueSum = 0, overdueCount = 0, countThisYear = 0
    for (const inv of invoices) {
      if (inv.status === 'cancelled' || inv.status === 'draft') continue
      const czk = totalCzk(inv) ?? 0
      if (inv.issueDate.startsWith(String(year))) { revenue += czk; countThisYear++ }
      if (inv.issueDate.startsWith(String(year - 1)) && inv.issueDate <= sameDayLastYear) revenueLast += czk
      if (inv.status === 'issued') {
        outstanding += czk
        if (displayStatus(inv, on) === 'overdue') { overdueSum += czk; overdueCount++ }
      }
    }
    return { revenue, revenueLast, outstanding, overdueSum, overdueCount, countThisYear }
  }, [invoices, on, year, sameDayLastYear])

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

  return (
    <div className="space-y-10">
      <header className="space-y-3">
        <h1 className="font-display text-4xl leading-[1.2] font-bold tracking-[-0.03em]">{greeting}</h1>
        <Summary revenue={stats.revenue} revenueLast={stats.revenueLast} count={stats.countThisYear}
          outstanding={stats.outstanding} overdueSum={stats.overdueSum} overdueCount={stats.overdueCount} />
      </header>

      <RevenueCharts today={on} />

      <section>
        <h2 className="mb-3 font-display text-2xl font-bold tracking-[-0.015em]">{t('home.nextSteps')}</h2>
        <div className="grid grid-cols-2 gap-5">
          <Step icon={<FilePlus2 className="size-5" />} title={t('home.createInvoice')} hint={t('home.createInvoiceHint')} onClick={() => navigate('/invoices/new')} />
          {stats.overdueCount > 0 && (
            <Step tone="warning" icon={<AlertCircle className="size-5" />} title={t('home.overdue', { count: stats.overdueCount })}
              hint={t('home.overdueHint', { amount: f.money(stats.overdueSum) })} onClick={() => navigate('/invoices?status=overdue')} />
          )}
          {missing.length > 0 && (
            <Step icon={<UserCog className="size-5" />} title={t('home.completeProfile')} hint={t('home.completeProfileHint', { fields: missing.join(', ') })} onClick={() => navigate('/settings')} />
          )}
          <Step icon={<Users className="size-5" />} title={t('home.reviewCustomers')} hint={t('home.reviewCustomersHint', { count: customers.length })} onClick={() => navigate('/customers')} />
        </div>
      </section>

      {recent.length > 0 && (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-2xl font-bold tracking-[-0.015em]">{t('home.recent')}</h2>
            <a href="#/invoices" className="text-sm text-accent underline underline-offset-2 decoration-line-strong hover:decoration-current">{t('home.all')}</a>
          </div>
          <Card className="divide-y divide-rule">
            {recent.map((inv) => (
              <a key={inv.id} href={`#/invoices/${inv.id}`} className="flex items-center gap-4 px-5 py-3 text-sm transition-colors hover:bg-row-hover">
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
