import { Check } from 'lucide-react'
import { cn } from './primitives'

/**
 * The steps of a longer task as a numbered row: the current one filled with the accent, finished ones ticked, the rest muted.
 * Every step is a button; the owner of the task decides in `onGo` whether a later step can be opened yet.
 */
export function Steps({ label, steps, current, onGo }: { label: string; steps: string[]; current: number; onGo: (step: number) => void }) {
  return (
    <nav aria-label={label}>
      <ol className="flex flex-wrap items-center gap-x-1 gap-y-2">
        {steps.map((name, i) => {
          const n = i + 1
          const now = n === current
          return (
            <li key={name} className="flex items-center gap-1">
              {i > 0 && <span aria-hidden="true" className="h-px w-5 bg-line-strong max-md:w-2" />}
              <button type="button" aria-current={now ? 'step' : undefined} onClick={() => onGo(n)}
                className={cn('flex items-center gap-2 rounded-lg py-1 pr-3 pl-1 text-sm leading-label whitespace-nowrap transition-colors hover:bg-tint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-link',
                  now ? 'font-semibold text-fg' : 'text-fg-muted')}>
                <span className={cn('flex size-6 items-center justify-center rounded-full text-xs font-semibold tabular-nums', now ? 'bg-accent text-accent-fg' : 'bg-surface-2 text-fg-muted')}>
                  {n < current ? <Check aria-hidden="true" className="size-3.5" /> : n}
                </span>
                {name}
              </button>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
