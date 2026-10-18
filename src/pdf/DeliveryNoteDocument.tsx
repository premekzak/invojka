import { Document, Page, Text, View } from '@react-pdf/renderer'
import { formatDocDate, LOCALES } from '@/domain/language'
import type { Invoice, Settings } from '@/domain/schema'
import { C, s } from './InvoiceDocument'
import { invoiceLabels } from './labels'

/** The delivery note's number: the invoice's with "DL" in front, so each invoice has exactly one. */
export const deliveryNoteNumber = (inv: Pick<Invoice, 'number'>) => `DL${inv.number}`

/**
 * Dodací list for an invoice: who delivers what to whom and when, quantities without prices, and room for both
 * signatures. Same look as the invoice (docs/invoicing-rules.md).
 */
export function DeliveryNoteDocument({ invoice: inv, settings }: { invoice: Invoice; settings: Settings }) {
  const L = invoiceLabels[inv.language]
  const sup = settings.supplier
  const accent = C.accents[settings.invoice.color]
  const date = (iso: string) => formatDocDate(iso, inv.language)
  const qty = (n: number) => n.toLocaleString(LOCALES[inv.language], { maximumFractionDigits: 3 })
  const addr = (a: { street: string; zip: string; city: string; country: string }) =>
    [a.street, [a.zip, a.city].filter(Boolean).join(' '), a.country].filter(Boolean)
  const number = deliveryNoteNumber(inv)

  return (
    <Document title={`${L.deliveryNote} ${number}`} author={sup.name} creator="Invojka" producer="Invojka" language={inv.language}>
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <View>
            <Text style={[s.title, { color: accent }]}>{L.deliveryNote}</Text>
            <Text style={s.number}>{number}</Text>
          </View>
          <Text style={{ fontSize: 11, fontWeight: 600, color: C.ink, maxWidth: 220, textAlign: 'right' }}>{sup.name}</Text>
        </View>

        <View style={s.parties}>
          <View style={s.party}>
            <Text style={s.label}>{L.supplier}</Text>
            <Text style={s.name}>{sup.name}</Text>
            {addr(sup.address).map((l) => <Text key={l}>{l}</Text>)}
            {sup.ic ? <Text style={{ marginTop: 4 }}>{L.ic}: {sup.ic}</Text> : null}
          </View>
          <View style={s.partyBox}>
            <Text style={s.label}>{L.customer}</Text>
            <Text style={s.name}>{inv.customerSnapshot.name}</Text>
            {addr(inv.customerSnapshot.address).map((l) => <Text key={l}>{l}</Text>)}
            {inv.customerSnapshot.ic ? <Text style={{ marginTop: 4 }}>{L.ic}: {inv.customerSnapshot.ic}</Text> : null}
          </View>
        </View>

        <View style={s.meta}>
          <View style={s.metaCol}>
            <View style={s.metaRow}><Text style={s.metaKey}>{L.deliveryDate}</Text><Text style={s.metaVal}>{date(inv.taxableSupplyDate ?? inv.issueDate)}</Text></View>
          </View>
          <View style={s.metaCol}>
            <View style={s.metaRow}><Text style={s.metaKey}>{L.deliveryFor}</Text><Text style={s.metaVal}>{inv.number}</Text></View>
            {inv.orderNumber ? <View style={s.metaRow}><Text style={s.metaKey}>{L.orderNumber}</Text><Text style={s.metaVal}>{inv.orderNumber}</Text></View> : null}
          </View>
        </View>

        <View style={s.th}>
          <Text style={s.cDesc}>{L.description}</Text>
          <Text style={s.cTotal}>{L.qty}</Text>
        </View>
        {inv.lines.filter((l) => l.unitPrice >= 0).map((l, i) => (
          <View key={i} style={s.tr} wrap={false}>
            <Text style={s.cDesc}>{l.description}</Text>
            <Text style={s.cTotal}>{qty(l.quantity)}{l.unit ? ` ${l.unit}` : ''}</Text>
          </View>
        ))}

        <View style={{ flexDirection: 'row', gap: 48, marginTop: 72 }}>
          {[L.signHanded, L.signTaken].map((label) => (
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
