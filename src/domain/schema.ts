import { z } from 'zod'
import { INVOICE_LANGS } from './language'

export const SCHEMA_VERSION = 1

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD')
const minor = z.number().int()
const lang = z.enum(['cs', 'en'])
/** An invoice can also be printed in German or Slovak; the app itself speaks Czech and English (domain/language.ts). */
const invoiceLang = z.enum(INVOICE_LANGS)
/** Colour schemes, in the order Settings offers them; each but 'warm' has a file in src/schemes/. */
export const SCHEMES = ['warm', 'tyrkys', 'branicek', 'modrotisk', 'praha', 'kolac'] as const
/** Accent colours offered for the invoice PDF; the values are in pdf/palette.ts. */
export const INVOICE_COLORS = ['neutral', 'blue', 'teal', 'green', 'wine', 'orange'] as const
/** How the customer pays: bank transfer, cash, or cash on delivery (dobírka). Only 'bank' prints the account and QR. */
export const PaymentMethod = z.enum(['bank', 'cash', 'cod'])
export type PaymentMethod = z.infer<typeof PaymentMethod>

export const Address = z.object({
  street: z.string().default(''),
  zip: z.string().default(''),
  city: z.string().default(''),
  country: z.string().default(''),
})

const Party = z.object({
  name: z.string().min(1),
  ic: z.string().default(''), // IČ — kept as string to preserve leading zeros
  dic: z.string().default(''), // DIČ
  address: Address.prefault({}),
})

const EmailTemplate = z.object({ subject: z.string().default(''), body: z.string().default('') })

export const Settings = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  supplier: Party.extend({
    email: z.string().default(''),
    phone: z.string().default(''),
    web: z.string().default(''),
    registration: z.string().default(''), // e.g. "Zapsán v živnostenském rejstříku…"
    bank: z.object({
      account: z.string().default(''),
      bankCode: z.string().default(''),
      iban: z.string().default(''),
      swift: z.string().default(''),
    }).prefault({}),
  }),
  vatMode: z.enum(['payer', 'nonPayer', 'identifiedPerson']),
  defaultVatRate: z.number().default(21),
  numbering: z.object({
    pattern: z.string().default('{YYYY}{NNNN}'),
    /** Its own series, so credit notes never leave a gap among the invoices. */
    creditNotePattern: z.string().default('D{YYYY}{NNNN}'),
    /** Proformas aren't tax documents, so they don't take numbers from the invoice series either. */
    proformaPattern: z.string().default('Z{YYYY}{NNNN}'),
    /** VAT payers' tax documents for a received advance (daňový doklad k přijaté platbě). */
    advanceTaxDocPattern: z.string().default('ZD{YYYY}{NNNN}'),
    /**
     * The last invoice number issued elsewhere (another service, Excel), set in onboarding without an import: the
     * invoice series goes on after it instead of starting at 1 in the middle of a year.
     */
    continueFrom: z.string().default(''),
  }).prefault({}),
  defaults: z.object({
    dueDays: z.number().int().min(0).default(14),
    currency: z.string().default('CZK'),
    invoiceLanguage: invoiceLang.default('cs'),
    paymentMethod: PaymentMethod.default('bank'),
    unit: z.string().default(''),
    note: z.string().default(''),
  }).prefault({}),
  /**
   * How the invoice PDF looks: an accent colour (neutral by default, the owner's original choice), a logo and a stamp or
   * signature as small PNG data URLs, and a footer line.
   */
  invoice: z.object({
    color: z.enum(INVOICE_COLORS).default('neutral'),
    logo: z.string().optional(),
    stamp: z.string().optional(),
    footer: z.string().default(''),
  }).prefault({}),
  /** Sole traders (OSVČ) see an estimate of their tax and insurance on Home, with this flat-rate expense share. */
  taxes: z.object({
    selfEmployed: z.boolean().default(true),
    /** Main or secondary activity (hlavní / vedlejší činnost); see domain/taxes.ts. */
    activity: z.enum(['main', 'secondary']).default('main'),
    /** Secondary activity only: the basic personal allowance claimed here rather than at work. */
    taxpayerCredit: z.boolean().default(false),
    expenseRate: z.union([z.literal(80), z.literal(60), z.literal(40), z.literal(30)]).default(60),
    /**
     * A tax return with flat-rate expenses, the flat-rate tax regime (paušální daň, non-payers of VAT only), tax records
     * with real expenses, or accounts. Invojka estimates only the first two; see domain/taxes.ts.
     */
    regime: z.enum(['standard', 'flat', 'records', 'accounts']).default('standard'),
    /** The flat-tax band the sole trader registered for (chosen by last year's income). */
    flatBand: z.union([z.literal(1), z.literal(2), z.literal(3)]).default(1),
  }).prefault({}),
  /**
   * What the year held before Invojka, typed in onboarding by someone who invoiced elsewhere: money received (without a
   * payer's VAT) and turnover to Czech customers, CZK minor units. Added to Home's tax estimate and VAT limit for that
   * year only; year 0 is none.
   */
  opening: z.object({
    year: z.number().int().default(0),
    income: minor.default(0),
    turnover: minor.default(0),
  }).prefault({}),
  /** Saved items to put on invoices quickly (ceník): picked by their description in the editor. */
  priceList: z.array(z.object({
    description: z.string(),
    unit: z.string().default(''),
    unitPrice: minor,
    vatRate: z.number().default(0),
  })).default([]),
  /** The user's own e-mail texts; an empty or missing one falls back to the built-in text (domain/email.ts). */
  emailTemplates: z.object({
    invoice: z.object({ cs: EmailTemplate.optional(), en: EmailTemplate.optional(), de: EmailTemplate.optional(), sk: EmailTemplate.optional() }).optional(),
    reminder: z.object({ cs: EmailTemplate.optional(), en: EmailTemplate.optional(), de: EmailTemplate.optional(), sk: EmailTemplate.optional() }).optional(),
  }).optional(),
  ui: z.object({
    language: lang.default('cs'),
    theme: z.enum(['system', 'light', 'dark']).default('system'),
    /** Colour scheme (docs/ui.md#colour-schemes); 'warm' is Warm paper, the default. Light and dark come from `theme`. */
    scheme: z.enum(SCHEMES).default('warm'),
    /**
     * The first-steps checklist on Home: the steps ticked by hand (those Invojka can't see, like a bookmark). Onboarding
     * sets it to []; missing means hidden, so it never appears for someone who set up before it existed or closed it.
     */
    firstSteps: z.array(z.string()).optional(),
  }).prefault({}),
})
export type Settings = z.infer<typeof Settings>

