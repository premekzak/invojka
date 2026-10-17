import { z } from 'zod'

export const SCHEMA_VERSION = 1

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD')
const minor = z.number().int()
const lang = z.enum(['cs', 'en'])

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
  numbering: z.object({ pattern: z.string().default('{YYYY}{NNNN}') }).prefault({}),
  defaults: z.object({
    dueDays: z.number().int().min(0).default(14),
    currency: z.string().default('CZK'),
    invoiceLanguage: lang.default('cs'),
    unit: z.string().default(''),
    note: z.string().default(''),
  }).prefault({}),
  ui: z.object({
    language: lang.default('cs'),
    theme: z.enum(['system', 'light', 'dark']).default('system'),
    /** Colour scheme (docs/ui.md#colour-schemes); 'warm' is Warm paper, the default. Light and dark come from `theme`. */
    scheme: z.enum(['warm', 'branicek']).default('warm'),
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
  defaultLanguage: lang.optional(),
  reverseCharge: z.boolean().default(false),
  note: z.string().default(''),
  archived: z.boolean().default(false),
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

export const Invoice = z.object({
  id: z.string(),
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
  language: lang,
  vatMode: z.enum(['payer', 'nonPayer', 'identifiedPerson']), // supplier's mode when issued
  reverseCharge: z.boolean().default(false),
  lines: z.array(InvoiceLine).min(1),
  /** Total as recorded (e.g. by import). Used for sanity checks; UI always recomputes from lines. */
  recordedTotal: minor.optional(),
  note: z.string().default(''),
  status: InvoiceStatus,
  sentAt: z.string().optional(),
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
