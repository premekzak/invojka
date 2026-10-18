import { amountDue, displayStatus } from './invoice'
import type { Minor } from './money'
import type { Invoice } from './schema'

/**
 * Bank statements read on the user's computer and matched to unpaid invoices by variable symbol and amount.
 * Nothing is sent anywhere. Formats: GPC (the Czech banks' fixed-width ABO statement), CAMT.053 (ISO 20022 XML) and
 * the banks' CSV exports, whose columns are found by their Czech or English names. See docs/bank-import.md.
 */

/** One incoming payment from a statement. */
export interface BankPayment {
  /** yyyy-mm-dd */
  date: string
  /** Minor units, always positive (only credits are kept). */
  amount: Minor
  currency: string
  /** Without leading zeros; '' when the payment has none. */
  vs: string
  /** Who paid, as the bank wrote it. */
  name: string
  /** The payer's message, when the format has one. */
  message: string
}

export type StatementFormat = 'gpc' | 'camt' | 'csv'

export class StatementError extends Error {
  constructor(readonly reason: 'empty' | 'unknown' | 'noColumns') { super(reason) }
}

/** Text of a statement file: UTF-8, or Windows-1250 (what GPC and many Czech CSV exports use) when UTF-8 doesn't fit. */
export function decodeStatement(bytes: Uint8Array): string {
  const utf8 = new TextDecoder('utf-8').decode(bytes)
  const replacementChar = String.fromCharCode(0xfffd)
  const byteOrderMark = String.fromCharCode(0xfeff)
  return utf8.includes(replacementChar) ? new TextDecoder('windows-1250').decode(bytes)
    : utf8.startsWith(byteOrderMark) ? utf8.slice(1) : utf8
}

const stripZeros = (s: string) => s.replace(/^0+/, '')

/** ISO 4217 numeric codes GPC uses for the currency; CZK is 0203. */
const NUMERIC_CURRENCY: Record<string, string> = { '0203': 'CZK', '0978': 'EUR', '0840': 'USD', '0826': 'GBP', '0554': 'NZD', '0756': 'CHF', '0985': 'PLN' }

/** DDMMRR → yyyy-mm-dd (years 00–79 are 20xx). */
const gpcDate = (d: string) => {
  const yy = Number(d.slice(4, 6))
  return `${yy < 80 ? 2000 + yy : 1900 + yy}-${d.slice(2, 4)}-${d.slice(0, 2)}`
}

/**
 * GPC / ABO statement: fixed-width 128-character records, "074" a statement header, "075" a movement (the layout as
 * Fio documents it). Posting code 2 is a credit; 1, 4 and 5 (debit and reversals) are skipped.
 */
export function parseGpc(text: string): BankPayment[] {
  const out: BankPayment[] = []
  let statementDate = ''
  for (const line of text.split(/\r?\n/)) {
    if (line.startsWith('074')) statementDate = gpcDate(line.slice(108, 114))
    if (!line.startsWith('075') || line[60] !== '2') continue
    const due = line.slice(122, 128)
    out.push({
      date: /^\d{6}$/.test(due) && due !== '000000' ? gpcDate(due) : statementDate,
      amount: Number(line.slice(48, 60)),
      currency: NUMERIC_CURRENCY[line.slice(118, 122)] ?? 'CZK',
      vs: stripZeros(line.slice(61, 71).trim()),
      name: line.slice(97, 117).trim(),
      message: '',
    })
  }
  return out
}

const tag = (xml: string, name: string) => new RegExp(`<(?:\\w+:)?${name}\\b[^>]*>([\\s\\S]*?)</(?:\\w+:)?${name}>`).exec(xml)?.[1]?.trim()
const unescape = (s: string) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&')

/** The variable symbol in free text: "VS 123", "VS:123", "/VS123/"… */
const vsIn = (text: string) => /\bVS\s*[:.]?\s*0*(\d{1,10})\b/i.exec(text)?.[1] ?? ''

/**
 * CAMT.053 (ISO 20022 bank-to-customer statement): one <Ntry> per movement, credits marked CRDT. Czech banks put the
 * variable symbol in the structured reference, in the end-to-end id ("VS123/SS/KS") or in the message.
 */
