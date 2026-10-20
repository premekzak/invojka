import type { Customer, Invoice, Settings } from './schema'

/** The first steps after onboarding, in order: a customer, an invoice, the invoice's look, and a bookmark to find Invojka again. */
export const FIRST_STEPS = ['customer', 'invoice', 'look', 'bookmark'] as const
export type FirstStep = (typeof FIRST_STEPS)[number]

/**
 * The checklist on Home with each step done or not, or undefined when it's hidden: never started (set up before it
 * existed), closed, or all done. Invojka sees the first three in the data; a bookmark only when ticked by hand.
 */
export function firstSteps(settings: Settings, customers: Customer[], invoices: Invoice[]): { step: FirstStep; done: boolean }[] | undefined {
  const ticked = settings.ui.firstSteps
  if (!ticked) return undefined
  const look = settings.invoice
  const done: Record<FirstStep, boolean> = {
    customer: customers.some((c) => !c.archived),
    invoice: invoices.some((i) => i.status !== 'draft'),
    look: !!look.logo || !!look.stamp || look.color !== 'neutral' || ticked.includes('look'),
    bookmark: ticked.includes('bookmark'),
  }
  const list = FIRST_STEPS.map((step) => ({ step, done: done[step] }))
  return list.every((s) => s.done) ? undefined : list
}
