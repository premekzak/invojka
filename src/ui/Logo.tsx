import { cn } from './primitives'

/* The Invojka mark (the owner's choice "F6", 2026-10-17): a receipt with a soft top and three torn teeth, carrying a lowercase i.
   Light: espresso receipt, cream stem, orange dot. Dark: orange receipt, near-black stem, cream dot.
   The same shape is the favicon in index.html; keep the two in step. */
export const LOGO_RECEIPT = 'M10 2H38Q43 2 43 7V46L36.67 40L30.33 46L24 40L17.67 46L11.33 40L5 46V7Q5 2 10 2Z'

export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" className={cn('shrink-0', className)}>
      <path d={LOGO_RECEIPT} className="fill-brand" />
      <rect x="19" y="17.5" width="10" height="15" rx="1.5" className="fill-brand-fg" />
      <circle cx="24" cy="10.3" r="4.8" className="fill-brand-dot" />
    </svg>
  )
}
