import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import cs from './cs'
import en from './en'

export type Lang = 'cs' | 'en'

const isLang = (v: string | null | undefined): v is Lang => v === 'cs' || v === 'en'

/**
 * `?lang=en` (or `cs`) in the page address picks the UI language for as long as it is there (the owner, 2026-10-18), e.g.
 * to send someone the showcase in English. It is never saved; choosing a language in Settings drops it from the address.
 */
let urlLang: Lang | undefined = (() => {
  try {
    const v = new URLSearchParams(location.search).get('lang')
    return isLang(v) ? v : undefined
  } catch {
    return undefined
  }
})()

const stored = (() => {
  try {
    // 'invoicer.lang' is the key from before the rename to Invojka.
    return (localStorage.getItem('invojka.lang') ?? localStorage.getItem('invoicer.lang')) as Lang | null
  } catch {
    return null
  }
})()

void i18n.use(initReactI18next).init({
  resources: { cs: { translation: cs }, en: { translation: en } },
  lng: urlLang ?? stored ?? (navigator.language.startsWith('cs') ? 'cs' : 'en'),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
})

/**
 * The UI language lives in settings.json; localStorage only remembers it for the screens before a folder is open.
 * A `?lang=` in the address wins over both while it is there.
 */
export function setUiLanguage(lang: Lang) {
  const shown = urlLang ?? lang
  if (i18n.language !== shown) void i18n.changeLanguage(shown)
  if (urlLang) return
  try {
    localStorage.setItem('invojka.lang', lang)
  } catch {
    /* storage unavailable */
  }
}

/** The user picked a language in Settings: drop `?lang=` from the address so their choice applies (and is saved). */
export function clearUrlLanguage() {
  if (!urlLang) return
  urlLang = undefined
  try {
    const url = new URL(location.href)
    url.searchParams.delete('lang')
    history.replaceState(history.state, '', url)
  } catch {
    /* address can't be changed (e.g. some file:// cases): the override is still gone for this page */
  }
}

export default i18n
