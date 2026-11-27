import { ArrowLeft, ArrowRight, Check, ChevronsUpDown, Send } from 'lucide-react'
import { Button, Card, cn } from '@/ui/primitives'
import { Steps } from '@/ui/Steps'
import { app, date, money as minorMoney, tr } from '../locale'
import { click, Stage, useScene, type Frame } from '../scene/Stage'

/* The scene "an invoice in four steps": pick the customer, the lines come prefilled from their last invoice, change one
   number, check the PDF, issue. It follows the draft editor (src/features/invoices/InvoiceEditor.tsx) and uses its
   components and its texts; when the editor changes, change this with it. All names and numbers are made up. */

const t = app.editor
const money = (major: number) => minorMoney(major * 100)
const last = (day: number, month: number) => t.customerInfo.last.replace('{{date}}', date(day, month, 2026))
const ID = tr('IČ', 'ID')
const PHOTOS = tr('Fotografie nového sortimentu', 'Photos of the new range')
const RETOUCH = tr('Úprava a retuš fotografií', 'Photo editing and retouching')
const noop = () => {}

const CUSTOMERS = [
  { name: 'Pekařství U Klásku s.r.o.', where: `Kolín · ${ID} 28410575`, last: `${last(3, 10)} · ${money(11000)} · ${PHOTOS}`, count: tr('14 faktur', '14 invoices'), recent: true },
  { name: 'Studio Meruňka s.r.o.', where: `Brno · ${ID} 07329161`, last: `${last(21, 10)} · ${money(18000)} · ${tr('Úprava e-shopu', 'Online shop changes')}`, overdue: tr('1 po splatnosti', '1 overdue'), recent: true },
  { name: 'Zahradnictví Na Stráni', where: `Olomouc · ${ID} 05183426`, last: `${last(12, 6)} · ${money(4200)} · ${tr('Leták na jarní sezónu', 'Leaflet for the spring season')}`, count: tr('3 faktury', '3 invoices'), recent: false },
]
const PICKED = CUSTOMERS[0]
const NUMBER = '2026-0042'
const PRICE = 950, EXTRA = 1500

type State = {
  /** The part of the story, as the captions beside the scene number it. */
  phase: number
  step: 1 | 2 | 4
  query: string; open: boolean; active: number
  qty: string; qtyFocus: boolean
  issued: boolean
  cursor: string | null; press: boolean
}

const INITIAL: State = { phase: 0, step: 1, query: '', open: false, active: 0, qty: '10', qtyFocus: false, issued: false, cursor: null, press: false }

const FRAMES: Frame<State>[] = [
  // 1 Customer: open the list, type three letters, pick.
  { wait: 2800, set: INITIAL },
  ...click<State>('customer', 700),
  { wait: 0, set: { open: true } },
  { wait: 1100, set: { query: 'p' } },
  { wait: 170, set: { query: 'pe' } },
  { wait: 170, set: { query: 'pek' } },
  ...click<State>('row', 700),
  // 2 Lines: they are already there, from the last invoice; one number changes.
  { wait: 120, set: { phase: 1, step: 2, open: false, query: '' } },
  ...click<State>('qty', 1500),
  // The pointer steps aside, so it doesn't cover the number being typed.
  { wait: 0, set: { qtyFocus: true, cursor: 'rest' } },
  { wait: 450, set: { qty: '1' } },
  { wait: 220, set: { qty: '12' } },
  ...click<State>('review', 1300),
  // 3 Review and issue.
  { wait: 120, set: { phase: 2, step: 4, qtyFocus: false } },
  ...click<State>('issue', 2000),
  { wait: 200, set: { issued: true, cursor: null } },
]

export const INVOICE_STEPS_PHASES = 3

function CustomerRow({ c, active }: { c: (typeof CUSTOMERS)[number]; active: boolean }) {
  return (
    <div data-cue={c === PICKED ? 'row' : undefined} className={cn('space-y-0.5 rounded-xs px-3 py-2 text-sm leading-label', active && 'bg-surface-2')}>
      <div className="flex items-baseline justify-between gap-6">
        <span className="truncate font-medium">{c.name}</span>
        <span className="shrink-0 text-xs whitespace-nowrap text-fg-muted tabular-nums">{c.where}</span>
      </div>
      <div className="flex items-baseline justify-between gap-6 text-xs text-fg-muted">
        <span className="truncate tabular-nums">{c.last}</span>
        {c.overdue ? <span className="shrink-0 font-medium whitespace-nowrap text-warning">{c.overdue}</span> : <span className="shrink-0 whitespace-nowrap">{c.count}</span>}
      </div>
    </div>
  )
}

