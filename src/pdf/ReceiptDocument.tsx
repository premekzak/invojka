import { Document, Page, Text, View } from '@react-pdf/renderer'
import { formatDocDate } from '@/domain/language'
import { formatMoney } from '@/domain/money'
import { receiptNumber } from '@/domain/payment'
import type { Invoice, Settings } from '@/domain/schema'
import { chargesVat, computeTotals } from '@/domain/vat'
import { C, s } from './InvoiceDocument'
import { invoiceLabels } from './labels'

/**
 * Příjmový pokladní doklad for a cash invoice once it's paid: who paid whom, how much, when and for which invoice,
 * with room for both signatures (docs/czech-rules.md#cash-payments). Same look as the invoice.
 */
export function ReceiptDocument({ invoice: inv, settings }: { invoice: Invoice; settings: Settings }) {
  const L = invoiceLabels[inv.language]
  const sup = settings.supplier
  const totals = computeTotals(inv.lines, inv.vatMode, inv.reverseCharge)
  const money = (m: number) => formatMoney(m, inv.currency, inv.language).replace(/ /g, ' ')
  const date = (iso?: string) => (iso ? formatDocDate(iso, inv.language) : '')
  const addr = (a: { street: string; zip: string; city: string; country: string }) =>
    [a.street, [a.zip, a.city].filter(Boolean).join(' '), a.country].filter(Boolean)
  const number = receiptNumber(inv)
  const accent = C.accents[settings.invoice.color]

  return (
    <Document title={`${L.receipt} ${number}`} author={sup.name} creator="Invojka" producer="Invojka" language={inv.language}>
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <View>
            <Text style={[s.title, { color: accent }]}>{L.receipt}</Text>
            <Text style={s.number}>{number}</Text>
          </View>
          <Text style={{ fontSize: 11, fontWeight: 600, color: C.ink, maxWidth: 220, textAlign: 'right' }}>{sup.name}</Text>
        </View>

        <View style={s.parties}>
          <View style={s.party}>
            <Text style={s.label}>{L.receivedBy}</Text>
            <Text style={s.name}>{sup.name}</Text>
            {addr(sup.address).map((l) => <Text key={l}>{l}</Text>)}
            {sup.ic ? <Text style={{ marginTop: 4 }}>{L.ic}: {sup.ic}</Text> : null}
            {sup.dic ? <Text>{L.dic}: {sup.dic}</Text> : null}
          </View>
          <View style={s.partyBox}>
            <Text style={s.label}>{L.receivedFrom}</Text>
            <Text style={s.name}>{inv.customerSnapshot.name}</Text>
            {addr(inv.customerSnapshot.address).map((l) => <Text key={l}>{l}</Text>)}
            {inv.customerSnapshot.ic ? <Text style={{ marginTop: 4 }}>{L.ic}: {inv.customerSnapshot.ic}</Text> : null}
            {inv.customerSnapshot.dic ? <Text>{L.dic}: {inv.customerSnapshot.dic}</Text> : null}
          </View>
        </View>

        <View style={s.meta}>
          <View style={s.metaCol}>
            <View style={s.metaRow}><Text style={s.metaKey}>{L.receiptDate}</Text><Text style={s.metaVal}>{date(inv.paidDate ?? inv.issueDate)}</Text></View>
            <View style={s.metaRow}><Text style={s.metaKey}>{L.paymentMethod}</Text><Text style={s.metaVal}>{L.cash}</Text></View>
          </View>
          <View style={s.metaCol}>
            <View style={s.metaRow}><Text style={s.metaKey}>{L.purpose}</Text><Text style={s.metaVal}>{L.paymentOf} {inv.number}</Text></View>
          </View>
        </View>

        <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
          <View style={s.totals}>
            <View style={[s.toPay, { backgroundColor: accent }]}>
              <Text>{L.amount}</Text>
              <Text style={s.toPayAmount}>{money(inv.paidAmount ?? totals.total)}</Text>
            </View>
            {chargesVat(inv.vatMode, inv.reverseCharge) ? totals.byRate.map((r) => (
              <View key={r.rate} style={[s.sumRow, { marginTop: 2 }]}>
                <Text style={{ color: C.muted }}>{L.ofWhichVat} {r.rate} % ({L.base} {money(r.base)})</Text>
                <Text>{money(r.vat)}</Text>
              </View>
            )) : null}
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: 48, marginTop: 72 }}>
          {[L.signReceived, L.signPaid].map((label) => (
            <View key={label} style={{ flex: 1, borderTop: `0.5 solid ${C.muted}`, paddingTop: 4 }}>
              <Text style={{ color: C.muted }}>{label}</Text>
            </View>
          ))}
        </View>

        <View style={s.footer} fixed>
          <Text>{L.issuedBy}: {[sup.name, sup.email, sup.phone].filter(Boolean).join(' · ')}</Text>
          <Text>{sup.web}</Text>
        </View>
      </Page>
    </Document>
  )
}
