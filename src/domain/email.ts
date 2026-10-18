import { differenceInCalendarDays, parseISO } from 'date-fns'
import { formatDocDate, type InvoiceLang } from './language'
import { amountDue } from './invoice'
import { formatMoney } from './money'
import type { Invoice, Settings } from './schema'

/**
 * E-mails for sending an invoice or a reminder. Invojka has no server, so it never sends anything itself: it fills in
 * a template and opens the user's own mail program (`mailto:`), and the user attaches the PDF. See docs/email.md.
 */

export type EmailKind = 'invoice' | 'reminder'
export interface EmailTemplate { subject: string; body: string }

/**
 * Placeholders, without diacritics so they're easy to type: number, amount due, due date, days overdue, the sentence on
 * how to pay (empty without a bank transfer or an account), payment reference, bank account, customer, supplier. Each
 * invoice language has its own names (the owner, 2026-10-18: an English template with {castka} was confusing); every
 * language's names work in every template, so texts written earlier keep working.
 */
export const PLACEHOLDERS = ['cislo', 'castka', 'splatnost', 'dny', 'platba', 'vs', 'ucet', 'odberatel', 'dodavatel'] as const
export type Placeholder = (typeof PLACEHOLDERS)[number]

export const PLACEHOLDER_NAMES: Record<InvoiceLang, Record<Placeholder, string>> = {
  cs: { cislo: 'cislo', castka: 'castka', splatnost: 'splatnost', dny: 'dny', platba: 'platba', vs: 'vs', ucet: 'ucet', odberatel: 'odberatel', dodavatel: 'dodavatel' },
  en: { cislo: 'number', castka: 'amount', splatnost: 'due', dny: 'days', platba: 'payment', vs: 'reference', ucet: 'account', odberatel: 'customer', dodavatel: 'supplier' },
  de: { cislo: 'nummer', castka: 'betrag', splatnost: 'faellig', dny: 'tage', platba: 'zahlung', vs: 'referenz', ucet: 'konto', odberatel: 'kunde', dodavatel: 'lieferant' },
  sk: { cislo: 'cislo', castka: 'suma', splatnost: 'splatnost', dny: 'dni', platba: 'platba', vs: 'vs', ucet: 'ucet', odberatel: 'odberatel', dodavatel: 'dodavatel' },
}

/** Built-in texts, used until the user writes their own in Settings. */
export const DEFAULT_TEMPLATES: Record<EmailKind, Record<InvoiceLang, EmailTemplate>> = {
  invoice: {
    cs: {
      subject: 'Faktura {cislo}',
      body: 'Dobrý den,\n\nv příloze posílám fakturu {cislo} na {castka} se splatností {splatnost}. {platba}\n\nDěkuji a přeji hezký den\n{dodavatel}',
    },
    en: {
      subject: 'Invoice {number}',
      body: 'Hello,\n\nplease find attached invoice {number} for {amount}, due on {due}. {payment}\n\nThank you and kind regards,\n{supplier}',
    },
    de: {
      subject: 'Rechnung {nummer}',
      body: 'Guten Tag,\n\nanbei sende ich Ihnen die Rechnung {nummer} über {betrag}, fällig am {faellig}. {zahlung}\n\nVielen Dank und freundliche Grüße\n{lieferant}',
    },
    sk: {
      subject: 'Faktúra {cislo}',
      body: 'Dobrý deň,\n\nv prílohe posielam faktúru {cislo} na {suma} so splatnosťou {splatnost}. {platba}\n\nĎakujem a prajem pekný deň\n{dodavatel}',
    },
  },
  reminder: {
    cs: {
      subject: 'Upomínka: faktura {cislo}',
      body: 'Dobrý den,\n\nfaktura {cislo} na {castka} byla splatná {splatnost}, tedy před {dny} dny, a zatím ji neevidujeme jako zaplacenou. Pokud už je platba na cestě, děkuji a tento e-mail prosím přehlédněte.\n\n{platba} Fakturu přikládám znovu.\n\nDěkuji\n{dodavatel}',
    },
    en: {
      subject: 'Reminder: invoice {number}',
      body: 'Hello,\n\ninvoice {number} for {amount} was due on {due}, {days} days ago, and we haven’t received the payment yet. If it’s already on its way, thank you, and please ignore this e-mail.\n\n{payment} The invoice is attached again.\n\nThank you,\n{supplier}',
    },
    de: {
      subject: 'Zahlungserinnerung: Rechnung {nummer}',
      body: 'Guten Tag,\n\ndie Rechnung {nummer} über {betrag} war am {faellig} fällig, vor {tage} Tagen, und wir haben die Zahlung noch nicht erhalten. Falls sie bereits unterwegs ist, vielen Dank, und betrachten Sie diese E-Mail bitte als gegenstandslos.\n\n{zahlung} Die Rechnung liegt noch einmal bei.\n\nVielen Dank\n{lieferant}',
    },
    sk: {
      subject: 'Upomienka: faktúra {cislo}',
      body: 'Dobrý deň,\n\nfaktúra {cislo} na {suma} bola splatná {splatnost}, teda pred {dni} dňami, a zatiaľ ju neevidujeme ako zaplatenú. Ak je platba už na ceste, ďakujem a tento e-mail, prosím, prehliadnite.\n\n{platba} Faktúru prikladám znova.\n\nĎakujem\n{dodavatel}',
    },
  },
}

