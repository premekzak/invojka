import { Document, Font, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer'
import { formatDocDate, LOCALES } from '@/domain/language'
import { formatMoney } from '@/domain/money'
import { paysByBank } from '@/domain/payment'
import type { Invoice, Settings } from '@/domain/schema'
import { chargesVat, computeTotals, lineBase } from '@/domain/vat'
import { fonts } from './fonts'
import { invoiceLabels } from './labels'
import { PDF_COLORS } from './palette'

Font.register({ family: 'Inter', fonts: [{ src: fonts.regular, fontWeight: 400 }, { src: fonts.semiBold, fontWeight: 600 }] })
// Czech words must not be hyphenated by the English default.
Font.registerHyphenationCallback((word) => [word])

// Every colour on the PDF comes from the shared palette (also used by Settings for the colour swatches).
export const C = PDF_COLORS

export const s = StyleSheet.create({
  page: { fontFamily: 'Inter', fontSize: 9, color: C.ink, padding: 40, paddingBottom: 60, lineHeight: 1.4 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 },
  title: { fontSize: 20, fontWeight: 600, lineHeight: 1.2 },
  number: { fontSize: 11, color: C.muted, marginTop: 4, lineHeight: 1.2 },
  label: { fontSize: 7.5, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 },
  parties: { flexDirection: 'row', gap: 24, marginBottom: 20 },
  party: { flex: 1 },
  partyBox: { flex: 1, backgroundColor: C.box, borderRadius: 6, padding: 12 },
  name: { fontSize: 11, fontWeight: 600, marginBottom: 2 },
  meta: { flexDirection: 'row', gap: 24, marginBottom: 24, paddingVertical: 12, borderTop: `1 solid ${C.line}`, borderBottom: `1 solid ${C.line}` },
  metaCol: { flex: 1, gap: 3 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between' },
  metaKey: { color: C.muted },
  metaVal: { fontWeight: 600 },
  th: { flexDirection: 'row', borderBottom: `1 solid ${C.line}`, paddingBottom: 5, color: C.muted, fontSize: 7.5, textTransform: 'uppercase', letterSpacing: 0.5 },
  tr: { flexDirection: 'row', paddingVertical: 6, borderBottom: `0.5 solid ${C.line}` },
  cDesc: { flex: 1, paddingRight: 8 },
  cQty: { width: 60, textAlign: 'right' },
  cPrice: { width: 75, textAlign: 'right' },
  cVat: { width: 40, textAlign: 'right' },
  cTotal: { width: 80, textAlign: 'right' },
  bottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 16 },
  qr: { width: 92, alignItems: 'center' },
  qrImg: { width: 86, height: 86 },
  totals: { width: 230 },
  sumRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
  toPay: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, padding: 10, backgroundColor: C.ink, color: C.paper, borderRadius: 6 },
  toPayAmount: { fontSize: 14, fontWeight: 600 },
  note: { marginTop: 24, color: C.muted },
  footer: { position: 'absolute', bottom: 24, left: 40, right: 40, flexDirection: 'row', justifyContent: 'space-between', fontSize: 7.5, color: C.muted, borderTop: `0.5 solid ${C.line}`, paddingTop: 6 },
})

export interface InvoicePdfProps {
  invoice: Invoice
  settings: Settings
  /** QR Platba image as a data URL, or undefined when not applicable. */
  qr?: string
}

