import { useSyncExternalStore } from 'react'

// Hash routing (#/invoices/123?status=overdue) works from file:// without any server configuration.

const subscribe = (cb: () => void) => {
  window.addEventListener('hashchange', cb)
  return () => window.removeEventListener('hashchange', cb)
}
const getHash = () => window.location.hash

export interface Route {
  /** Path segments, e.g. ['invoices', '123']. */
  path: string[]
  query: URLSearchParams
}

export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, getHash)
  const [p, q = ''] = hash.replace(/^#\/?/, '').split('?')
  return { path: p.split('/').filter(Boolean), query: new URLSearchParams(q) }
}

export const navigate = (path: string) => {
  window.location.hash = path.startsWith('/') ? path : `/${path}`
}
