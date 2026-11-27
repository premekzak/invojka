import { useEffect, useState } from 'react'
import { cn } from '@/ui/primitives'
import { readConsent, setConsent, type Consent } from './analytics'

const OPEN = 'invojka-web:measuring'

/** Opens the banner again (the footer's "Nastavení měření"), so a choice can be changed. */
export const openConsent = () => window.dispatchEvent(new Event(OPEN))

const button = 'inline-flex h-9 items-center justify-center rounded-lg px-4 text-sm leading-label font-medium whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-link'

/**
 * The question about measuring, at the bottom of the window until answered. Both answers are buttons of the same size
 * side by side; neither is the accent, because the page's one accent action is the download. Nothing is measured
 * before "Povolit měření".
 */
export function ConsentBanner() {
  const [choice, setChoice] = useState<Consent>(readConsent)
  const [open, setOpen] = useState(() => readConsent() === undefined)
  useEffect(() => {
    const show = () => setOpen(true)
    window.addEventListener(OPEN, show)
    return () => window.removeEventListener(OPEN, show)
  }, [])
  if (!open) return null
  const answer = (c: 'granted' | 'denied') => { setConsent(c); setChoice(c); setOpen(false) }
  return (
    <div role="region" aria-label="Měření návštěvnosti" className="fixed inset-x-0 bottom-0 z-50 p-3 sm:p-4">
      <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-x-6 gap-y-3 rounded-2xl bg-surface px-5 py-4 ring-1 ring-line-strong/40">
        <p className="min-w-0 flex-1 basis-80 text-sm text-fg">
          Smíme na tomto webu měřit návštěvnost pomocí Google Analytics? Pomáhá nám to zjistit, co na webu funguje.{' '}
          <span className="text-fg-muted">Aplikace Invojka sama nic neměří a vaše faktury nikam neposílá.</span>
        </p>
        <div className="flex gap-2">
          <button type="button" onClick={() => answer('denied')} className={cn(button, 'border border-line bg-surface-2 text-fg hover:bg-surface-3')} aria-pressed={choice === 'denied'}>Odmítnout</button>
          <button type="button" onClick={() => answer('granted')} className={cn(button, 'border border-line bg-surface-2 text-fg hover:bg-surface-3')} aria-pressed={choice === 'granted'}>Povolit měření</button>
        </div>
      </div>
    </div>
  )
}
