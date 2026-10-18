import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { accountingCsv, periodRange, splitStreet, toIsdoc, uuidOf } from './accounting'
import { newAdvanceTaxDoc, newCreditNote, newFinalInvoice, newInvoice, withKind } from './invoice'
import { SCHEMA_VERSION, Settings, type Invoice } from './schema'
import { crc32, zip } from './zip'

const settings = (vatMode: 'payer' | 'nonPayer') => Settings.parse({
  schemaVersion: SCHEMA_VERSION, vatMode,
  supplier: { name: 'Jan Testovací', ic: '12345678', dic: vatMode === 'payer' ? 'CZ12345678' : '', email: 'jan@example.cz',
    address: { street: 'Příčná 12/3', zip: '110 00', city: 'Praha 1', country: 'Česká republika' },
    bank: { account: '19-2000145399', bankCode: '0800', iban: 'CZ6508000000192000145399', swift: 'GIBACZPX' } },
})
const customer = { id: 'c1', name: 'Šťastný & syn s.r.o.', ic: '01234567', dic: 'CZ01234567', address: { street: 'Řeznická 1', zip: '110 00', city: 'Praha', country: '' }, email: '', cc: [], phone: '', web: '', contactName: '', reverseCharge: false, note: '', archived: false }
const line = (unitPrice: number, vatRate = 0) => ({ description: 'Konzultace <web>', quantity: 2, unit: 'h', unitPrice, vatRate })

/** The documents the ISDOC export must handle, for both VAT modes. */
function samples(): [string, Invoice, Settings][] {
  const np = settings('nonPayer'), p = settings('payer')
  const inv: Invoice = { ...newInvoice(np, [], customer, '2026-10-01'), status: 'issued', lines: [line(100000)], note: 'Děkuji' }
  const eur: Invoice = { ...inv, id: 'old-import-7', number: '20260002', currency: 'EUR', exchangeRate: 24.5, paymentMethod: 'cash', status: 'paid', paidDate: '2026-10-02' }
  const proforma: Invoice = { ...withKind(inv, 'proforma', np, []), status: 'paid', paidDate: '2026-10-03', paidAmount: 200000 }
  const final: Invoice = { ...newFinalInvoice(np, [proforma], proforma, '2026-10-10'), status: 'paid', paidDate: '2026-10-03', paidAmount: 0 }
  const pInv: Invoice = { ...newInvoice(p, [], customer, '2026-10-01'), status: 'issued', lines: [line(100000, 21), line(50000, 12)] }
  const credit: Invoice = { ...newCreditNote(p, [pInv], pInv, '2026-10-05'), status: 'issued', correctionReason: 'Sleva', lines: [line(-10000, 21)] }
  const pProforma: Invoice = { ...withKind(pInv, 'proforma', p, []), status: 'paid', paidDate: '2026-10-04', paidAmount: 354000 }
  const taxDoc: Invoice = { ...newAdvanceTaxDoc(p, [pProforma], pProforma, '2026-10-06'), status: 'paid', paidDate: '2026-10-04', paidAmount: 354000 }
  const pFinal: Invoice = { ...newFinalInvoice(p, [pProforma, taxDoc], pProforma, '2026-10-20'), status: 'paid', paidDate: '2026-10-04', paidAmount: 0 }
  return [['invoice', inv, np], ['eur-cash', eur, np], ['proforma', proforma, np], ['final', final, np],
    ['payer-invoice', pInv, p], ['credit-note', credit, p], ['tax-doc', taxDoc, p], ['payer-final', pFinal, p]]
}