export const Customer = Party.extend({
  id: z.string(),
  email: z.string().default(''),
  cc: z.array(z.string()).default([]),
  phone: z.string().default(''),
  web: z.string().default(''),
  contactName: z.string().default(''),
  defaultCurrency: z.string().optional(),
  defaultLanguage: invoiceLang.optional(),
  reverseCharge: z.boolean().default(false),
  note: z.string().default(''),
  archived: z.boolean().default(false),
  /** Billed regularly: every month, quarter or year, from this day of the period (1–28). See domain/recurring.ts. */
  recurring: z.object({ every: z.enum(['month', 'quarter', 'year']), day: z.number().int().min(1).max(28) }).optional(),
})
export type Customer = z.infer<typeof Customer>

export const CustomersFile = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  customers: z.array(Customer),
})
export type CustomersFile = z.infer<typeof CustomersFile>

export const InvoiceLine = z.object({
  description: z.string(),
  quantity: z.number(),
  unit: z.string().default(''),
  unitPrice: minor, // net, in minor units
  vatRate: z.number().default(0),
})
export type InvoiceLine = z.infer<typeof InvoiceLine>

export const InvoiceStatus = z.enum(['draft', 'issued', 'paid', 'cancelled'])
export type InvoiceStatus = z.infer<typeof InvoiceStatus>

/**
 * An ordinary invoice, a credit note that corrects one (opravný daňový doklad / opravná faktura), or a proforma
 * (zálohová faktura), a request for an advance payment that is no tax document and no revenue.
 */
export const InvoiceKind = z.enum(['invoice', 'creditNote', 'proforma', 'advanceTaxDoc'])
export type InvoiceKind = z.infer<typeof InvoiceKind>

export const Invoice = z.object({
  id: z.string(),
  kind: InvoiceKind.default('invoice'),
  number: z.string(),
  variableSymbol: z.string().default(''),
  orderNumber: z.string().default(''),
  customerId: z.string().nullable(),
  customerSnapshot: Party,
  issueDate: isoDate,
  dueDate: isoDate,
  taxableSupplyDate: isoDate.optional(), // DUZP, only for VAT payers
  paidDate: isoDate.optional(),
  paidAmount: minor.optional(),
  currency: z.string(),
  exchangeRate: z.number().positive().optional(), // CZK per 1 unit of currency
  exchangeRateSource: z.enum(['cnb', 'ecb', 'manual']).optional(),
  language: invoiceLang,
  paymentMethod: PaymentMethod.default('bank'),
  vatMode: z.enum(['payer', 'nonPayer', 'identifiedPerson']), // supplier's mode when issued
  reverseCharge: z.boolean().default(false),
  lines: z.array(InvoiceLine).min(1),
  /** Total as recorded (e.g. by import). Used for sanity checks; UI always recomputes from lines. */
  recordedTotal: minor.optional(),
  note: z.string().default(''),
  /** Credit notes only: the corrected invoice (its id, and its number as printed) and why it's corrected. */
  correctsId: z.string().optional(),
  correctsNumber: z.string().optional(),
  correctionReason: z.string().default(''),
  /** A final invoice that settles a paid proforma: the proforma's id and number, and the advance deducted (minor units). */
  advanceId: z.string().optional(),
  advanceNumber: z.string().optional(),
  advanceAmount: minor.optional(),
  /**
   * VAT payers: the tax document for the received advance. On the tax document itself `advanceId` points to its proforma;
   * a final invoice keeps the tax document's number and the base and VAT per rate it deducts.
   */
  advanceTaxDocNumber: z.string().optional(),
  advanceVat: z.array(z.object({ rate: z.number(), base: minor, vat: minor })).optional(),
  status: InvoiceStatus,
  /** A note for the user only, never printed. */
  privateNote: z.string().default(''),
  /** Written off as uncollectible (nedobytná) on this date; it stays revenue but no longer waits for payment. */
  uncollectible: isoDate.optional(),
  /** The user's own labels, for finding and filtering. */
  tags: z.array(z.string()).default([]),
  /** When the invoice was sent and when reminders went out (yyyy-mm-dd), as the user opened them in their mail program. */
  sentAt: z.string().optional(),
  reminders: z.array(isoDate).default([]),
  exportedAt: z.string().optional(),
})
export type Invoice = z.infer<typeof Invoice>

export const InvoicesFile = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  invoices: z.array(Invoice),
})
export type InvoicesFile = z.infer<typeof InvoicesFile>

export const FILES = {
  settings: 'settings.json',
  customers: 'customers.json',
  invoices: 'invoices.json',
} as const