export function InvoiceDocument({ invoice: inv, settings, qr }: InvoicePdfProps) {
  const L = invoiceLabels[inv.language]
  const sup = settings.supplier
  const look = settings.invoice
  const accent = C.accents[look.color]
  const vatOn = chargesVat(inv.vatMode, inv.reverseCharge)
  const isPayer = inv.vatMode === 'payer'
  const totals = computeTotals(inv.lines, inv.vatMode, inv.reverseCharge)
  // Intl uses a narrow no-break space for grouping in Czech; a regular no-break space renders reliably in every font.
  const money = (m: number) => formatMoney(m, inv.currency, inv.language).replace(/ /g, ' ')
  const date = (iso?: string) => (iso ? formatDocDate(iso, inv.language) : '')
  const qty = (n: number) => n.toLocaleString(LOCALES[inv.language], { maximumFractionDigits: 3 })
  const addr = (a: { street: string; zip: string; city: string; country: string }) =>
    [a.street, [a.zip, a.city].filter(Boolean).join(' '), a.country].filter(Boolean)

  // Cash and cash on delivery print no bank details; cash on delivery keeps the payment reference, which carriers use.
  const bank = paysByBank(inv)
  const methodLabel = { bank: L.bankTransfer, cash: L.cash, cod: L.cod }[inv.paymentMethod]

  const credit = inv.kind === 'creditNote'
  const proforma = inv.kind === 'proforma'
  const taxDoc = inv.kind === 'advanceTaxDoc'
  const title = taxDoc ? L.advanceTaxDoc : proforma ? L.proforma : credit ? (isPayer ? L.creditNoteTax : L.creditNote) : isPayer && !inv.reverseCharge ? L.taxInvoice : L.invoice
  // A final invoice deducts the advance paid on its proforma; the box shows what's left.
  const advance = inv.advanceAmount ?? 0

  const notes = [
    proforma && L.notTaxDocument,
    credit && inv.correctionReason && `${L.reason}: ${inv.correctionReason}`,
    inv.vatMode === 'nonPayer' && L.nonPayer,
    inv.vatMode === 'identifiedPerson' && L.identifiedPerson,
    inv.reverseCharge && L.reverseCharge,
    inv.note,
  ].filter(Boolean) as string[]

  return (
    <Document title={`${title} ${inv.number}`} author={sup.name} creator="Invojka" producer="Invojka" language={inv.language}>
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <View>
            <Text style={[s.title, { color: accent }]}>{title}</Text>
            <Text style={s.number}>{inv.number}</Text>
            {inv.status === 'cancelled' ? <Text style={{ marginTop: 6, color: C.danger, fontWeight: 600, letterSpacing: 1 }}>{L.cancelled}</Text> : null}
          </View>
          {look.logo
            ? <Image src={look.logo} style={{ maxWidth: 180, maxHeight: 60, objectFit: 'contain' }} />
            : <Text style={{ fontSize: 11, fontWeight: 600, color: C.ink, maxWidth: 220, textAlign: 'right' }}>{sup.name}</Text>}
        </View>

        <View style={s.parties}>
          <View style={s.party}>
            <Text style={s.label}>{L.supplier}</Text>
            <Text style={s.name}>{sup.name}</Text>
            {addr(sup.address).map((l) => <Text key={l}>{l}</Text>)}
            {sup.ic ? <Text style={{ marginTop: 4 }}>{L.ic}: {sup.ic}</Text> : null}
            {sup.dic ? <Text>{L.dic}: {sup.dic}</Text> : null}
            {sup.registration ? <Text style={{ color: C.muted, marginTop: 4, fontSize: 7.5 }}>{sup.registration}</Text> : null}
          </View>
          <View style={s.partyBox}>
            <Text style={s.label}>{L.customer}</Text>
            <Text style={s.name}>{inv.customerSnapshot.name}</Text>
            {addr(inv.customerSnapshot.address).map((l) => <Text key={l}>{l}</Text>)}
            {inv.customerSnapshot.ic ? <Text style={{ marginTop: 4 }}>{L.ic}: {inv.customerSnapshot.ic}</Text> : null}
            {inv.customerSnapshot.dic ? <Text>{L.dic}: {inv.customerSnapshot.dic}</Text> : null}
          </View>
        </View>

        <View style={s.meta}>
          <View style={s.metaCol}>
            <View style={s.metaRow}><Text style={s.metaKey}>{L.issueDate}</Text><Text style={s.metaVal}>{date(inv.issueDate)}</Text></View>
            {/* A tax document for a received payment has no due date; its tax date is the day the money came in (§ 29(1)(h)). */}
            {!taxDoc ? <View style={s.metaRow}><Text style={s.metaKey}>{L.dueDate}</Text><Text style={s.metaVal}>{date(inv.dueDate)}</Text></View> : null}
            {isPayer && inv.taxableSupplyDate ? (
              <View style={s.metaRow}><Text style={s.metaKey}>{taxDoc ? L.paymentReceived : L.taxableSupplyDate}</Text><Text style={s.metaVal}>{date(inv.taxableSupplyDate)}</Text></View>
            ) : null}
            <View style={s.metaRow}><Text style={s.metaKey}>{L.paymentMethod}</Text><Text style={s.metaVal}>{methodLabel}</Text></View>
          </View>
          <View style={s.metaCol}>
            {bank && sup.bank.account ? (
              <View style={s.metaRow}><Text style={s.metaKey}>{L.account}</Text><Text style={s.metaVal}>{sup.bank.account}/{sup.bank.bankCode}</Text></View>
            ) : null}
            {bank && sup.bank.iban ? <View style={s.metaRow}><Text style={s.metaKey}>{L.iban}</Text><Text style={s.metaVal}>{sup.bank.iban.replace(/(.{4})/g, '$1 ').trim()}</Text></View> : null}
            {bank && sup.bank.swift ? <View style={s.metaRow}><Text style={s.metaKey}>{L.swift}</Text><Text style={s.metaVal}>{sup.bank.swift}</Text></View> : null}
            {inv.paymentMethod !== 'cash' && inv.variableSymbol ? <View style={s.metaRow}><Text style={s.metaKey}>{L.vs}</Text><Text style={s.metaVal}>{inv.variableSymbol}</Text></View> : null}
            {taxDoc && inv.advanceNumber ? <View style={s.metaRow}><Text style={s.metaKey}>{L.forProforma}</Text><Text style={s.metaVal}>{inv.advanceNumber}</Text></View> : null}
            {credit && inv.correctsNumber ? <View style={s.metaRow}><Text style={s.metaKey}>{L.corrects}</Text><Text style={s.metaVal}>{inv.correctsNumber}</Text></View> : null}
            {inv.orderNumber ? <View style={s.metaRow}><Text style={s.metaKey}>{L.orderNumber}</Text><Text style={s.metaVal}>{inv.orderNumber}</Text></View> : null}
          </View>
        </View>

        <View style={s.th}>
          <Text style={s.cDesc}>{L.description}</Text>
          <Text style={s.cQty}>{L.qty}</Text>
          <Text style={s.cPrice}>{L.unitPrice}</Text>
          {vatOn ? <Text style={s.cVat}>{L.vatRate}</Text> : null}
          <Text style={s.cTotal}>{vatOn ? L.base : L.total}</Text>
        </View>
        {inv.lines.map((l, i) => (
          <View key={i} style={s.tr} wrap={false}>
            <Text style={s.cDesc}>{l.description}</Text>
            <Text style={s.cQty}>{qty(l.quantity)}{l.unit ? ` ${l.unit}` : ''}</Text>
            <Text style={s.cPrice}>{money(l.unitPrice)}</Text>
            {vatOn ? <Text style={s.cVat}>{l.vatRate} %</Text> : null}
            <Text style={s.cTotal}>{money(lineBase(l))}</Text>
          </View>
        ))}

        <View style={s.bottom} wrap={false}>
          <View style={s.qr}>
            {qr ? (
              <>
                <Image src={qr} style={s.qrImg} />
                <Text style={{ fontSize: 7, color: C.muted, marginTop: 3 }}>{L.qrPayment}</Text>
              </>
            ) : null}
          </View>
          <View style={s.totals}>
            {vatOn ? (
              <>
                <Text style={[s.label, { marginBottom: 2 }]}>{L.vatSummary}</Text>
                {totals.byRate.map((r) => (
                  <View key={r.rate} style={s.sumRow}>
                    <Text style={{ color: C.muted }}>{r.rate} %: {money(r.base)} + {L.vat}</Text>
                    <Text>{money(r.vat)}</Text>
                  </View>
                ))}
                <View style={[s.sumRow, { borderTop: `0.5 solid ${C.line}`, marginTop: 2, paddingTop: 4 }]}>
                  <Text style={{ color: C.muted }}>{L.base} / {L.vat}</Text>
                  <Text>{money(totals.base)} / {money(totals.vat)}</Text>
                </View>
              </>
            ) : null}
            {advance ? (
              <>
                <View style={[s.sumRow, { marginTop: 4 }]}><Text style={{ color: C.muted }}>{L.total}</Text><Text>{money(totals.total)}</Text></View>
                {/* A payer's final invoice deducts the advance's base and VAT per rate, as its tax document stated them. */}
                {(inv.advanceVat ?? []).filter((r) => r.vat).map((r) => (
                  <View key={r.rate} style={s.sumRow}>
                    <Text style={{ color: C.muted }}>{L.advanceDeducted} {r.rate} %</Text>
                    <Text>{money(-r.base)} / {money(-r.vat)}</Text>
                  </View>
                ))}
                <View style={s.sumRow}><Text style={{ color: C.muted }}>{L.advancePaid} {inv.advanceTaxDocNumber ?? inv.advanceNumber}</Text><Text>{money(-advance)}</Text></View>
              </>
            ) : null}
            <View style={[s.toPay, { backgroundColor: accent }]}>
              <Text>{taxDoc ? L.received : credit ? L.difference : advance ? L.balanceDue : L.toPay}</Text>
              <Text style={s.toPayAmount}>{money(totals.total - advance)}</Text>
            </View>
            {inv.status === 'paid' && !taxDoc ? (
              <Text style={{ textAlign: 'right', marginTop: 4, color: C.success, fontWeight: 600 }}>{L.paidDoNotPay.replace('{date}', date(inv.paidDate))}</Text>
            ) : null}
          </View>
        </View>

        {notes.length > 0 && (
          <View style={s.note}>
            {notes.map((n) => <Text key={n}>{n}</Text>)}
          </View>
        )}

        {look.stamp ? (
          <View style={{ alignItems: 'flex-end', marginTop: 16 }} wrap={false}>
            <Image src={look.stamp} style={{ maxWidth: 160, maxHeight: 80, objectFit: 'contain' }} />
          </View>
        ) : null}

        <View style={[s.footer, { flexDirection: 'column', gap: 2 }]} fixed>
          {look.footer ? <Text>{look.footer}</Text> : null}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text>{L.issuedBy}: {[sup.name, sup.email, sup.phone].filter(Boolean).join(' · ')}</Text>
            <Text render={({ pageNumber, totalPages }) => (totalPages > 1 ? `${pageNumber} / ${totalPages}` : sup.web)} />
          </View>
        </View>
      </Page>
    </Document>
  )
}
