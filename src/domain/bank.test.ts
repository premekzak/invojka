import { describe, expect, it } from 'vitest'
import { decodeStatement, matchPayments, parseCamt, parseCsv, parseGpc, parseStatement, StatementError } from './bank'
import { newInvoice } from './invoice'
import { SCHEMA_VERSION, Settings, type Invoice } from './schema'

// Made-up statements in each bank format (positions as Fio documents GPC).
const pad = (s: string | number, n: number, ch = '0') => String(s).padStart(n, ch)
const gpcHeader = () => `074${pad('1234567890', 16)}${'Muj ucet'.padEnd(20)}011026${pad(0, 14)}+${pad(0, 14)}+${pad(0, 14)}0${pad(0, 14)}0001181026${' '.repeat(14)}`
const gpc075 = (amount: number, code: string, vs: string, name: string, date = '051026', currency = '0203') =>
  `075${pad('1234567890', 16)}${pad('987654321', 16)}${pad(1, 13)}${pad(amount, 12)}${code}${pad(vs, 10)}${pad('03080308', 10)}${pad(0, 10)}000000${name.padEnd(20)}0${currency}${date}`

describe('reading statements', () => {
  it('reads GPC credits and skips debits and reversals', () => {
    const text = [gpcHeader(), gpc075(1450000, '2', '20260008', 'Acme s.r.o.'), gpc075(99900, '1', '0', 'Nájem'), gpc075(500, '5', '1', 'Storno'), gpc075(25000, '2', '0', 'Bez VS', '000000', '0978')].join('\r\n')
    expect(parseGpc(text)).toEqual([
      { date: '2026-10-05', amount: 1450000, currency: 'CZK', vs: '20260008', name: 'Acme s.r.o.', message: '' },
      { date: '2026-10-18', amount: 25000, currency: 'EUR', vs: '', name: 'Bez VS', message: '' },
    ])
    expect(parseStatement(text).format).toBe('gpc')
  })

  it('reads CAMT.053 credits with the variable symbol from the reference, the end-to-end id or the message', () => {
    const entry = (amt: string, ind: string, inner: string) =>
      `<Ntry><Amt Ccy="CZK">${amt}</Amt><CdtDbtInd>${ind}</CdtDbtInd><BookgDt><Dt>2026-10-06</Dt></BookgDt><NtryDtls><TxDtls>${inner}</TxDtls></NtryDtls></Ntry>`
    const xml = `<?xml version="1.0"?><Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.053.001.02"><BkToCstmrStmt><Stmt>
      ${entry('14500.00', 'CRDT', '<Refs><EndToEndId>VS20260008/SS/KS0308</EndToEndId></Refs><RltdPties><Dbtr><Nm>Acme &amp; syn</Nm></Dbtr></RltdPties>')}
      ${entry('100.00', 'CRDT', '<RmtInf><Strd><CdtrRefInf><Ref>0000123</Ref></CdtrRefInf></Strd></RmtInf>')}
      ${entry('50.00', 'CRDT', '<RmtInf><Ustrd>Faktura VS: 777</Ustrd></RmtInf>')}
      ${entry('999.00', 'DBIT', '')}
    </Stmt></BkToCstmrStmt></Document>`
    expect(parseCamt(xml).map((p) => [p.amount, p.vs, p.name, p.date])).toEqual([
      [1450000, '20260008', 'Acme & syn', '2026-10-06'], [10000, '123', '', '2026-10-06'], [5000, '777', '', '2026-10-06'],
    ])
    expect(parseStatement(xml).format).toBe('camt')
  })

  it('finds the columns of a Fio CSV below its summary lines', () => {
    const csv = ['"Výpis č. 10/2026";', '"Počáteční stav";"1 000,00"', '',
      '"ID pohybu";"Datum";"Objem";"Měna";"Protiúčet";"Název protiúčtu";"Kód banky";"KS";"VS";"SS";"Zpráva pro příjemce"',
      '"1";"05.10.2026";"14 500,00";"CZK";"987654321";"Acme s.r.o.";"0100";"0308";"20260008";"";"Faktura 20260008"',
      '"2";"06.10.2026";"-1 200,00";"CZK";"111";"Nájem";"0800";"";"";"";""'].join('\n')
    expect(parseCsv(csv)).toEqual([{ date: '2026-10-05', amount: 1450000, currency: 'CZK', vs: '20260008', name: 'Acme s.r.o.', message: 'Faktura 20260008' }])
  })

  it('reads other banks’ CSV headers, commas and dates', () => {
    const csob = 'datum zaúčtování;částka;měna;variabilní symbol;název protiúčtu\n2026-10-07;2500,5;EUR;0000042;Beta GmbH'
    expect(parseCsv(csob)).toEqual([{ date: '2026-10-07', amount: 250050, currency: 'EUR', vs: '42', name: 'Beta GmbH', message: '' }])
    const air = '"Datum provedení","Částka v měně účtu","Měna účtu","Variabilní symbol","Název protistrany"\n"7.10.2026","1,234.00","CZK","9","Gama"'
    expect(parseCsv(air)[0]).toMatchObject({ date: '2026-10-07', amount: 123400, vs: '9' })
    expect(() => parseCsv('a;b\n1;2')).toThrow(StatementError)
  })

  it('decodes Windows-1250 when the file isn’t UTF-8', () => {
    const cp1250 = new Uint8Array([0x4e, 0xe1, 0x6a, 0x65, 0x6d, 0x20, 0x9e, 0x6c, 0x75, 0x9d, 0x6f, 0x75, 0xe8, 0x6b, 0xfd]) // "Nájem žluťoučký"
    expect(decodeStatement(cp1250)).toBe('Nájem žluťoučký')
    // A UTF-8 file with a byte order mark loses the mark.
    expect(decodeStatement(new TextEncoder().encode(`${String.fromCharCode(0xfeff)}Žluť`))).toBe('Žluť')
  })
})

