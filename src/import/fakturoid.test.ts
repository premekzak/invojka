import { describe, expect, it } from 'vitest'
import { CustomersFile, InvoicesFile, SCHEMA_VERSION } from '@/domain/schema'
import { cashIncome } from '@/domain/taxes'
import { computeTotals } from '@/domain/vat'
import { ImportError } from './csv'
import { countryName, guessPattern, importFakturoid, isFakturoidCsv } from './fakturoid'

// A made-up export in Fakturoid's format, with its quirks: decimal commas in totals but a point in VAT, newest rows
// first, a proforma and the final invoice it settled pointing at each other, a renamed client, a foreign customer.
const HEADER = 'Id,Proforma,Partial proforma,Number,Variable symbol,Your name,Your street,Your street2,Your city,Your zip,Your country,Your registration no,Your vat no,Client name,Client street,Client street2,Client city,Client zip,Client country,Client registration no,Client vat no,Subject,Generator,Related,Token,Status,Order number,Issued on,Taxable fulfillment due,Due,Due on,Sent at,Paid on,Reminder sent at,Cancelled at,Bank account,Iban,Swift bic,Payment method,Currency,Exchange rate,Language,Transferred tax liability,Subtotal,Total,Native subtotal,Native total,Remaining amount,Remaining native amount,Vat,Client email,Client phone,Tax document,Payment method human,Rounding adjustment,Client delivery name,Client delivery street,Client delivery city,Client delivery zip,Client delivery country'
const ME = '"Zkušební dílna, s. r. o.",Lipová 1,,Testov,100 00,CZ,12345678,CZ12345678'
const BANK = '1234567890/2010,CZ2120100000001234567890,FIOBCZPPXXX,bank'
const row = (id: string, proforma: boolean, number: string, client: string, subject: string, related: string, status: string,
  issued: string, paid: string, currency: string, rate: string, lang: string, base: string, total: string, vat: string) =>
  `${id},${proforma},false,${number},${number.replace(/\D/g, '')},${ME},${client},${subject},,${related},tok,${status},"",${issued},${issued},14,${issued},,${paid},,,${BANK},${currency},${rate},${lang},false,"${base}","${total}","${base}","${total}","0,0","0,0",${vat},"","",false,Banka,"0,0",,,,,`

const CLIENT_A = '"Pekárna Kvásek, s.r.o.",Nádražní 5,,Brno,602 00,CZ,87654321,CZ87654321'
const CLIENT_A_OLD = 'Pekárna Kvásek,,,,,CZ,,'
const CLIENT_B = 'Fjord Design AS,Storgata 1,,Oslo,0155,NO,,'

const csv = '﻿' + [
  HEADER,
  row('6', false, '2026-0003', CLIENT_B, '102', '', 'open', '2026-09-01', '', 'EUR', '24.5', 'en', '1000,0', '1000,0', '0.0'),
  row('5', false, '2026-0002', CLIENT_A, '101', '4', 'paid', '2026-08-20', '2026-08-20', 'CZK', '1.0', 'cz', '13221,0', '15997,41', '2776.41'),
  row('4', true, '1-2026-0001', CLIENT_A, '101', '5', 'paid', '2026-08-03', '2026-08-17', 'CZK', '1.0', 'cz', '13221,0', '15997,41', '2776.41'),
  row('7', false, '2026-0004', CLIENT_A, '101', '3', 'paid', '2026-03-01', '2026-03-05', 'CZK', '1.0', 'cz', '-100,0', '-121,0', '-21.0'),
  row('8', false, '2026-0005', CLIENT_A, '101', '', 'paid', '2026-03-02', '2026-03-05', 'CZK', '1.0', 'cz', '-100,0', '-121,0', '-21.0'),
  row('3', false, '2026-0001', CLIENT_A_OLD, '101', '', 'paid', '2026-02-10', '2026-02-20', 'CZK', '1.0', 'cz', '1000,0', '1170,0', '170.0'),
].join('\n')

