import Papa from 'papaparse'
import { nameKey, newId, normalizeIc } from '@/domain/id'
import { toMinor } from '@/domain/money'
import type { Customer, Invoice } from '@/domain/schema'
import type { VatMode } from '@/domain/vat'

// Importer for the CSV exports of the previous invoicing service (Czech headers, US dates, UTF-8 with BOM).

type Row = Record<string, string>
type FileKind = 'customers' | 'invoices'

/** Why a file can't be imported, so the UI can tell a beginner what to do. `detail` is the parser's message, for 'notCsv'. */
export class ImportError extends Error {
  constructor(readonly reason: 'empty' | 'notCsv' | 'swapped' | 'unknownFormat', readonly file: FileKind, readonly detail = '') {
    super(`${file}: ${reason}${detail ? ` (${detail})` : ''}`)
  }
}

// A column each file must have, and one that only the other file has (to spot swapped files).
const REQUIRED: Record<FileKind, string[]> = { customers: ['Firma'], invoices: ['Číslo dokladu', 'Vystaveno', 'Celkem'] }

function parse(text: string, file: FileKind): Row[] {
  const clean = text.replace(/^﻿/, '')
  if (!clean.trim()) throw new ImportError('empty', file)
  const res = Papa.parse<Row>(clean, { header: true, skipEmptyLines: true })
  if (res.errors.length) throw new ImportError('notCsv', file, `row ${res.errors[0].row}: ${res.errors[0].message}`)
  const columns = (res.meta.fields ?? []).map((f) => f.trim())
  const has = (kind: FileKind) => REQUIRED[kind].every((c) => columns.includes(c))
  if (!has(file)) throw new ImportError(has(file === 'customers' ? 'invoices' : 'customers') ? 'swapped' : 'unknownFormat', file)
  return res.data.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k.trim(), (v ?? '').trim()])))
}

/** "MM/DD/YYYY" → "YYYY-MM-DD" */
export function usDate(s: string): string | undefined {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s)
  return m ? `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}` : undefined
}

const CURRENCY: Record<string, string> = { 'Kč': 'CZK', 'CZK': 'CZK', 'EUR': 'EUR', '€': 'EUR', 'NZD': 'NZD', 'USD': 'USD', 'GBP': 'GBP' }

export interface MergeNote { kept: string; merged: string[] }

export interface ImportResult {
  customers: Customer[]
  invoices: Invoice[]
  merges: MergeNote[]
  /** Invoices whose customer couldn't be matched; a customer was created from the invoice's details. */
  createdFromInvoices: string[]
  warnings: string[]
}

export function importCsv(customersCsv: string, invoicesCsv: string, vatMode: VatMode, makeId = newId): ImportResult {
  const warnings: string[] = []
  const merges = new Map<string, MergeNote>()
  const byKey = new Map<string, Customer>()
  const byIc = new Map<string, Customer>()
  const customers: Customer[] = []

  const register = (c: Customer) => {
    customers.push(c)
    byKey.set(nameKey(c.name), c)
    if (c.ic) byIc.set(c.ic, c)
  }

  for (const r of parse(customersCsv, 'customers')) {
    const name = r['Firma'] || [r['Titul'], r['Jméno'], r['Příjmení']].filter(Boolean).join(' ')
    if (!name) { warnings.push('Skipped a customer row without a name'); continue }
    const ic = normalizeIc(r['IČ'] ?? '')
    const existing = byKey.get(nameKey(name))
    if (existing) {
      // Same company listed twice: keep the first, fill in any blanks from the duplicate.
      existing.ic ||= ic
      existing.dic ||= r['DIČ'] ?? ''
      existing.email ||= r['E-mailová adresa'] ?? ''
      const note = merges.get(existing.id) ?? { kept: existing.name, merged: [] }
      note.merged.push(name)
      merges.set(existing.id, note)
      continue
    }
    const contact = [r['Titul'], r['Jméno'], r['Příjmení']].filter(Boolean).join(' ')
    register({
      id: makeId(),
      name,
      ic,
      dic: r['DIČ'] ?? '',
      address: { street: r['Ulice'] ?? '', zip: r['PSČ'] ?? '', city: r['Město'] ?? '', country: r['Stát'] ?? '' },
      email: r['E-mailová adresa'] ?? '',
      cc: (r['Další příjemci'] ?? '').split(/[,;]\s*/).filter(Boolean),
      phone: r['Telefon'] || r['Mobil'] || '',
      web: r['www'] ?? '',
      contactName: contact,
      reverseCharge: false,
      note: '',
      archived: false,
    })
  }

  const createdFromInvoices: string[] = []
  const invoices: Invoice[] = []
  for (const r of parse(invoicesCsv, 'invoices')) {
    const number = r['Číslo dokladu']
    const name = r['Název/Jméno']
    const ic = normalizeIc(r['IČ'] ?? '')
    let customer = byKey.get(nameKey(name)) ?? (ic ? byIc.get(ic) : undefined)
    if (!customer) {
      customer = {
        id: makeId(), name, ic, dic: r['DIČ'] ?? '', address: { street: '', zip: '', city: '', country: '' },
        email: '', cc: [], phone: '', web: '', contactName: '', reverseCharge: false, note: '', archived: false,
      }
      register(customer)
      createdFromInvoices.push(name)
    }

    const issueDate = usDate(r['Vystaveno'])
    const dueDate = usDate(r['Splatnost'])
    if (!issueDate || !dueDate) { warnings.push(`${number}: invalid dates, skipped`); continue }
    const total = toMinor(r['Celkem'])
    const currency = CURRENCY[r['Měna']] ?? r['Měna']
    const paid = r['Stav úhrady'] === 'Uhrazeno'
    const paidDate = usDate(r['Datum platby'] ?? '')
    if (paid && !paidDate) warnings.push(`${number}: marked paid without a payment date`)

    invoices.push({
      id: makeId(),
      kind: 'invoice',
      correctionReason: '',
      reminders: [],
      privateNote: '',
      tags: [],
      number,
      variableSymbol: r['Variabilní symbol'] || number,
      orderNumber: r['Číslo objednávky'] ?? '',
      customerId: customer.id,
      // The snapshot keeps the name exactly as printed on the original invoice.
      customerSnapshot: { name, ic: ic || customer.ic, dic: r['DIČ'] || customer.dic, address: { ...customer.address } },
      issueDate,
      dueDate,
      paidDate: paid ? paidDate : undefined,
      paidAmount: paid ? toMinor(r['Uhrazená částka'] || r['Celkem']) : undefined,
      currency,
      language: currency === 'CZK' ? 'cs' : 'en',
      paymentMethod: 'bank',
      vatMode,
      reverseCharge: false,
      lines: [{ description: r['Popis'] ?? '', quantity: 1, unit: '', unitPrice: total, vatRate: 0 }],
      recordedTotal: total,
      note: '',
      status: paid ? 'paid' : 'issued',
    })
  }

  return { customers, invoices, merges: [...merges.values()], createdFromInvoices, warnings }
}