/** The template for this kind and language: the user's own if they wrote one, else the built-in one. */
export function templateFor(settings: Settings, kind: EmailKind, lang: InvoiceLang): EmailTemplate {
  const own = settings.emailTemplates?.[kind]?.[lang]
  const def = DEFAULT_TEMPLATES[kind][lang]
  return { subject: own?.subject || def.subject, body: own?.body || def.body }
}

/** The {platba} sentence in each language. */
const HOW_TO_PAY: Record<InvoiceLang, (account: string, vs: string) => string> = {
  cs: (a, vs) => `Platbu prosím pošlete na účet ${a} s variabilním symbolem ${vs}.`,
  en: (a, vs) => `Please pay to account ${a} with the payment reference ${vs}.`,
  de: (a, vs) => `Bitte überweisen Sie den Betrag auf das Konto ${a} mit der Zahlungsreferenz ${vs}.`,
  sk: (a, vs) => `Platbu, prosím, pošlite na účet ${a} s variabilným symbolom ${vs}.`,
}

/** The values for the placeholders, written the way the invoice's language writes them. */
export function placeholderValues(inv: Invoice, settings: Settings, on: string): Record<Placeholder, string> {
  const bank = settings.supplier.bank
  const account = bank.account ? `${bank.account}/${bank.bankCode}` : bank.iban
  const howToPay = inv.paymentMethod !== 'bank' || !account ? '' : HOW_TO_PAY[inv.language](account, inv.variableSymbol)
  return {
    cislo: inv.number,
    // Intl's narrow no-break space becomes a regular one, which mail programs show reliably; the amount still won't split.
    castka: formatMoney(amountDue(inv), inv.currency, inv.language).replace(/ /g, ' '),
    splatnost: formatDocDate(inv.dueDate, inv.language),
    dny: String(Math.max(0, differenceInCalendarDays(parseISO(on), parseISO(inv.dueDate)))),
    platba: howToPay,
    vs: inv.variableSymbol,
    ucet: account,
    odberatel: inv.customerSnapshot.name,
    dodavatel: settings.supplier.name,
  }
}

/** Replaces {placeholders}; an unknown one stays as typed, so a typo is visible in the e-mail rather than lost. */
export const fillTemplate = (text: string, values: Record<string, string>) =>
  text.replace(/\{(\w+)\}/g, (all, key: string) => values[key] ?? all)
    // An empty placeholder leaves no stray spaces or blank paragraph behind.
    .replace(/[ \t]+\n/g, '\n').replace(/\n[ \t]+/g, '\n').replace(/\n{3,}/g, '\n\n').replace(/ {2,}/g, ' ')

/** The values under every language's names, so a template can use any of them. */
export function valuesByAllNames(values: Record<Placeholder, string>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const names of Object.values(PLACEHOLDER_NAMES)) for (const key of PLACEHOLDERS) out[names[key]] = values[key]
  return out
}

/** The e-mail filled in for this invoice. */
export function composeEmail(inv: Invoice, settings: Settings, kind: EmailKind, on: string): EmailTemplate {
  const values = valuesByAllNames(placeholderValues(inv, settings, on))
  const tpl = templateFor(settings, kind, inv.language)
  return { subject: fillTemplate(tpl.subject, values), body: fillTemplate(tpl.body, values) }
}

/** A `mailto:` link: addresses as typed, subject and body encoded, line breaks as CRLF (RFC 6068). */
export function mailtoLink(to: string[], cc: string[], subject: string, body: string): string {
  const q = [`subject=${encodeURIComponent(subject)}`, `body=${encodeURIComponent(body.replace(/\r?\n/g, '\r\n'))}`]
  if (cc.length) q.unshift(`cc=${cc.map(encodeURIComponent).join(',')}`)
  return `mailto:${to.map(encodeURIComponent).join(',')}?${q.join('&')}`
}
