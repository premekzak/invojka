import { amountDue, invoiceTotals } from './invoice'
import type { Invoice, Settings } from './schema'
import { chargesVat, lineBase } from './vat'
import { mulRound } from './money'
import { isCzechCountry } from './vatThreshold'

/**
 * Export for the accountant: a CSV overview that any spreadsheet opens, and ISDOC 6.0.2, the Czech e-invoice standard
 * that accounting programs (Pohoda, Money S3, ABRA…) import. Built against the official schema; see
 * docs/accounting-export.md and docs/czech-rules.md#isdoc.
 */

/** Documents an accountant needs: everything but drafts. Cancelled ones are listed, marked as such. */
export const exportable = (inv: Invoice) => inv.status !== 'draft'

/** Issued in the period (yyyy-mm-dd, both inclusive). */
export const inPeriod = (inv: Invoice, from: string, to: string) => inv.issueDate >= from && inv.issueDate <= to

const KIND_CS: Record<Invoice['kind'], string> = { invoice: 'Faktura', creditNote: 'Opravný doklad', proforma: 'Zálohová faktura', advanceTaxDoc: 'Daňový doklad k platbě' }
const STATUS_CS: Record<Invoice['status'], string> = { draft: 'Koncept', issued: 'Vystaveno', paid: 'Zaplaceno', cancelled: 'Stornováno' }
const METHOD_CS: Record<Invoice['paymentMethod'], string> = { bank: 'Převodem', cash: 'Hotově', cod: 'Dobírkou' }