describe('export for the accountant', () => {
  it('writes a CSV that Czech Excel reads: BOM, semicolons, decimal commas, quoted text', () => {
    const csv = accountingCsv(samples().map(([, inv]) => inv))
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    const [head, first] = csv.slice(1).split('\r\n')
    expect(head!.split(';').slice(0, 4)).toEqual(['Číslo', 'Druh dokladu', 'Stav', 'Vystaveno'])
    expect(first).toContain('"Šťastný & syn s.r.o."'.replace(/"/g, '')) // no quotes needed for &
    expect(first).toContain(';2000,00;0,00;2000,00;2000,00;2000,00;Převodem;')
    expect(csv).toContain('Zálohová faktura')
  })

  it('splits street and building number, and keeps UUIDs stable', () => {
    expect(splitStreet('Letenská 525/15')).toEqual(['Letenská', '525/15'])
    expect(splitStreet('Budějovická 778/3a')).toEqual(['Budějovická', '778/3a'])
    expect(splitStreet('Lhota 12')).toEqual(['Lhota', '12'])
    expect(splitStreet('Na Příkopě')).toEqual(['Na Příkopě', ''])
    expect(uuidOf('old-import-7')).toBe(uuidOf('old-import-7'))
    expect(uuidOf('old-import-7')).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/)
  })

  it('writes ISDOC with the document type, VAT, deposits and foreign currency', () => {
    const docs = Object.fromEntries(samples().map(([name, inv, s]) => [name, toIsdoc(inv, s)]))
    for (const xml of Object.values(docs)) expect(xml).toMatch(/^<\?xml version="1.0" encoding="UTF-8"\?>\n<Invoice xmlns="http:\/\/isdoc.cz\/namespace\/2013" version="6.0.2">/)
    expect(docs.invoice).toContain('<DocumentType>1</DocumentType>')
    expect(docs.invoice).toContain('<VATApplicable>false</VATApplicable>')
    expect(docs.invoice).toContain('<Description>Konzultace &lt;web&gt;</Description>')
    expect(docs.invoice).toContain('<PayableAmount>2000.00</PayableAmount>')
    expect(docs['eur-cash']).toContain('<ForeignCurrencyCode>EUR</ForeignCurrencyCode><CurrRate>24.5</CurrRate>')
    expect(docs['eur-cash']).toContain('<LineExtensionAmountCurr>2000.00</LineExtensionAmountCurr><LineExtensionAmount>49000.00</LineExtensionAmount>')
    expect(docs['eur-cash']).toContain('<PaymentMeansCode>10</PaymentMeansCode>')
    expect(docs.proforma).toContain('<DocumentType>4</DocumentType>')
    expect(docs.final).toContain('<NonTaxedDeposits><NonTaxedDeposit><ID>Z20260001</ID>')
    expect(docs.final).toContain('<PaidDepositsAmount>2000.00</PaidDepositsAmount>')
    expect(docs['payer-invoice']).toContain('<TaxPointDate>2026-10-01</TaxPointDate><VATApplicable>true</VATApplicable>')
    expect(docs['credit-note']).toContain('<DocumentType>2</DocumentType>')
    expect(docs['credit-note']).toContain('<OriginalDocumentReference><ID>20260001</ID>')
    expect(docs['tax-doc']).toContain('<DocumentType>5</DocumentType>')
    expect(docs['payer-final']).toContain('<TaxedDeposits>')
    expect(docs['payer-final']).toContain('<AlreadyClaimedTaxAmount>')
    // For the XSD check (docs/accounting-export.md): ISDOC_OUT=<dir> npx vitest run src/domain/accounting.test.ts
    const out = process.env.ISDOC_OUT
    if (out) { mkdirSync(out, { recursive: true }); for (const [name, xml] of Object.entries(docs)) writeFileSync(join(out, `${name}.isdoc`), xml) }
  })

  it('packs files into a ZIP with correct checksums', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926)
    const z = zip([{ name: 'a.txt', data: new TextEncoder().encode('ahoj') }, { name: 'složka/b.isdoc', data: new Uint8Array([1, 2]) }], new Date(2026, 9, 18, 12, 0))
    const v = new DataView(z.buffer)
    expect(v.getUint32(0, true)).toBe(0x04034b50)
    expect(v.getUint32(z.length - 22, true)).toBe(0x06054b50)
    expect(v.getUint16(z.length - 22 + 10, true)).toBe(2)
  })
})

describe('export periods', () => {
  it('end on the real last day of the month or quarter', () => {
    expect(periodRange('2026', '09')).toEqual(['2026-09-01', '2026-09-30', '2026-09'])
    expect(periodRange('2028', '02')).toEqual(['2028-02-01', '2028-02-29', '2028-02'])
    expect(periodRange('2026', 'q3')).toEqual(['2026-07-01', '2026-09-30', '2026-Q3'])
    expect(periodRange('2026', 'q4')).toEqual(['2026-10-01', '2026-12-31', '2026-Q4'])
    expect(periodRange('2026', 'year')).toEqual(['2026-01-01', '2026-12-31', '2026'])
  })
})