describe('matching payments', () => {
  const settings = Settings.parse({ schemaVersion: SCHEMA_VERSION, supplier: { name: 'Test' }, vatMode: 'nonPayer' })
  const inv = (number: string, total: number, patch: Partial<Invoice> = {}): Invoice => ({
    ...newInvoice(settings, [], undefined, '2026-09-01'), number, variableSymbol: number, status: 'issued',
    customerSnapshot: { name: 'Acme s.r.o.', ic: '', dic: '', address: { street: '', zip: '', city: '', country: '' } },
    lines: [{ description: 'x', quantity: 1, unit: '', unitPrice: total, vatRate: 0 }], ...patch,
  })
  const pay = (amount: number, vs: string, name = 'Acme s.r.o.', currency = 'CZK') => ({ date: '2026-10-05', amount, currency, vs, name, message: '' })

  it('matches by symbol and amount, flags a different amount, and recognises invoices already paid', () => {
    const a = inv('20260001', 1000000), b = inv('20260002', 500000), c = inv('20260003', 300000, { status: 'paid', paidDate: '2026-09-20' })
    const r = matchPayments([pay(1000000, '20260001'), pay(200000, '20260002'), pay(300000, '20260003'), pay(777, '1')], [a, b, c])
    expect(r.matches.map((m) => [m.invoice.number, m.kind])).toEqual([['20260001', 'exact'], ['20260002', 'amountDiffers']])
    expect(r.alreadyPaid.map((m) => m.invoice.number)).toEqual(['20260003'])
    expect(r.unmatched.map((p) => p.amount)).toEqual([777])
  })

  it('matches without a symbol only on one invoice of that amount for that customer, and never twice', () => {
    const a = inv('20260001', 1000000), b = inv('20260002', 1000000, { customerSnapshot: { ...inv('x', 0).customerSnapshot, name: 'Jiná firma' } })
    expect(matchPayments([pay(1000000, '', 'ACME SRO')], [a, b]).matches.map((m) => [m.invoice.number, m.kind])).toEqual([['20260001', 'byAmount']])
    const twice = matchPayments([pay(1000000, '20260001'), pay(1000000, '20260001')], [a])
    expect(twice.matches).toHaveLength(1)
    expect(twice.unmatched).toHaveLength(1)
  })

  it('asks a final invoice only for its balance, matches proformas, and ignores credit notes and other currencies', () => {
    const final = inv('20260004', 1000000, { advanceId: 'p', advanceAmount: 600000 })
    const proforma = inv('Z20260001', 200000, { kind: 'proforma', variableSymbol: '20260001' })
    const credit = inv('D20260001', -100000, { kind: 'creditNote', variableSymbol: '20260009' })
    const r = matchPayments([pay(400000, '20260004'), pay(200000, '20260001'), pay(100000, '20260009'), pay(1000000, '20260004', 'Acme', 'EUR')], [final, proforma, credit])
    expect(r.matches.map((m) => [m.invoice.number, m.kind])).toEqual([['20260004', 'exact'], ['Z20260001', 'exact']])
    expect(r.unmatched).toHaveLength(2)
  })
})
