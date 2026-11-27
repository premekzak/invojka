/* Measuring the website with Google Tag Manager (the owner's decision, 2026-11-27, knowing it goes against "no
   tracking on the website" in docs/launch.md: he runs ads and wants conversions and micro-events). The rules that keep
   it honest (docs/website.md#measuring):

   - Nothing is loaded from Google and nothing is sent until the visitor allows it in the banner. Refusing is as easy as
     allowing, and the choice can be changed from the footer.
   - Only the website is measured. The app itself never is, and no invoice data exists here anyway.
   - Events carry only what happened on the page (which scene, which question, which button), never anything typed.
   - Only analytics storage is granted; the advertising signals stay denied.

   The page pushes events into `dataLayer`; what is done with them (GA4 tags) is set up in the GTM container. */

const GTM_ID = 'GTM-MV25KJ7Z'
const KEY = 'invojka-web-measuring'

export type Consent = 'granted' | 'denied' | undefined

declare global {
  interface Window { dataLayer?: unknown[] }
}

/** Every event the page sends, so the list in docs/website.md and the GTM container can be kept in step with it. */
export type SiteEvent =
  | { event: 'download_click'; place: 'masthead' | 'closing' }
  | { event: 'scene_view'; scene: string }
  | { event: 'scene_complete'; scene: string }
  | { event: 'scene_pause'; scene: string; phase: number }
  | { event: 'scene_resume'; scene: string; phase: number }
  | { event: 'scene_caption_click'; scene: string; phase: number }
  | { event: 'faq_open'; question: string }
  | { event: 'scroll_depth'; percent: 25 | 50 | 75 | 100 }
  | { event: 'outbound_click'; target: string }

const layer = () => (window.dataLayer ??= [])

/** Google's consent calls need the `arguments` object itself in the data layer, not an array. */
function gtag(..._args: unknown[]) {
  // eslint-disable-next-line prefer-rest-params
  layer().push(arguments)
}

export function readConsent(): Consent {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'granted' || v === 'denied' ? v : undefined
  } catch {
    return undefined
  }
}

let loaded = false
function load() {
  if (loaded) return
  loaded = true
  gtag('consent', 'default', { analytics_storage: 'granted', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' })
  layer().push({ 'gtm.start': Date.now(), event: 'gtm.js' })
  // The dev server never talks to Google; the events are printed instead (see `track`).
  if (import.meta.env.DEV) return
  const script = document.createElement('script')
  script.async = true
  script.src = `https://www.googletagmanager.com/gtm.js?id=${GTM_ID}`
  document.head.appendChild(script)
}

/** Remember the visitor's choice. Allowing loads the container; refusing after allowing takes effect on the next visit. */
export function setConsent(choice: 'granted' | 'denied') {
  try { localStorage.setItem(KEY, choice) } catch { /* Private windows: the choice lasts for this visit. */ }
  if (choice === 'granted') load()
  else if (loaded) gtag('consent', 'update', { analytics_storage: 'denied' })
}

/** Call once at start: a visitor who allowed measuring before is measured from the first moment. */
export function startMeasuring() {
  if (readConsent() === 'granted') load()
}

/**
 * Record something the visitor did. Events wait in the data layer; they leave the browser only once the container is
 * loaded, which needs the visitor's consent. Before a choice they are kept, so a later "yes" still counts the visit.
 */
export function track(e: SiteEvent) {
  if (readConsent() === 'denied') return
  layer().push(e)
  if (import.meta.env.DEV) console.debug('[measure]', e)
}
