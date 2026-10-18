import { format, parseISO } from 'date-fns'

/**
 * Languages an invoice can be printed in. The app itself speaks Czech and English only; an invoice can also go out
 * in German or Slovak (src/pdf/labels.ts has the texts).
 */
export const INVOICE_LANGS = ['cs', 'en', 'de', 'sk'] as const
export type InvoiceLang = (typeof INVOICE_LANGS)[number]

/** Each language in its own name, for the pickers. */
export const LANG_NAMES: Record<InvoiceLang, string> = { cs: 'Čeština', en: 'English', de: 'Deutsch', sk: 'Slovenčina' }

/** The locale numbers and amounts are written in. */
export const LOCALES: Record<InvoiceLang, string> = { cs: 'cs-CZ', en: 'en-GB', de: 'de-DE', sk: 'sk-SK' }

/** A date as each language writes it on an invoice: 5. 10. 2026, 5 Oct 2026, 05.10.2026. */
export function formatDocDate(iso: string, lang: InvoiceLang): string {
  return format(parseISO(iso), lang === 'en' ? 'd MMM yyyy' : lang === 'de' ? 'dd.MM.yyyy' : 'd. M. yyyy')
}
