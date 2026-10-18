import { AlertCircle, CheckCircle2, Plus } from 'lucide-react'
import { useMemo } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { daySlot, pickDaily, yearTrend } from '@/domain/greeting'
import { today } from '@/domain/id'
import { advanceTaxDocDeadline, advanceTaxDocOf, displayStatus, finalInvoiceOf, invoiceTotals } from '@/domain/invoice'
import { homeStats } from '@/domain/stats'
import { VAT_LIMIT, VAT_LIMIT_IMMEDIATE, vatThresholdLevel, vatTurnover } from '@/domain/vatThreshold'
import { useStore } from '@/state/store'
import { StatusBadge, useFormat } from '@/ui/format'
import { Card, cn } from '@/ui/primitives'
import { RevenueCharts } from './RevenueCharts'
import { recurringStatus } from '@/domain/recurring'
import { RECURRING_ID, RecurringInvoices } from './RecurringInvoices'
import { TaxEstimate } from './TaxEstimate'
import { VAT_THRESHOLD_ID, VatThreshold } from './VatThreshold'

/** `href` opens another screen; `scrollTo` is the id of a section further down Home. */
type Task = { key: string; title: string; detail: string; action: string; href?: string; scrollTo?: string; warning?: boolean }

const taskAction = 'inline-flex h-8 items-center rounded-lg border border-line bg-surface-2 px-3 text-sm font-medium whitespace-nowrap transition-colors hover:bg-surface-3'

/** Things that need checking, built from the data; an empty list shows "Vše v pořádku". A plain white box like the other
 *  tables, so it reads as information, unlike the solid "Nová faktura" tile beside it (the owner's choice "K2", 2026-10-17). */