function CustomerStep({ s }: { s: State }) {
  const list = s.query ? CUSTOMERS.filter((c) => c.name.toLowerCase().includes(s.query)) : CUSTOMERS
  return (
    <Card className="space-y-2 px-6 py-5">
      <div className="text-sm text-fg-muted">{app.invoices.customer}</div>
      <div className="relative">
        <div data-cue="customer" className={cn('control flex h-9 items-center px-3 text-sm', s.open && 'border-link bg-surface shadow-[inset_0_0_0_1px_var(--color-link)]')}>
          <span className="flex-1">
            {s.query || (!s.open && <span className="text-fg-subtle">{t.pickCustomer}</span>)}
            {s.open && <span className="scene-caret" />}
          </span>
          <ChevronsUpDown className="size-4 text-fg-subtle" />
        </div>
        {s.open && (
          <div className="animate-rise absolute z-20 mt-1 w-full rounded-xl border border-line bg-surface p-1">
            {list.map((c, i) => (
              <div key={c.name}>
                {!s.query && (i === 0 || c === CUSTOMERS[2]) && (
                  <div className={cn('px-3 pt-2 pb-1 text-xs text-fg-muted', i > 0 && 'mt-1 border-t border-line')}>{i === 0 ? t.recentCustomers : t.allCustomers}</div>
                )}
                <CustomerRow c={c} active={i === s.active} />
              </div>
            ))}
          </div>
        )}
      </div>
      <p className="text-xs text-fg-muted">{t.pickCustomerFirst}</p>
    </Card>
  )
}

const cell = 'control flex h-9 items-center px-2 text-sm leading-label'

function LinesStep({ s }: { s: State }) {
  const qty = Number(s.qty)
  const total = qty * PRICE + EXTRA
  return (
    <>
      <Card className="animate-rise space-y-4 px-6 py-5">
        <p className="text-xs text-fg-muted">
          {t.prefilled.replace('{{number}}', '2026-0038')} <span className="text-link underline underline-offset-2">{t.startBlank}</span>
        </p>
        <div>
          <div className="mb-2 grid grid-cols-12 gap-2 text-xs font-medium text-fg-muted">
            <span className="col-span-6">{t.description}</span>
            <span className="col-span-1 text-right">{t.qty}</span>
            <span className="col-span-1">{t.unit}</span>
            <span className="col-span-2 text-right">{t.unitPrice}</span>
            <span className="col-span-2 text-right">{app.invoices.total}</span>
          </div>
          <div className="space-y-2">
            <div className="grid grid-cols-12 gap-2">
              <div className={cn(cell, 'col-span-6 px-3')}>{PHOTOS}</div>
              <div data-cue="qty" className={cn(cell, 'col-span-1 justify-end tabular-nums', s.qtyFocus && 'border-link bg-surface shadow-[inset_0_0_0_1px_var(--color-link)]')}>
                {s.qty}{s.qtyFocus && <span className="scene-caret" />}
              </div>
              <div className={cn(cell, 'col-span-1')}>{tr('hod', 'h')}</div>
              <div className={cn(cell, 'col-span-2 justify-end px-3 tabular-nums')}>{PRICE}</div>
              <span key={qty} className={cn('col-span-2 flex h-9 items-center justify-end pr-1 text-sm font-medium tabular-nums', qty === 12 && 'scene-flash')}>{money(qty * PRICE)}</span>
            </div>
            <div className="grid grid-cols-12 gap-2">
              <div className={cn(cell, 'col-span-6 px-3')}>{RETOUCH}</div>
              <div className={cn(cell, 'col-span-1 justify-end tabular-nums')}>1</div>
              <div className={cn(cell, 'col-span-1')}>{tr('ks', 'pc')}</div>
              <div className={cn(cell, 'col-span-2 justify-end px-3 tabular-nums')}>{tr('1 500', '1,500')}</div>
              <span className="col-span-2 flex h-9 items-center justify-end pr-1 text-sm font-medium tabular-nums">{money(EXTRA)}</span>
            </div>
          </div>
        </div>
        <div className="flex justify-end">
          <div className="flex w-72 justify-between text-lg font-semibold">
            <span data-cue="rest">{t.toPay}</span>
            <span key={total} className={cn('tabular-nums', qty === 12 && 'scene-flash')}>{money(total)}</span>
          </div>
        </div>
      </Card>
      <div className="flex items-center gap-2">
        <Button variant="secondary"><ArrowLeft className="size-4" /> {app.common.back}</Button>
        <div className="ml-auto flex items-center gap-3">
          <span className="text-xs text-fg-muted tabular-nums">{app.invoices.due} {tr('14 dní', '14 days')} · {t.method.bank} · {app.invoices.number} {NUMBER}</span>
          <Button variant="secondary" data-cue="review">{t.steps.toReview}</Button>
          <Button>{app.common.continue} <ArrowRight className="size-4" /></Button>
        </div>
      </div>
    </>
  )
}

