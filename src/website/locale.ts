import { formatMoney } from '@/domain/money'
import cs from '@/i18n/cs'
import en from '@/i18n/en'

/* The website in Czech (website/index.html) and in English (website/en/index.html): the same page and scenes, with the
   language fixed by the page's <html lang>. The website's own sentences are written where they are used, as
   tr('česky', 'in English'); the scenes take the app's texts from its own cs.ts and en.ts, so they read as the app does
   in that language. Names of the made-up Czech businesses stay as they are in both. */

export const LANG: 'cs' | 'en' = document.documentElement.lang === 'en' ? 'en' : 'cs'

/** The app's own texts in the page's language. */
export const app = LANG === 'en' ? en : cs

/** One of the website's own sentences in the page's language. */
export const tr = (czech: string, english: string) => (LANG === 'en' ? english : czech)

/** Money as the app prints it in this language; `minor` is in haléře. */
export const money = (minor: number, whole = false) => formatMoney(minor, 'CZK', LANG, whole)

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** A date as the app prints it: "27. 11. 2026" or "27 Nov 2026". */
export const date = (day: number, month: number, year: number) => (LANG === 'en' ? `${day} ${MONTHS[month - 1]} ${year}` : `${day}. ${month}. ${year}`)

/** A file's date in the system's folder window, written in the Czech form: "14. 01. 2026 9:12" becomes "14/01/2026 9:12". */
export const fileDate = (czech: string) => (LANG === 'en' ? czech.replace(/\. /g, '/') : czech)

/** The locale for number formats that the app's helpers don't cover. */
export const LOCALE = LANG === 'en' ? 'en-GB' : 'cs-CZ'