/** "1234,50": a decimal comma, no thousands separator, so Czech Excel reads it as a number. */
const num = (minor: number) => (minor / 100).toFixed(2).replace('.', ',')
const cell = (v: string) => (/[";\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)

/**
 * The CSV overview: one row per document, semicolons, decimal commas and a byte order mark, as Czech Excel expects.
 * CZK amounts are converted with the document's rate; empty when it has none.
 */
export function accountingCsv(invoices: Invoice[]): string {
  const head = ['Číslo', 'Druh dokladu', 'Stav', 'Vystaveno', 'DUZP', 'Splatnost', 'Uhrazeno dne', 'Odběratel', 'IČ', 'DIČ', 'Země',
    'Měna', 'Kurz', 'Základ', 'DPH', 'Celkem', 'Celkem v Kč', 'Zbývá uhradit', 'Forma úhrady', 'Variabilní symbol', 'Souvisí s dokladem', 'Popis']
  const rows = invoices.map((inv) => {
    const t = invoiceTotals(inv)
    const rate = inv.currency === 'CZK' ? 1 : inv.exchangeRate
    const related = inv.correctsNumber ?? inv.advanceTaxDocNumber ?? inv.advanceNumber ?? ''
    return [inv.number, KIND_CS[inv.kind], inv.uncollectible ? 'Nedobytná' : STATUS_CS[inv.status], inv.issueDate, inv.taxableSupplyDate ?? '', inv.dueDate, inv.paidDate ?? '',
      inv.customerSnapshot.name, inv.customerSnapshot.ic, inv.customerSnapshot.dic, inv.customerSnapshot.address.country,
      inv.currency, rate ? String(rate).replace('.', ',') : '', num(t.base), num(t.vat), num(t.total), rate ? num(mulRound(t.total, rate)) : '',
      num(inv.status === 'paid' ? 0 : amountDue(inv)), METHOD_CS[inv.paymentMethod], inv.variableSymbol, related,
      inv.lines.map((l) => l.description.trim()).filter(Boolean).join('; ')]
  })
  return String.fromCharCode(0xfeff) + [head, ...rows].map((r) => r.map(cell).join(';')).join('\r\n') + '\r\n'
}

// ---------------------------------------------------------------------------------------------------- ISDOC

/** ISDOC document types: 1 invoice, 2 credit note, 4 proforma (no VAT), 5 tax document for an advance. */
const DOCUMENT_TYPE: Record<Invoice['kind'], number> = { invoice: 1, creditNote: 2, proforma: 4, advanceTaxDoc: 5 }
/** ISDOC payment means: 42 to a bank account, 10 cash; cash on delivery is collected in cash by the carrier. */
const PAYMENT_MEANS: Record<Invoice['paymentMethod'], number> = { bank: 42, cash: 10, cod: 10 }

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const amt = (minor: number) => (minor / 100).toFixed(2)
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** The document's UUID: its id, or for an id that isn't one (old imports), a stable UUID made from it. */
export function uuidOf(id: string): string {
  if (UUID_RE.test(id)) return id.toLowerCase()
  let h = ''
  for (let seed = 0; h.length < 32; seed++) {
    let x = 0x811c9dc5 ^ seed
    for (let i = 0; i < id.length; i++) x = Math.imul(x ^ id.charCodeAt(i), 0x01000193) >>> 0
    h += x.toString(16).padStart(8, '0')
  }
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`
}

/** "Letenská 525/15" → street "Letenská", number "525/15"; a street without a number stays whole. */
export function splitStreet(street: string): [string, string] {
  const m = /^(.*\D)\s+(\d[\w/-]*)$/.exec(street.trim())
  return m ? [m[1]!.trim(), m[2]!] : [street.trim(), '']
}

const COUNTRY_CODES: [RegExp, string][] = [[/slovens|slovak/i, 'SK'], [/n[ěe]mec|german/i, 'DE'], [/rakous|austri/i, 'AT'], [/pols|poland/i, 'PL'],
  [/zéland|zealand/i, 'NZ'], [/spojen[éa] kr[áa]lovstv|united kingdom|velk[áa] brit/i, 'GB'], [/usa|spojen[ée] st[áa]ty|united states/i, 'US']]
const countryCode = (country: string) => (isCzechCountry(country) ? 'CZ' : COUNTRY_CODES.find(([re]) => re.test(country))?.[1] ?? '')

type Party = { name: string; ic: string; dic: string; address: { street: string; zip: string; city: string; country: string }; email?: string; phone?: string }

function party(tag: string, p: Party): string {
  const [street, building] = splitStreet(p.address.street)
  const contact = p.email || p.phone
    ? `<Contact>${p.phone ? `<Telephone>${esc(p.phone)}</Telephone>` : ''}${p.email ? `<ElectronicMail>${esc(p.email)}</ElectronicMail>` : ''}</Contact>` : ''
  return `<${tag}><Party>`
    + `<PartyIdentification><ID>${esc(p.ic)}</ID></PartyIdentification>`
    + `<PartyName><Name>${esc(p.name)}</Name></PartyName>`
    + `<PostalAddress><StreetName>${esc(street)}</StreetName><BuildingNumber>${esc(building)}</BuildingNumber><CityName>${esc(p.address.city)}</CityName>`
    + `<PostalZone>${esc(p.address.zip)}</PostalZone><Country><IdentificationCode>${countryCode(p.address.country || 'Česká republika')}</IdentificationCode>`
    + `<Name>${esc(p.address.country || 'Česká republika')}</Name></Country></PostalAddress>`
    + (p.dic ? `<PartyTaxScheme><CompanyID>${esc(p.dic)}</CompanyID><TaxScheme>VAT</TaxScheme></PartyTaxScheme>` : '')
    + contact
    + `</Party></${tag}>`
}

/** Why a document can't go out as ISDOC, or undefined when it can. */
export const isdocProblem = (inv: Invoice): 'noRate' | undefined => (inv.currency !== 'CZK' && !inv.exchangeRate ? 'noRate' : undefined)

/**
 * One document as ISDOC 6.0.2. Amounts are in CZK, with the invoice currency's amounts in the *Curr elements and the
 * rate in CurrRate for a foreign currency. A payer's final invoice lists its advance as a taxed deposit and claims its
 * base and VAT as already claimed; a non-payer's lists it as a non-taxed deposit.
 */
export function toIsdoc(inv: Invoice, settings: Settings): string {
  const vatOn = chargesVat(inv.vatMode, inv.reverseCharge)
  const foreign = inv.currency !== 'CZK'
  const rate = foreign ? inv.exchangeRate ?? 1 : 1
  const czk = (minor: number) => mulRound(minor, rate)
  // `a` writes an amount in CZK, preceded or followed by its *Curr twin for a foreign currency (the schema's order differs).
  const curBefore = (name: string, minor: number) => (foreign ? `<${name}Curr>${amt(minor)}</${name}Curr>` : '') + `<${name}>${amt(czk(minor))}</${name}>`
  const curAfter = (name: string, minor: number) => `<${name}>${amt(czk(minor))}</${name}>` + (foreign ? `<${name}Curr>${amt(minor)}</${name}Curr>` : '')
  const totals = invoiceTotals(inv)
  const sup = settings.supplier

  const lines = inv.lines.map((l, i) => {
    const base = lineBase(l)
    const lineVat = vatOn ? mulRound(base, l.vatRate / 100) : 0
    const percent = vatOn ? l.vatRate : 0
    const unitGross = vatOn ? mulRound(l.unitPrice, 1 + l.vatRate / 100) : l.unitPrice
    return `<InvoiceLine><ID>${i + 1}</ID>`
      + `<InvoicedQuantity${l.unit ? ` unitCode="${esc(l.unit)}"` : ''}>${l.quantity}</InvoicedQuantity>`
      + curBefore('LineExtensionAmount', base)
      + curBefore('LineExtensionAmountTaxInclusive', base + lineVat)
      + `<LineExtensionTaxAmount>${amt(czk(lineVat))}</LineExtensionTaxAmount>`
      + `<UnitPrice>${amt(czk(l.unitPrice))}</UnitPrice><UnitPriceTaxInclusive>${amt(czk(unitGross))}</UnitPriceTaxInclusive>`
      + `<ClassifiedTaxCategory><Percent>${percent}</Percent><VATCalculationMethod>0</VATCalculationMethod><VATApplicable>${vatOn}</VATApplicable></ClassifiedTaxCategory>`
      + `<Item><Description>${esc(l.description)}</Description></Item></InvoiceLine>`
  }).join('')

  // Advances deducted on a final invoice: a payer's per VAT rate from its tax document, a non-payer's as one sum.
  const claimed = new Map((inv.advanceVat ?? []).map((r) => [r.rate, r]))
  const advance = inv.advanceAmount ?? 0
  const deposits = !inv.advanceId || !advance ? ''
    : inv.advanceVat?.length
      ? `<TaxedDeposits>${inv.advanceVat.map((r) => `<TaxedDeposit><ID>${esc(inv.advanceTaxDocNumber ?? inv.advanceNumber ?? '')}</ID><VariableSymbol>${esc(inv.variableSymbol)}</VariableSymbol>`
        + `${curBefore('TaxableDepositAmount', r.base)}${curBefore('TaxInclusiveDepositAmount', r.base + r.vat)}`
        + `<ClassifiedTaxCategory><Percent>${r.rate}</Percent><VATCalculationMethod>0</VATCalculationMethod></ClassifiedTaxCategory></TaxedDeposit>`).join('')}</TaxedDeposits>`
      : `<NonTaxedDeposits><NonTaxedDeposit><ID>${esc(inv.advanceNumber ?? '')}</ID><VariableSymbol>${esc(inv.variableSymbol)}</VariableSymbol>${curBefore('DepositAmount', advance)}</NonTaxedDeposit></NonTaxedDeposits>`

  const subTotals = totals.byRate.map((r) => {
    const c = claimed.get(r.rate) ?? { base: 0, vat: 0 }
    return `<TaxSubTotal>${curBefore('TaxableAmount', r.base)}${curBefore('TaxAmount', r.vat)}${curBefore('TaxInclusiveAmount', r.total)}`
      + `${curBefore('AlreadyClaimedTaxableAmount', c.base)}${curBefore('AlreadyClaimedTaxAmount', c.vat)}${curBefore('AlreadyClaimedTaxInclusiveAmount', c.base + c.vat)}`
      + `${curBefore('DifferenceTaxableAmount', r.base - c.base)}${curBefore('DifferenceTaxAmount', r.vat - c.vat)}${curBefore('DifferenceTaxInclusiveAmount', r.total - c.base - c.vat)}`
      + `<TaxCategory><Percent>${r.rate}</Percent><VATApplicable>${vatOn}</VATApplicable></TaxCategory></TaxSubTotal>`
  }).join('')
  const claimedBase = [...claimed.values()].reduce((s, r) => s + r.base, 0)
  const claimedGross = [...claimed.values()].reduce((s, r) => s + r.base + r.vat, 0)
  const nonTaxed = inv.advanceVat?.length ? 0 : advance
  const payable = inv.kind === 'advanceTaxDoc' || inv.status === 'paid' ? 0 : amountDue(inv)

  const bank = sup.bank
  const payment = inv.paymentMethod === 'bank' && (bank.account || bank.iban)
    ? `<Details><PaymentDueDate>${inv.dueDate}</PaymentDueDate><ID>${esc(bank.account)}</ID><BankCode>${esc(bank.bankCode)}</BankCode><Name></Name>`
      + `<IBAN>${esc(bank.iban)}</IBAN><BIC>${esc(bank.swift)}</BIC>${inv.variableSymbol ? `<VariableSymbol>${esc(inv.variableSymbol)}</VariableSymbol>` : ''}</Details>`
    : inv.paymentMethod !== 'bank' ? `<Details><DocumentID>${esc(inv.number)}</DocumentID><IssueDate>${inv.paidDate ?? inv.issueDate}</IssueDate></Details>` : ''

  return '<?xml version="1.0" encoding="UTF-8"?>\n'
    + `<Invoice xmlns="http://isdoc.cz/namespace/2013" version="6.0.2">`
    + `<DocumentType>${DOCUMENT_TYPE[inv.kind]}</DocumentType>`
    + `<ID>${esc(inv.number)}</ID><UUID>${uuidOf(inv.id)}</UUID><IssuingSystem>Invojka</IssuingSystem>`
    + `<IssueDate>${inv.issueDate}</IssueDate>`
    + (inv.taxableSupplyDate && inv.vatMode === 'payer' ? `<TaxPointDate>${inv.taxableSupplyDate}</TaxPointDate>` : '')
    + `<VATApplicable>${vatOn}</VATApplicable><ElectronicPossibilityAgreementReference></ElectronicPossibilityAgreementReference>`
    + ([inv.correctionReason && `Důvod opravy: ${inv.correctionReason}`, inv.note].filter(Boolean).length
      ? `<Note>${esc([inv.correctionReason && `Důvod opravy: ${inv.correctionReason}`, inv.note].filter(Boolean).join(' '))}</Note>` : '')
    + `<LocalCurrencyCode>CZK</LocalCurrencyCode>${foreign ? `<ForeignCurrencyCode>${esc(inv.currency)}</ForeignCurrencyCode>` : ''}`
    + `<CurrRate>${rate}</CurrRate><RefCurrRate>1</RefCurrRate>`
    + party('AccountingSupplierParty', { ...sup, email: sup.email, phone: sup.phone })
    + party('AccountingCustomerParty', inv.customerSnapshot)
    + (inv.kind === 'creditNote' && inv.correctsNumber ? `<OriginalDocumentReferences><OriginalDocumentReference><ID>${esc(inv.correctsNumber)}</ID></OriginalDocumentReference></OriginalDocumentReferences>` : '')
    + `<InvoiceLines>${lines}</InvoiceLines>`
    + deposits
    + `<TaxTotal>${subTotals}${curBefore('TaxAmount', totals.vat)}</TaxTotal>`
    + `<LegalMonetaryTotal>${curAfter('TaxExclusiveAmount', totals.base)}${curAfter('TaxInclusiveAmount', totals.total)}`
    + `${curAfter('AlreadyClaimedTaxExclusiveAmount', claimedBase)}${curAfter('AlreadyClaimedTaxInclusiveAmount', claimedGross)}`
    + `${curAfter('DifferenceTaxExclusiveAmount', totals.base - claimedBase)}${curAfter('DifferenceTaxInclusiveAmount', totals.total - claimedGross)}`
    + `${curAfter('PaidDepositsAmount', nonTaxed)}${curAfter('PayableAmount', payable)}</LegalMonetaryTotal>`
    + (payment ? `<PaymentMeans><Payment><PaidAmount>${amt(czk(payable))}</PaidAmount><PaymentMeansCode>${PAYMENT_MEANS[inv.paymentMethod]}</PaymentMeansCode>${payment}</Payment></PaymentMeans>` : '')
    + `</Invoice>\n`
}

/** The last day of a month (1–12), as yyyy-mm-dd: day 0 of the next month. */
const lastDay = (year: string, month: number) =>
  `${year}-${String(month).padStart(2, '0')}-${String(new Date(Number(year), month, 0).getDate()).padStart(2, '0')}`

/** An export period: a whole year, a quarter (q1–q4) or a month (01–12), as first day, last day and a label. */
export function periodRange(year: string, period: string): [string, string, string] {
  if (period === 'year') return [`${year}-01-01`, `${year}-12-31`, year]
  if (period.startsWith('q')) {
    const q = Number(period.slice(1))
    return [`${year}-${String(q * 3 - 2).padStart(2, '0')}-01`, lastDay(year, q * 3), `${year}-Q${q}`]
  }
  return [`${year}-${period}-01`, lastDay(year, Number(period)), `${year}-${period}`]
}

/** Any table as CSV the same way: byte order mark, semicolons, quoted text where needed, CRLF. */
export const csvTable = (rows: string[][]) => String.fromCharCode(0xfeff) + rows.map((r) => r.map(cell).join(';')).join('\r\n') + '\r\n'

/** An amount for CSV: "1234,50". */
export const csvAmount = num