describe('import of a Fakturoid export (made-up)', () => {
  let n = 0
  const res = importFakturoid(csv, 'payer', () => `id${++n}`)

  it('recognises the format and produces schema-valid files', () => {
    expect(isFakturoidCsv(csv)).toBe(true)
    expect(res.invoices).toHaveLength(6)
    expect(res.warnings).toEqual([])
    InvoicesFile.parse({ schemaVersion: SCHEMA_VERSION, invoices: res.invoices })
    CustomersFile.parse({ schemaVersion: SCHEMA_VERSION, customers: res.customers })
  })

  it('reads the supplier, a likely VAT mode and the number formats', () => {
    expect(res.supplier).toMatchObject({
      name: 'Zkušební dílna, s. r. o.', ic: '12345678', dic: 'CZ12345678',
      address: { street: 'Lipová 1', zip: '100 00', city: 'Testov', country: 'Česká republika' },
      bank: { account: '1234567890', bankCode: '2010', iban: 'CZ2120100000001234567890', swift: 'FIOBCZPPXXX' },
    })
    expect(res.vatMode).toBe('payer')
    expect(res.numbering).toEqual({ pattern: '{YYYY}-{NNNN}', proformaPattern: '1-{YYYY}-{NNNN}' })
  })

  it('keeps one customer per Fakturoid client, with the latest name and details', () => {
    expect(res.customers.map((c) => c.name)).toEqual(['Fjord Design AS', 'Pekárna Kvásek, s.r.o.'])
    expect(res.merges).toEqual([{ kept: 'Pekárna Kvásek, s.r.o.', merged: ['Pekárna Kvásek'] }])
    expect(res.customers[0].address.country).toBe(countryName('NO'))
    // The old invoice still prints the name it had.
    expect(res.invoices.find((i) => i.number === '2026-0001')!.customerSnapshot.name).toBe('Pekárna Kvásek')
  })

  it('rebuilds VAT lines that add up to the recorded totals', () => {
    for (const i of res.invoices) expect(computeTotals(i.lines, i.vatMode).total).toBe(i.recordedTotal)
    expect(res.invoices.find((i) => i.number === '2026-0002')!.lines.map((l) => l.vatRate)).toEqual([21])
    // 1 000 Kč of which 170 Kč VAT is a mix: 21 % and 12 %.
    expect(res.invoices.find((i) => i.number === '2026-0001')!.lines.map((l) => [l.unitPrice, l.vatRate])).toEqual([[55556, 21], [44444, 12]])
  })

  it('links the final invoice to its proforma, so the money counts once', () => {
    const proforma = res.invoices.find((i) => i.kind === 'proforma')!
    const final = res.invoices.find((i) => i.number === '2026-0002')!
    expect(final).toMatchObject({ advanceId: proforma.id, advanceNumber: '1-2026-0001', advanceAmount: 1599741, paidAmount: 0, status: 'paid' })
    // Base of the proforma (13 221) plus the February invoice (1 000), less two refunds of 100, without VAT.
    expect(cashIncome(res.invoices, 2026).income).toBe(14021)
  })

  it('names the original document on each line, as the export has no line texts', () => {
    expect(res.invoices.find((i) => i.number === '2026-0002')!.lines[0].description).toBe('Podle dokladu 2026-0002 z Fakturoidu')
    expect(res.invoices.find((i) => i.number === '2026-0003')!.lines[0].description).toBe('As per document 2026-0003 from Fakturoid')
  })

  it('a negative document is a credit note only when it points to its invoice', () => {
    const original = res.invoices.find((i) => i.number === '2026-0001')!
    expect(res.invoices.find((i) => i.number === '2026-0004')).toMatchObject({ kind: 'creditNote', correctsId: original.id, correctsNumber: '2026-0001' })
    expect(res.invoices.find((i) => i.number === '2026-0005')!.kind).toBe('invoice')
  })

  it('keeps the currency, its rate and the language', () => {
    expect(res.invoices.find((i) => i.number === '2026-0003')).toMatchObject({ currency: 'EUR', exchangeRate: 24.5, language: 'en', status: 'issued' })
  })

  it('a non-payer gets lines at the full amount', () => {
    const np = importFakturoid(csv, 'nonPayer')
    expect(np.invoices.every((i) => i.lines.length === 1 && i.lines[0].vatRate === 0)).toBe(true)
  })

  it('another file says it is in an unknown format', () => {
    expect(() => importFakturoid('Firma,IČ\nAcme,1', 'payer')).toThrow(ImportError)
    expect(isFakturoidCsv('Firma,IČ\nAcme,1')).toBe(false)
  })
})

describe('guessing a number format from the last number', () => {
  it.each([
    ['2025-0055', '{YYYY}-{NNNN}'],
    ['20260042', '{YYYY}{NNNN}'],
    ['260042', '{YY}{NNNN}'],
    ['FV2026/012', 'FV{YYYY}/{NNN}'],
    ['1-2026-0004', '1-{YYYY}-{NNNN}'],
    ['157', '{NNN}'],
    ['bez čísla', undefined],
  ])('%s → %s', (number, pattern) => expect(guessPattern(number, 2026)).toBe(pattern))
})
