import { Check, CloudDownload, ExternalLink, FileUp, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { rateDateOf } from '@/domain/fx'
import { Button, cn } from '@/ui/primitives'
import { useRates, type RateRun } from './useRates'

const CNB_YEAR = (y: number) => `https://www.cnb.cz/cs/financni-trhy/devizovy-trh/kurzy-devizoveho-trhu/kurzy-devizoveho-trhu/rok.txt?rok=${y}`

export function RunResult({ run }: { run: RateRun }) {
  const { t } = useTranslation()
  if (run.busy) {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm text-fg-muted">
        <Loader2 className="size-4 animate-spin" />
        {run.progress ? t('rates.downloading', run.progress) : t('rates.reading')}
      </span>
    )
  }
  if (run.filled === undefined) return null
  return (
    <span className="text-sm">
      <span className="inline-flex items-center gap-1.5 text-success"><Check className="size-4" /> {t('rates.filled', { count: run.filled })}</span>
      {run.errors.map((e) => <span key={e} className="block text-xs text-danger">{e}</span>)}
    </span>
  )
}

/** Settings section: where exchange rates come from, and buttons to fill in missing ones. */
export function RatesPanel() {
  const { t } = useTranslation()
  const { missing, run, fillFromEcb, importCnb } = useRates()
  const currencies = [...new Set(missing.map((i) => i.currency))].sort().join(', ')
  const years = [...new Set(missing.map((i) => Number(rateDateOf(i).slice(0, 4))))].sort()

  return (
    <div className="space-y-4 text-sm">
      <p className="max-w-prose text-fg-muted">{t('rates.intro')}</p>
      <p className={cn('font-medium', missing.length ? 'text-warning' : 'text-success')}>
        {missing.length ? t('rates.missing', { count: missing.length, currencies }) : t('rates.allSet')}
      </p>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2 rounded-lg bg-surface-2 p-4">
          <div className="font-medium">{t('rates.ecbTitle')}</div>
          <p className="text-xs text-fg-muted">{t('rates.ecbHint')}</p>
          <Button size="sm" disabled={run.busy || !missing.length} onClick={() => void fillFromEcb()}>
            <CloudDownload className="size-4" /> {t('rates.ecbButton')}
          </Button>
        </div>
        <div className="space-y-2 rounded-lg bg-surface-2 p-4">
          <div className="font-medium">{t('rates.cnbTitle')}</div>
          <p className="text-xs text-fg-muted">{t('rates.cnbHint')}</p>
          {years.length > 0 && (
            <p className="flex flex-wrap gap-x-2 gap-y-1 text-xs">
              {years.map((y) => (
                <a key={y} href={CNB_YEAR(y)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-link underline underline-offset-2 decoration-line-strong hover:decoration-current">
                  {y} <ExternalLink className="size-3" />
                </a>
              ))}
            </p>
          )}
          <label className={cn('inline-flex h-8 cursor-pointer items-center gap-2 rounded-lg border border-line bg-surface-2 px-3 text-sm font-medium transition-colors hover:bg-surface-3', run.busy && 'pointer-events-none opacity-50')}>
            <FileUp className="size-4" /> {t('rates.cnbButton')}
            <input type="file" accept=".txt,text/plain" multiple className="hidden"
              onChange={(e) => { if (e.target.files?.length) void importCnb(e.target.files); e.target.value = '' }} />
          </label>
        </div>
      </div>
      <RunResult run={run} />
      <p className="text-xs text-fg-subtle">{t('rates.manualHint')}</p>
    </div>
  )
}
