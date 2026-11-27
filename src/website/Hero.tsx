import { useEffect, useState } from 'react'
import { cn } from '@/ui/primitives'
import { cz } from './text'

/* The headline of the page: a fixed sentence, and under it the advantages taking turns in the page's spot colour.
   Tried and turned down by the owner on 2026-11-27, so don't bring them back: a marker stroke under the sentence, the
   sentence in a stamp frame, a receipt strip, a dark label, a small rectangular stamp and a round seal.

   TRIAL (2026-11-27): "pojďme zkusit nějakou doplňkovou výraznou barvu, kterou budeme ale hodně šetřit". The spot
   colour (--site-spot in site.css) is used in this one place only. The chooser in the corner (dev server only) or
   ?spot=<id> tries the candidates; when one is picked, put its value into site.css and remove the chooser and SPOTS. */
const SPOTS = [
  ['blue', 'Modrá', 'oklch(0.45 0.27 268)'],
  ['petrol', 'Petrolejová', 'oklch(0.46 0.1 205)'],
  ['raspberry', 'Malinová', 'oklch(0.5 0.22 358)'],
  ['emerald', 'Smaragdová', 'oklch(0.47 0.13 158)'],
  ['violet', 'Fialová', 'oklch(0.45 0.22 300)'],
  ['rust', 'Rezavá (dosud)', 'var(--color-link)'],
] as const

/** What Invojka gives, one at a time. Short: two lines at most in the masthead's left column. */
const ADVANTAGES = ['Data zůstávají ve vašem počítači.', 'Bez registrace a bez účtu.', 'Bez předplatného a bez limitů.', 'Funguje i bez internetu.']

export function Headline() {
  const [i, setI] = useState(0)
  const [spot, setSpot] = useState<string>(() => {
    const asked = new URLSearchParams(location.search).get('spot')
    return SPOTS.find(([id]) => id === asked)?.[0] ?? 'blue'
  })
  useEffect(() => { document.documentElement.style.setProperty('--site-spot', SPOTS.find(([id]) => id === spot)![2]) }, [spot])
  useEffect(() => {
    // With reduced motion the first advantage stays.
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const timer = setInterval(() => { if (!document.hidden) setI((n) => (n + 1) % ADVANTAGES.length) }, 3400)
    return () => clearInterval(timer)
  }, [])
  return (
    <h1 className="font-display text-4xl leading-[1.1] font-semibold lg:pt-4">
      Fakturujte zdarma.
      {/* Screen readers get one advantage; the captions say the rest. */}
      <span className="sr-only"> {ADVANTAGES[0]}</span>
      {/* Room for two lines is kept, so the captions under it don't jump. */}
      <span aria-hidden="true" className="block min-h-[2.2em]"><span key={i} className="hero-swap">{cz(ADVANTAGES[i])}</span></span>
      {import.meta.env.DEV && (
        <span className="fixed bottom-3 left-3 z-[60] flex gap-1 rounded-lg bg-surface p-1 font-sans text-xs font-medium ring-1 ring-rule">
          {SPOTS.map(([id, name, value]) => (
            <button key={id} type="button" onClick={() => setSpot(id)} className={cn('flex items-center gap-1.5 rounded px-2 py-1', id === spot ? 'bg-surface-2 text-fg' : 'text-fg-muted hover:bg-tint')}>
              <span className="size-2.5 rounded-full" style={{ background: value }} /> {name}
            </button>
          ))}
        </span>
      )}
    </h1>
  )
}
