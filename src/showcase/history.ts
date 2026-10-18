import { importCsv } from '@/import/csv'
import type { Customer, Invoice } from '@/domain/schema'

/**
 * A made-up business history for the public showcase (the owner, 2026-10-18): about forty customers and invoices every
 * month from January 2019 to today, in the old service's CSV format so it goes through the normal import. Nothing comes
 * from real data. Names, amounts and descriptions are placeholders; `anonymize()` (src/domain/demo.ts) then gives them
 * their final look. Deterministic for a given day.
 */

const CUSTOMER_HEADER = 'Firma,IČ,DIČ,Ulice,PSČ,Město,Stát,E-mailová adresa,Další příjemci,Telefon,www,Titul,Jméno,Příjmení,Mobil,Číslo účtu,Kód banky,IBAN'
const INVOICE_HEADER = 'Číslo dokladu,Popis,Číslo objednávky,Řada,Název/Jméno,IČ,DIČ,Vystaveno,Splatnost,Datum platby,Celkem,Měna,Stav úhrady,Uhrazená částka,Variabilní symbol,Exportováno,Odesláno odběrateli,Odesláno účetnímu'

const MONTHS = ['leden', 'únor', 'březen', 'duben', 'květen', 'červen', 'červenec', 'srpen', 'září', 'říjen', 'listopad', 'prosinec']
/** Foreign customers: country, currency, CZK per unit (roughly). */
const FOREIGN: [string, string, number][] = [
  ['Německo', 'EUR', 25], ['Rakousko', 'EUR', 25], ['Slovensko', 'EUR', 25], ['Irsko', 'EUR', 25], ['Švýcarsko', 'CHF', 26], ['Nový Zéland', 'NZD', 14],
]
const CZ_CUSTOMERS = 34

function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const csvField = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)
const row = (fields: (string | number)[]) => fields.map((f) => csvField(String(f))).join(',')
const usDate = (d: Date) => `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)

/** A valid 8-digit IČ (mod 11). */
function ic(n: number) {
  const d = String(1000000 + n * 7919).slice(-7)
  const sum = [...d].reduce((acc, c, i) => acc + Number(c) * (8 - i), 0)
  return d + ((11 - (sum % 11)) % 10)
}

export function showcaseHistory(today: Date): { customers: Customer[]; invoices: Invoice[] } {
  const rand = rng(20261018)
  const int = (n: number) => Math.floor(rand() * n)

  const customers: { name: string; ic: string; country: string; currency: string; rate: number }[] = []
  for (let i = 0; i < CZ_CUSTOMERS; i++) customers.push({ name: `Zákazník ${i + 1} s.r.o.`, ic: ic(i + 1), country: 'Česká republika', currency: 'Kč', rate: 1 })
  FOREIGN.forEach(([country, currency, rate], i) => customers.push({ name: `Customer ${i + 1} Ltd`, ic: '', country, currency, rate }))

  const customersCsv = [CUSTOMER_HEADER, ...customers.map((c, i) => row([
    c.name, c.ic, c.ic && i % 3 === 0 ? `CZ${c.ic}` : '', `Ulice ${i + 1}`, '11000', 'Praha', c.country,
    `zakaznik${i + 1}@example.com`, '', '', '', '', '', '', '', '', '', '',
  ]))].join('\n')

  // A few regular customers billed monthly; the rest order now and then, the first ones more often.
  const weight = customers.map((_, i) => 1 / (1 + i * 0.35))
  const total = weight.reduce((a, b) => a + b, 0)
  const pick = () => {
    let r = rand() * total
    for (let i = 0; i < weight.length; i++) if ((r -= weight[i]!) < 0) return i
    return weight.length - 1
  }

  const lines: string[] = []
  const rates = new Map<string, number>()
  for (let y = 2019; y <= today.getFullYear(); y++) {
    let seq = 0
    for (let m = 0; m < 12; m++) {
      if (y === today.getFullYear() && m > today.getMonth()) break
      const count = 3 + int(4)
      for (let k = 0; k < count; k++) {
        const issue = new Date(y, m, 2 + int(26))
        if (issue > today) continue
        const ci = k < 2 ? k * 3 : pick() // customers 0 and 3 are billed every month
        const c = customers[ci]!
        const number = `${y}${String(++seq).padStart(4, '0')}`
        const due = addDays(issue, 14)
        const age = (today.getTime() - issue.getTime()) / 86_400_000
        const paid = age > 60 ? rand() < 0.98 : rand() < 0.55
        const paidOn = paid ? addDays(issue, 3 + int(18)) : undefined
        const amount = (8 + int(40)) * 500
        const desc = k < 2 ? `Služba ${ci + 1} za ${MONTHS[m]} ${y}` : `Projekt ${1 + int(12)}`
        lines.push(row([
          number, desc, '', 'Výchozí', c.name, c.ic, '', usDate(issue), usDate(due), paidOn && paidOn <= today ? usDate(paidOn) : '',
          amount.toFixed(2), c.currency, paid && paidOn && paidOn <= today ? 'Uhrazeno' : 'Neuhrazeno', paid ? amount.toFixed(2) : '0.00',
          number, 'Ne', 'Neodesláno', 'Ne',
        ]))
        if (c.rate !== 1) rates.set(number, c.rate * (0.92 + rand() * 0.16))
      }
    }
  }
  const result = importCsv(customersCsv, [INVOICE_HEADER, ...lines.reverse()].join('\n'), 'nonPayer')
  // Foreign invoices get a rate, as if filled from the ČNB rates, so Home doesn't ask for them.
  const invoices = result.invoices.map((inv) => {
    const rate = rates.get(inv.number)
    return rate ? { ...inv, exchangeRate: Math.round(rate * 1000) / 1000, exchangeRateSource: 'cnb' as const } : inv
  })
  return { customers: result.customers, invoices }
}
