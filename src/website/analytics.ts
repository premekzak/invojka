/* Measuring the website with Google Analytics (the owner's decision, 2026-11-27, knowing it goes against "no tracking
   on the website" in docs/launch.md: he runs ads and wants conversions and micro-events). The rules that keep it
   honest (docs/website.md#measuring):

   - Nothing is loaded from Google and nothing is sent until the visitor allows it in the banner. Refusing is as easy as
     allowing, and the choice can be changed from the footer.
   - Only the website is measured. The app itself never is, and no invoice data exists here anyway.
   - Events carry only what happened on the page (which scene, which question, which button), never anything typed.
   - Only analytics storage is granted; the advertising signals stay denied.

   CONTAINER is the owner's Tag Manager container "invojka weby" (2026-11-27). The page pushes plain events into the
   data layer; the container turns them into GA4 events for the property G-56ZL175GS5 with one Google tag and one event
   tag for all of them (scripts/gtm-container.json is the import file of that setup). The first id he pasted,
   GTM-MV25KJ7Z, was not a container but the Google tag of that property; it is no longer loaded. */

const CONTAINER = 'GTM-NCD56WJ3'
const KEY = 'invojka-web-measuring'

export type Consent = 'granted' | 'denied' | undefined

declare global {
  interface Window { dataLayer?: unknown[] }
}

/** Every event the page sends; docs/website.md lists them, and the container's trigger and variables are named after them. */
export type SiteEvent =
  | { event: 'download_click'; place: 'masthead' | 'closing' }
  | { event: 'scene_view'; scene: string }
  | { event: 'scene_complete'; scene: string }
  | { event: 'scene_pause'; scene: string; phase: number }
  | { event: 'scene_resume'; scene: string; phase: number }
  | { event: 'scene_caption_click'; scene: string; phase: number }
  | { event: 'faq_open'; question: string }
  | { event: 'scroll_depth'; percent: 25 | 50 | 75 | 100 }
  /** A link that leaves the page: the source code, or the demo (with where on the page it was). */
  | { event: 'outbound_click'; target: 'github' | 'demo'; place?: 'masthead' | 'closing' }

/** Google's commands must be the `arguments` object itself in the data layer, not an array. */
function gtag(..._args: unknown[]) {
  // eslint-disable-next-line prefer-rest-params
  (window.dataLayer ??= []).push(arguments)
}

export function readConsent(): Consent {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'granted' || v === 'denied' ? v : undefined
  } catch {
    return undefined
  }
}

/** What happened before the visitor answered the banner: sent if they allow, dropped if they refuse. */
let waiting: SiteEvent[] = []
let loaded = false

/** Every parameter any event has. The data layer remembers values, so each push clears the ones its event doesn't use;
 *  otherwise a question's text would ride along with the next scroll event. */
const BLANK = { scene: undefined, place: undefined, phase: undefined, question: undefined, percent: undefined, target: undefined }

const send = (e: SiteEvent) => (window.dataLayer ??= []).push({ ...BLANK, ...e })

function load() {
  if (loaded) return
  loaded = true
  gtag('consent', 'default', { analytics_storage: 'granted', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' })
  window.dataLayer!.push({ 'gtm.start': Date.now(), event: 'gtm.js' })
  waiting.forEach(send)
  waiting = []
  // The dev server never talks to Google; the events are printed instead (see `track`).
  if (import.meta.env.DEV) return
  const script = document.createElement('script')
  script.async = true
  script.src = `https://www.googletagmanager.com/gtm.js?id=${CONTAINER}`
  document.head.appendChild(script)
}

/** Remember the visitor's choice. Allowing loads the container; refusing after allowing stops the storage at once. */
export function setConsent(choice: 'granted' | 'denied') {
  try { localStorage.setItem(KEY, choice) } catch { /* Private windows: the choice lasts for this visit. */ }
  if (choice === 'granted') load()
  else {
    waiting = []
    if (loaded) gtag('consent', 'update', { analytics_storage: 'denied' })
  }
}

/** Call once at start: a visitor who allowed measuring before is measured from the first moment. */
export function startMeasuring() {
  if (readConsent() === 'granted') load()
}

/** Record something the visitor did. Nothing leaves the browser without consent. */
export function track(e: SiteEvent) {
  const consent = readConsent()
  if (consent === 'denied') return
  if (import.meta.env.DEV) console.debug('[measure]', e)
  if (loaded) send(e)
  else if (consent === undefined) waiting.push(e)
}
