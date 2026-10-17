import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import cs from './cs'
import en from './en'

export type Lang = 'cs' | 'en'

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
  lng: stored ?? (navigator.language.startsWith('cs') ? 'cs' : 'en'),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
})

/** The UI language lives in settings.json; localStorage only remembers it for the screens before a folder is open. */
export function setUiLanguage(lang: Lang) {
  if (i18n.language !== lang) void i18n.changeLanguage(lang)
  try {
    localStorage.setItem('invojka.lang', lang)
  } catch {
    /* storage unavailable */
  }
}

export default i18n
