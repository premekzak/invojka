import { CheckCircle2, Circle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { FirstStep } from '@/domain/firstSteps'
import { useStore } from '@/state/store'
import { Card, cn } from '@/ui/primitives'

const action = 'inline-flex h-8 items-center rounded-lg border border-line bg-surface-2 px-3 text-sm font-medium whitespace-nowrap transition-colors hover:bg-surface-3'

const HREF: Partial<Record<FirstStep, string>> = {
  customer: '#/customers/new',
  invoice: '#/invoices/new',
  look: '#/settings?tab=invoices',
}

/**
 * After onboarding, what to do next until it's done (CLAUDE.md: the user always knows the next step). Rows like the
 * tasks beside "Nová faktura"; a step Invojka can't see (a bookmark) is ticked by hand, and the whole list can be closed.
 */
export function FirstSteps({ steps }: { steps: { step: FirstStep; done: boolean }[] }) {
  const { t } = useTranslation()
  const { settings, saveSettings } = useStore()
  const s = settings!
  const setTicked = (firstSteps: string[] | undefined) => saveSettings({ ...s, ui: { ...s.ui, firstSteps } })
  const tick = (step: FirstStep) => setTicked([...(s.ui.firstSteps ?? []), step])
  const left = steps.filter((x) => !x.done).length
  return (
    <section aria-labelledby="first-steps">
      <div className="mb-3 flex items-baseline justify-between gap-4">
        <h2 id="first-steps" className="font-display text-2xl font-bold">{t('firstSteps.title')}</h2>
        <button type="button" className="text-sm text-link underline underline-offset-2 decoration-line-strong hover:decoration-current"
          onClick={() => setTicked(undefined)}>{t('firstSteps.hide')}</button>
      </div>
      <Card className="overflow-hidden">
        <p className="px-6 pt-4 pb-2 text-sm text-fg-muted">{t('firstSteps.left', { count: left })}</p>
        {steps.map(({ step, done }, i) => (
          <div key={step} className={cn('grid grid-cols-[1.5rem_1fr_auto] items-center gap-3 px-6 py-2.5', i % 2 === 0 && 'bg-row-hover')}>
            {done
              ? <CheckCircle2 aria-label={t('firstSteps.done')} className="size-5 justify-self-center text-success" />
              : <Circle aria-hidden="true" className="size-5 justify-self-center text-line-strong" />}
            <div className="min-w-0">
              <div className={cn('font-medium', done && 'text-fg-muted')}>{t(`firstSteps.steps.${step}`)}</div>
              {!done && <div className="text-xs text-fg-muted">{t(`firstSteps.steps.${step}Hint`)}</div>}
            </div>
            {!done && (
              <div className="flex items-center gap-3">
                {/* The plain neutral look is a fine choice too, so it can be kept without visiting Settings. */}
                {step === 'look' && (
                  <button type="button" className="text-sm text-link underline underline-offset-2 decoration-line-strong hover:decoration-current"
                    onClick={() => tick(step)}>{t('firstSteps.keep')}</button>
                )}
                {HREF[step]
                  ? <a href={HREF[step]} className={action}>{t(`firstSteps.steps.${step}Action`)}</a>
                  : <button type="button" className={action} onClick={() => tick(step)}>{t(`firstSteps.steps.${step}Action`)}</button>}
              </div>
            )}
          </div>
        ))}
      </Card>
    </section>
  )
}