export function parseCamt(xml: string): BankPayment[] {
  const out: BankPayment[] = []
  for (const [, entry] of xml.matchAll(/<(?:\w+:)?Ntry\b[^>]*>([\s\S]*?)<\/(?:\w+:)?Ntry>/g)) {
    if (tag(entry, 'CdtDbtInd') !== 'CRDT' || /<(?:\w+:)?RvslInd>true</.test(entry)) continue
    const amt = /<(?:\w+:)?Amt\b[^>]*Ccy="([A-Z]{3})"[^>]*>([\d.]+)</.exec(entry)
    if (!amt) continue
    const booked = tag(tag(entry, 'BookgDt') ?? '', 'Dt') ?? tag(tag(entry, 'BookgDt') ?? '', 'DtTm') ?? tag(tag(entry, 'ValDt') ?? '', 'Dt') ?? ''
    const ref = tag(tag(entry, 'CdtrRefInf') ?? '', 'Ref') ?? ''
    const e2e = tag(entry, 'EndToEndId') ?? ''
    const message = unescape([...entry.matchAll(/<(?:\w+:)?Ustrd>([\s\S]*?)<\/(?:\w+:)?Ustrd>/g)].map((m) => m[1]!.trim()).join(' '))
    const vs = vsIn(ref) || (/^\d{1,10}$/.test(ref) ? stripZeros(ref) : '') || vsIn(e2e) || (/^\d{1,10}$/.test(e2e) ? stripZeros(e2e) : '') || vsIn(message)
    out.push({
      date: booked.slice(0, 10),
      amount: Math.round(Number(amt[2]) * 100),
      currency: amt[1]!,
      vs,
      name: unescape(tag(tag(tag(entry, 'RltdPties') ?? '', 'Dbtr') ?? '', 'Nm') ?? ''),
      message,
    })
  }
  return out
}

/** Splits one CSV line, honouring quotes ("a;b";c). */
function splitCsv(line: string, sep: string): string[] {
  const cells: string[] = []
  let cell = '', quoted = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') { cell += '"'; i++ }
      else if (ch === '"') quoted = false
      else cell += ch
    } else if (ch === '"') quoted = true
    else if (ch === sep) { cells.push(cell); cell = '' }
    else cell += ch
  }
  cells.push(cell)
  return cells.map((c) => c.trim())
}

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim()

/** Column names the banks use (Fio, KB, ČSOB, Air Bank, Raiffeisenbank, Moneta, mBank, ČS…), without diacritics. */
const COLUMNS = {
  vs: [/^vs$/, /^variabilni symbol$/, /^variable symbol$/],
  amount: [/^objem$/, /^castka$/, /^zauctovana castka$/, /^castka v mene uctu$/, /^castka transakce$/, /^amount$/, /^castka \(czk\)$/],
  date: [/^datum$/, /^datum zauctovani$/, /^datum provedeni$/, /^datum splatnosti$/, /^zauctovano$/, /^date$/, /^booking date$/, /^datum pohybu$/],
  currency: [/^mena$/, /^mena uctu$/, /^currency$/],
  name: [/^nazev protiuctu$/, /^nazev protistrany$/, /^protistrana$/, /^nazev uctu protistrany$/, /^counterparty name$/, /^jmeno protistrany$/],
  message: [/^zprava pro prijemce$/, /^zprava$/, /^poznamka$/, /^message$/, /^popis$/],
} as const

/** "1 234,50", "-1234.50", "1.234,50 CZK" → minor units. */
function csvAmount(s: string): number | undefined {
  let t = s.replace(/[\s ]/g, '').replace(/[A-Za-z]{3}$/, '')
  if (/,\d{1,2}$/.test(t)) t = t.replace(/\./g, '').replace(',', '.')
  else t = t.replace(/,/g, '')
  const n = Number(t)
  return Number.isFinite(n) && t !== '' ? Math.round(n * 100) : undefined
}

/** "5.10.2026", "05.10.2026 14:03", "2026-10-05" → yyyy-mm-dd */
function csvDate(s: string): string {
  const cz = /^(\d{1,2})\.\s?(\d{1,2})\.\s?(\d{4})/.exec(s)
  if (cz) return `${cz[3]}-${cz[2]!.padStart(2, '0')}-${cz[1]!.padStart(2, '0')}`
  return /^\d{4}-\d{2}-\d{2}/.exec(s)?.[0] ?? ''
}

/**
 * A bank's CSV export. The header row is the first line that names a variable symbol and an amount column (Fio puts a
 * few summary lines above it); the separator is whichever of ; , or tab that row uses most. Positive amounts are credits.
 */
export function parseCsv(text: string, fallbackCurrency = 'CZK'): BankPayment[] {
  const lines = text.split(/\r?\n/)
  for (let h = 0; h < Math.min(lines.length, 30); h++) {
    const line = lines[h]!
    const sep = [';', '\t', ','].sort((a, b) => line.split(b).length - line.split(a).length)[0]!
    const head = splitCsv(line, sep).map(norm)
    const find = (k: keyof typeof COLUMNS) => head.findIndex((c) => COLUMNS[k].some((re) => re.test(c)))
    const col = { vs: find('vs'), amount: find('amount'), date: find('date'), currency: find('currency'), name: find('name'), message: find('message') }
    if (col.vs < 0 || col.amount < 0) continue
    const out: BankPayment[] = []
    for (const row of lines.slice(h + 1)) {
      if (!row.trim()) continue
      const cells = splitCsv(row, sep)
      const amount = csvAmount(cells[col.amount] ?? '')
      if (amount === undefined || amount <= 0) continue
      out.push({
        date: col.date >= 0 ? csvDate(cells[col.date] ?? '') : '',
        amount,
        currency: (col.currency >= 0 && /^[A-Z]{3}$/.test(cells[col.currency] ?? '') ? cells[col.currency]! : fallbackCurrency),
        vs: stripZeros((cells[col.vs] ?? '').replace(/\D/g, '')),
        name: col.name >= 0 ? cells[col.name] ?? '' : '',
        message: col.message >= 0 ? cells[col.message] ?? '' : '',
      })
    }
    return out
  }
  throw new StatementError('noColumns')
}

