import { Monitor, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

const KEY = 'invojka.desktopNoticeSeen'
const QUERY = '(max-width: 767px)'

const seen = () => {
  try {
    return sessionStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

/**
 * On a phone-sized screen: Invojka is a desktop app (mobile browsers can't open a folder on disk), but the layout still
 * holds, so people can look around, e.g. in the showcase (the owner, 2026-10-18). Closed once per visit.
 */
export function DesktopNotice() {
  const { t } = useTranslation()
  const [small, setSmall] = useState(() => matchMedia(QUERY).matches)
  const [closed, setClosed] = useState(seen)

  useEffect(() => {
    const mq = matchMedia(QUERY)
    const on = () => setSmall(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])

  if (!small || closed) return null
  const close = () => {
    setClosed(true)
    try {
      sessionStorage.setItem(KEY, '1')
    } catch {
      /* storage unavailable: it just shows again next visit */
    }
  }
  return (
    <div role="status" className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <div className="animate-rise mx-auto flex max-w-md items-start gap-3 rounded-2xl border border-line bg-surface p-4 text-fg">
        <Monitor aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-fg-muted" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{t('mobile.title')}</p>
          <p className="mt-1 text-sm text-fg-muted">{t('mobile.body')}</p>
        </div>
        <button type="button" onClick={close} aria-label={t('mobile.close')}
          className="-m-1 rounded-lg p-1 text-fg-muted hover:bg-surface-2 hover:text-fg focus-visible:outline-2 focus-visible:outline-link">
          <X className="size-4" />
        </button>
      </div>
    </div>
  )
}