/** The invoice's page, drawn small: enough to be read as a document, not as text. */
function Paper() {
  const bar = 'h-1.5 rounded-xs bg-surface-3'
  return (
    <div className="flex h-full flex-col gap-3 rounded-lg bg-surface px-6 py-5 ring-1 ring-rule">
      <div className="flex items-baseline justify-between">
        <span className="font-display text-lg font-semibold">{tr('Faktura', 'Invoice')} {NUMBER}</span>
        <span className="text-xs text-fg-muted tabular-nums">{date(27, 11, 2026)}</span>
      </div>
      <div className="grid grid-cols-2 gap-6 text-xs">
        <div className="space-y-1.5">
          <div className="text-fg-muted">{t.review.supplier}</div>
          <div className="font-medium">Ateliér Světlopis</div>
          <div className={cn(bar, 'w-24')} /><div className={cn(bar, 'w-16')} />
        </div>
        <div className="space-y-1.5">
          <div className="text-fg-muted">{t.review.customer}</div>
          <div className="font-medium">{PICKED.name}</div>
          <div className={cn(bar, 'w-28')} /><div className={cn(bar, 'w-20')} />
        </div>
      </div>
      <div className="mt-1 space-y-1.5 border-t border-line pt-3 text-xs">
        <div className="flex justify-between"><span>{PHOTOS}</span><span className="tabular-nums">{money(12 * PRICE)}</span></div>
        <div className="flex justify-between"><span>{RETOUCH}</span><span className="tabular-nums">{money(EXTRA)}</span></div>
      </div>
      <div className="mt-auto flex items-end justify-between gap-4">
        {/* Stands for the QR Platba code. */}
        <div className="grid size-14 grid-cols-5 gap-px" role="presentation">
          {[1, 1, 0, 1, 1, 1, 0, 1, 0, 1, 0, 1, 1, 0, 0, 1, 0, 0, 1, 1, 1, 1, 0, 1, 0].map((on, i) => <span key={i} className={on ? 'bg-fg' : ''} />)}
        </div>
        <div className="rounded-lg bg-fg px-4 py-2 text-right text-surface">
          <div className="text-xs">{t.toPay}</div>
          <div className="text-base font-semibold tabular-nums">{money(12 * PRICE + EXTRA)}</div>
        </div>
      </div>
    </div>
  )
}

function ReviewStep({ s }: { s: State }) {
  return (
    <div className="animate-rise grid h-72 grid-cols-[1fr_15rem] gap-6">
      <Paper />
      {s.issued ? (
        <div className="flex flex-col items-start gap-3 pt-2">
          <span className="scene-pop flex size-10 items-center justify-center rounded-full bg-success-chip text-success"><Check className="size-5" /></span>
          <div className="space-y-1">
            <div className="font-display text-xl font-semibold">{app.pdfScreen.issued}</div>
            <p className="text-xs text-fg-muted">{app.pdfScreen.savedIn.replace('{{path}}', `${tr('Faktury', 'Invoices')}/pdf/2026/${NUMBER}.pdf`)}</p>
          </div>
          <p className="text-xs text-fg-muted">{app.pdfScreen.qr}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4 pt-2">
          <p className="text-xs text-fg-muted">{t.review.ready}</p>
          <dl className="space-y-1.5 text-sm">
            <div className="flex justify-between"><dt className="text-fg-muted">{app.invoices.number}</dt><dd className="tabular-nums">{NUMBER}</dd></div>
            <div className="flex justify-between"><dt className="text-fg-muted">{app.invoices.due}</dt><dd className="tabular-nums">{date(11, 12, 2026)}</dd></div>
            <div className="flex justify-between font-semibold"><dt>{t.toPay}</dt><dd className="tabular-nums">{money(12 * PRICE + EXTRA)}</dd></div>
          </dl>
          <Button data-cue="issue" className="self-start"><Send className="size-4" /> {t.issue}</Button>
        </div>
      )}
    </div>
  )
}

export function InvoiceStepsScene({ scene, maxScale }: { scene: ReturnType<typeof useInvoiceStepsScene>; maxScale?: number }) {
  const s = scene.state
  return (
    <Stage width={720} height={452} maxScale={maxScale} cursor={s.cursor} press={s.press} sceneKey={`${s.step}${s.open}${s.query}`}>
      <div className="flex h-full flex-col gap-4 bg-bg p-6">
        <div className="flex items-baseline justify-between gap-6">
          <span className="font-display text-2xl font-semibold">{t.newTitle}</span>
          {s.step > 1 && <span className="animate-rise text-sm text-fg-muted">{PICKED.name}</span>}
        </div>
        <Steps label={t.steps.label} current={s.step} onGo={noop} steps={[t.steps.customer, t.steps.lines, t.steps.payment, t.steps.review]} />
        {s.step === 1 && <CustomerStep s={s} />}
        {s.step === 2 && <LinesStep s={s} />}
        {s.step === 4 && <ReviewStep s={s} />}
      </div>
    </Stage>
  )
}

export const useInvoiceStepsScene = () => useScene('invoice', INITIAL, FRAMES)