function Tasks({ tasks }: { tasks: Task[] }) {
  const { t } = useTranslation()
  if (!tasks.length) {
    return (
      <Card className="flex items-center gap-3 px-6 py-5">
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
      <div className="flex items-center gap-2 px-6 py-3 text-xs">
        <AlertCircle className="size-3.5 text-warning" />
        <span className="font-semibold">{t('home.tasks', { count: tasks.length })}</span>
      </div>
      {tasks.map((task, i) => (
        <div key={task.key} className={cn('grid grid-cols-[1.5rem_1fr_auto] items-center gap-3 px-6 py-2.5', i % 2 === 0 && 'bg-row-hover')}>
          <span aria-hidden="true" className={cn('size-2 justify-self-center rounded-full', task.warning ? 'bg-warning' : 'bg-line-strong')} />
          <div className="min-w-0">
            <div className={cn('font-medium', task.warning && 'text-warning')}>{task.title}</div>
            <div className="text-xs text-fg-muted">{task.detail}</div>
          </div>
          {task.href ? <a href={task.href} className={taskAction}>{task.action}</a> : (
            <button type="button" className={taskAction}
              onClick={() => document.getElementById(task.scrollTo!)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>{task.action}</button>
          )}
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
  // All paid: one line, the short "all paid" at its end. Something unpaid: the money waiting gets a line of its own, so it
  // isn't lost at the end of the year's summary (the owner, 2026-10-17). Each line is a sentence or two, so it may run
  // wider than 65ch on purpose.
  return (
    <p className="text-lg leading-normal text-fg-muted">
      {count === 0 ? t('home.summaryNone') : (
        <><Trans i18nKey="home.summary" count={count} values={{ amount: f.moneyWhole(revenue) }} components={{ b }} />
          <Trans i18nKey={trendKey[trend]} values={{ pct }} components={{ b }} /></>
      )}
      {outstanding > 0 ? <><br />{payment}</> : <>{' '}{payment}</>}
    </p>
  )
}

export function Home() {
  const { t } = useTranslation()
  const f = useFormat()
  const { settings, invoices, customers } = useStore()
  const on = today()

  const stats = useMemo(() => homeStats(invoices, on), [invoices, on])
  // The VAT registration limit matters only to someone who isn't a payer yet.
  const year = Number(on.slice(0, 4))
  const vat = useMemo(() => settings!.vatMode === 'payer' ? undefined
    : { now: vatTurnover(invoices, year), last: vatTurnover(invoices, year - 1) }, [settings, invoices, year])
  const vatLevel = vat && vatThresholdLevel(vat.now.domestic)

  // Chosen once per visit to Home: it follows the time of day but doesn't flip while you look at it.
  const greeting = useMemo(() => {
    const slot = daySlot(new Date().getHours())
    return pickDaily(t(`home.greetings.${slot}`, { returnObjects: true }) as string[], on, slot)
  }, [t, on])

  const recent = useMemo(() => [...invoices].sort((a, b) => b.issueDate.localeCompare(a.issueDate) || b.number.localeCompare(a.number)).slice(0, 6), [invoices])

  const s = settings!.supplier
  const missing = [
    !s.ic && t('fields.ic'),
    // A VAT payer's tax documents must carry their DIČ (§ 29(1)(b) of the VAT act).
    settings!.vatMode === 'payer' && !s.dic && t('fields.dic'),
    !s.address.street && t('fields.street'),
    !s.email && t('fields.email'),
    !s.bank.account && !s.bank.iban && t('fields.account'),
  ].filter(Boolean)

  const noEmail = customers.filter((c) => !c.archived && !c.email).length
  const recurring = useMemo(() => recurringStatus(customers, invoices, on), [customers, invoices, on])
  const recurringDue = recurring.filter((r) => r.state === 'due').length
  // A paid proforma is half done: a VAT payer owes its tax document within 15 days, and the work still needs its invoice.
  const payer = settings!.vatMode === 'payer'
  const paidProformas = invoices.filter((i) => i.kind === 'proforma' && i.status === 'paid' && !finalInvoiceOf(invoices, i.id))
  const needTaxDoc = payer ? paidProformas.filter((i) => !advanceTaxDocOf(invoices, i.id)) : []
  const unsettled = paidProformas.filter((i) => !needTaxDoc.includes(i))
  const firstDeadline = needTaxDoc.map(advanceTaxDocDeadline).sort()[0]
  const tasks = ([
    stats.overdueCount > 0 && { key: 'overdue', warning: true, title: t('home.taskOverdue', { count: stats.overdueCount }),
      detail: t('home.taskOverdueDetail', { amount: f.moneyWhole(stats.overdueSum) }), action: t('home.taskShow'), href: '#/invoices?status=overdue' },
    vat && vat.last.domestic > VAT_LIMIT && { key: 'vatLast', warning: true, title: t('home.taskVatLastYear'),
      detail: t('home.taskVatLastYearDetail', { amount: f.moneyWhole(vat.last.domestic), limit: f.moneyWhole(VAT_LIMIT), year }),
      action: t('home.taskSettings'), href: '#/settings?tab=business' },
    vatLevel && vatLevel !== 'ok' && { key: 'vat', warning: vatLevel !== 'near', title: t(`home.taskVat_${vatLevel}`),
      detail: t(`home.taskVatDetail_${vatLevel}`, { amount: f.moneyWhole(vat.now.domestic), limit: f.moneyWhole(VAT_LIMIT), immediate: f.moneyWhole(VAT_LIMIT_IMMEDIATE), next: year + 1 }),
      action: t('home.taskShow'), scrollTo: VAT_THRESHOLD_ID },
    recurringDue > 0 && { key: 'recurring', title: t('home.taskRecurring', { count: recurringDue }), detail: t('home.taskRecurringDetail'),
      action: t('home.taskShow'), scrollTo: RECURRING_ID },
    needTaxDoc.length > 0 && { key: 'taxDocs', warning: firstDeadline! <= on, title: t('home.taskTaxDoc', { count: needTaxDoc.length }),
      detail: t('home.taskTaxDocDetail', { numbers: needTaxDoc.map((i) => i.number).join(', '), date: f.date(firstDeadline!) }),
      action: t('editor.advanceTaxDoc'), href: needTaxDoc.length === 1 ? `#/invoices/new?advanceFor=${needTaxDoc[0]!.id}` : `#/invoices/${needTaxDoc[0]!.id}` },
    unsettled.length > 0 && { key: 'proformas', title: t('home.taskProforma', { count: unsettled.length }),
      detail: t('home.taskProformaDetail', { numbers: unsettled.map((i) => i.number).join(', ') }),
      action: t('editor.finalInvoice'), href: unsettled.length === 1 ? `#/invoices/new?settles=${unsettled[0]!.id}` : `#/invoices/${unsettled[0]!.id}` },
    stats.missingRate.count > 0 && { key: 'rates', title: t('home.taskRates', { count: stats.missingRate.count }),
      detail: t('home.taskRatesDetail', { currencies: stats.missingRate.currencies.join(', ') }), action: t('home.taskFill'), href: '#/settings?tab=rates' },
    missing.length > 0 && { key: 'profile', title: t('home.taskProfile'), detail: t('home.taskProfileDetail', { fields: missing.join(', ') }),
      action: t('home.taskFill'), href: '#/settings?tab=business' },
    noEmail > 0 && { key: 'customers', title: t('home.taskCustomers', { count: noEmail }), detail: t('home.taskCustomersDetail'),
      action: t('home.taskCheck'), href: '#/customers' },
  ] as (Task | false | undefined)[]).filter((x): x is Task => !!x)

  return (
    <div className="space-y-10">
      <header className="space-y-3">
        <h1 className="font-display text-4xl leading-[1.2] font-bold tracking-[-0.01em]">{greeting}</h1>
        <Summary revenue={stats.revenue} revenueLast={stats.revenueLast} count={stats.countThisYear}
          outstanding={stats.outstanding} overdueSum={stats.overdueSum} overdueCount={stats.overdueCount} />
      </header>

      {/* Two different things side by side (the owner's choice "K2", 2026-10-17): the permanent "Nová faktura" tile, a solid
          accent block that reads as the main button, and a white table of things to check, which shrinks to "Vše v pořádku". */}
      <div className="grid grid-cols-[17.5rem_1fr] items-stretch gap-5 mobile-stack">
        <a href="#/invoices/new" className="scheme-tile flex min-h-48 flex-col justify-between gap-4 rounded-2xl bg-accent px-6 py-5 text-tile-fg transition-colors hover:bg-accent-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-link">
          <Plus className="size-11" strokeWidth={2.25} />
          <div>
            <div className="text-lg font-semibold">{t('nav.newInvoice')}</div>
            <div className="mt-0.5 text-xs text-tile-fg/90">{t('home.tileNewHint')}</div>
          </div>
        </a>
        <Tasks tasks={tasks} />
      </div>

      {recurring.length > 0 && <RecurringInvoices items={recurring} on={on} />}

      <RevenueCharts today={on} />

      {vat && <VatThreshold turnover={vat.now} />}

      {settings!.taxes.selfEmployed && <TaxEstimate invoices={invoices} settings={settings!} on={on} />}

      {recent.length > 0 && (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-2xl font-bold">{t('home.recent')}</h2>
            <a href="#/invoices" className="text-sm text-link underline underline-offset-2 decoration-line-strong hover:decoration-current">{t('home.all')}</a>
          </div>
          <Card className="overflow-hidden [&>a:nth-child(even)]:bg-row-hover">
            {recent.map((inv) => (
              <a key={inv.id} href={`#/invoices/${inv.id}`} className="flex items-center gap-4 px-6 py-3 text-sm transition-colors hover:bg-surface-2!">
                <span className="w-24 tabular-nums text-fg-muted max-md:hidden">{inv.number}</span>
                <span className="min-w-0 flex-1 truncate font-medium">{inv.customerSnapshot.name}</span>
                <span className="w-28 text-fg-muted max-md:hidden">{f.date(inv.issueDate)}</span>
                <span className="shrink-0 text-right tabular-nums md:w-32">{f.money(invoiceTotals(inv).total, inv.currency)}</span>
                <span className="shrink-0 text-right md:w-28"><StatusBadge status={displayStatus(inv, on)} /></span>
              </a>
            ))}
          </Card>
        </section>
      )}
    </div>
  )
}
