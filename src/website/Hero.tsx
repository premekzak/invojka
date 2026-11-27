import { useEffect, useState } from 'react'
import { cz } from './text'

/* The headline of the page: a fixed sentence, and under it the advantages taking turns in the colour of links.
   Tried and turned down by the owner on 2026-11-27, so don't bring them back: a marker stroke under the sentence, the
   sentence in a stamp frame, a receipt strip, a dark label, a small rectangular stamp and a round seal. A spot colour
   outside the scheme (blue, petrol, raspberry, emerald, violet) was tried the same day and put off: "zatím to necháme
   bez doplňkové barvy". */

/** What Invojka gives, one at a time. Short: two lines at most in the masthead's left column. */
const ADVANTAGES = ['Data zůstávají ve vašem počítači.', 'Bez registrace a bez účtu.', 'Bez předplatného a bez limitů.', 'Funguje i bez internetu.']

export function Headline() {
  const [i, setI] = useState(0)
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
    </h1>
  )
}
