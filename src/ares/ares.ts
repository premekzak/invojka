import type { Customer } from '@/domain/schema'

// ARES, the Czech business register (ares.gov.cz). Its REST API allows browser requests (CORS `*`, also from file://).
// A request carries only what the user typed into the lookup box, an IČ or part of a company name, never invoice data.

const API = 'https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty'

/** The parts of an ARES record the app uses. */
export interface AresSubject {
  ico: string
  obchodniJmeno: string
  dic?: string
  datumZaniku?: string
  sidlo?: {
    nazevStatu?: string
    nazevObce?: string
    nazevMestskehoObvodu?: string
    nazevCastiObce?: string
    nazevUlice?: string
    cisloDomovni?: number
    typCisloDomovni?: number
    cisloOrientacni?: number
    cisloOrientacniPismeno?: string
    psc?: number
    textovaAdresa?: string
  }
}

export interface AresParty {
  ic: string
  name: string
  dic: string
  address: Customer['address']
  /** Set when the business no longer exists. */
  ceased?: string
}

/** An IČ as typed (spaces allowed, leading zeros optional) → 8 digits, or undefined if it can't be one. */
export function normalizeIc(typed: string): string | undefined {
  const d = typed.replace(/\s/g, '')
  return /^\d{6,8}$/.test(d) ? d.padStart(8, '0') : undefined
}

const zip = (psc?: number) => (psc ? String(psc).padStart(5, '0').replace(/^(\d{3})(\d{2})$/, '$1 $2') : '')

/** An ARES record → the fields of a customer or supplier, written the way Czech invoices write them. */
export function toParty(s: AresSubject): AresParty {
  const a = s.sidlo ?? {}
  // "Budějovická 778/3a"; a village without streets uses its own name ("Lhota 12"); "č. ev." marks a recreational number.
  const house = a.cisloDomovni
    ? `${a.typCisloDomovni === 2 ? 'č. ev. ' : ''}${a.cisloDomovni}${a.cisloOrientacni ? `/${a.cisloOrientacni}${a.cisloOrientacniPismeno ?? ''}` : ''}`
    : ''
  const place = a.nazevUlice ?? (a.nazevCastiObce || a.nazevObce)
  const structured = !!(a.nazevObce && place)
  return {
    ic: s.ico,
    name: s.obchodniJmeno.replace(/\s+/g, ' ').trim(),
    dic: s.dic ?? '',
    address: structured
      ? {
          street: [place, house].filter(Boolean).join(' '),
          zip: zip(a.psc),
          // Prague is written with its district ("Praha 4"), as ARES and the post do.
          city: a.nazevMestskehoObvodu?.startsWith(a.nazevObce!) ? a.nazevMestskehoObvodu : a.nazevObce!,
          country: a.nazevStatu ?? 'Česká republika',
        }
      // A seat abroad has only a text address.
      : { street: a.textovaAdresa ?? '', zip: '', city: '', country: a.nazevStatu ?? '' },
    ...(s.datumZaniku ? { ceased: s.datumZaniku } : {}),
  }
}

/** One business by IČ; undefined when ARES doesn't know it. */
export async function aresByIc(ic: string, signal?: AbortSignal): Promise<AresParty | undefined> {
  const res = await fetch(`${API}/${ic}`, { signal })
  if (res.status === 404) return undefined
  if (!res.ok) throw new Error(`ARES: HTTP ${res.status}`)
  return toParty((await res.json()) as AresSubject)
}

/** Businesses whose name contains the text, at most `count` of them. */
export async function aresByName(name: string, count = 8, signal?: AbortSignal): Promise<AresParty[]> {
  const res = await fetch(`${API}/vyhledat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ obchodniJmeno: name, pocet: count, start: 0 }),
    signal,
  })
  // ARES answers 400 when too many businesses match; the user should type more.
  if (res.status === 400) return []
  if (!res.ok) throw new Error(`ARES: HTTP ${res.status}`)
  const json = (await res.json()) as { ekonomickeSubjekty?: AresSubject[] }
  return (json.ekonomickeSubjekty ?? []).map(toParty)
}

/** An IČ (6–8 digits) is looked up directly; anything else of at least 3 characters searches by name. */
export function aresLookup(typed: string, signal?: AbortSignal): Promise<AresParty[]> | undefined {
  const ic = normalizeIc(typed)
  if (ic) return aresByIc(ic, signal).then((p) => (p ? [p] : []))
  return typed.trim().length >= 3 ? aresByName(typed.trim(), 8, signal) : undefined
}