/** Recognises the format and reads the incoming payments. */
export function parseStatement(text: string): { format: StatementFormat; payments: BankPayment[] } {
  const t = text.trim()
  if (!t) throw new StatementError('empty')
  if (/^074/.test(t)) return { format: 'gpc', payments: parseGpc(t) }
  if (/<(?:\w+:)?BkToCstmrStmt\b/.test(t) || /camt\.05[34]/.test(t)) return { format: 'camt', payments: parseCamt(t) }
  if (t.startsWith('<')) throw new StatementError('unknown')
  return { format: 'csv', payments: parseCsv(t) }
}

export type MatchKind =
  /** Same variable symbol, currency and amount: almost certainly this invoice. */
  | 'exact'
  /** Same variable symbol and currency, a different amount: a partial or wrong payment, for the user to decide. */
  | 'amountDiffers'
  /** No usable variable symbol, but exactly one unpaid invoice of this amount, currency and customer name. */
  | 'byAmount'

export interface PaymentMatch { payment: BankPayment; invoice: Invoice; kind: MatchKind }

export interface MatchResult {
  matches: PaymentMatch[]
  /** Payments for invoices already marked paid (e.g. the same statement imported twice). */
  alreadyPaid: { payment: BankPayment; invoice: Invoice }[]
  /** Incoming payments that fit no invoice. */
  unmatched: BankPayment[]
}

const nameWords = (s: string) => norm(s).split(/[^a-z0-9]+/).filter((w) => w.length > 2)

/**
 * Pairs incoming payments with invoices and proformas waiting for payment. Each invoice is matched at most once,
 * exact matches first, so two payments with the same symbol don't both settle one invoice.
 */
export function matchPayments(payments: BankPayment[], invoices: Invoice[]): MatchResult {
  const open = invoices.filter((i) => (i.kind === 'invoice' || i.kind === 'proforma') && i.status === 'issued' && amountDue(i) > 0)
  const paid = invoices.filter((i) => (i.kind === 'invoice' || i.kind === 'proforma') && i.status === 'paid')
  const taken = new Set<string>()
  const result: MatchResult = { matches: [], alreadyPaid: [], unmatched: [] }
  const vsOf = (i: Invoice) => stripZeros(i.variableSymbol)
  const rest: BankPayment[] = []

  for (const p of payments) {
    const inv = p.vs ? open.find((i) => !taken.has(i.id) && vsOf(i) === p.vs && i.currency === p.currency && amountDue(i) === p.amount) : undefined
    if (inv) { taken.add(inv.id); result.matches.push({ payment: p, invoice: inv, kind: 'exact' }) }
    else rest.push(p)
  }
  for (const p of rest) {
    const byVs = p.vs ? open.find((i) => !taken.has(i.id) && vsOf(i) === p.vs && i.currency === p.currency) : undefined
    if (byVs) { taken.add(byVs.id); result.matches.push({ payment: p, invoice: byVs, kind: 'amountDiffers' }); continue }
    const done = p.vs ? paid.find((i) => vsOf(i) === p.vs && i.currency === p.currency) : undefined
    if (done) { result.alreadyPaid.push({ payment: p, invoice: done }); continue }
    // Without a symbol: one open invoice of exactly this amount whose customer's name shares a word with the payer.
    const words = nameWords(p.name)
    const byAmount = open.filter((i) => !taken.has(i.id) && i.currency === p.currency && amountDue(i) === p.amount
      && words.some((w) => nameWords(i.customerSnapshot.name).includes(w)))
    if (byAmount.length === 1) { taken.add(byAmount[0]!.id); result.matches.push({ payment: p, invoice: byAmount[0]!, kind: 'byAmount' }); continue }
    result.unmatched.push(p)
  }
  return result
}

/** Overdue invoices first, so the list reads like the to-do it is. */
export const sortMatches = (m: PaymentMatch[], on: string) =>
  [...m].sort((a, b) => Number(displayStatus(b.invoice, on) === 'overdue') - Number(displayStatus(a.invoice, on) === 'overdue') || a.payment.date.localeCompare(b.payment.date))
