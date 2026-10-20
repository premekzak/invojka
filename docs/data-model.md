# Data model

The data folder contains:

```
<data folder>/
  settings.json     the business profile and app settings
  customers.json    { schemaVersion, customers: Customer[] }
  invoices.json     { schemaVersion, invoices: Invoice[] }
  pdf/<year>/<number>.pdf   written when an invoice is issued, or with "Uložit do složky" (Save to folder)
```

- The source of truth is `src/domain/schema.ts` (Zod). Types come from `z.infer`.
- Files are pretty-printed JSON (2 spaces, trailing newline), so they're readable and diff well.
- There's one file per type (the owner's choice). The consequences for syncing are covered in [architecture.md](architecture.md#storage).

## Invariants the code relies on

- **Money is an integer in minor units** (haléře or cents). `toMinor` and `toMajor` in `money.ts` convert. Floats are never stored.
- **Dates are ISO `YYYY-MM-DD` strings.** String comparison gives chronological order.
- **Company IDs (IČ) and VAT IDs (DIČ) are strings**, because IČ can start with a zero (e.g. `01234567`). This is one reason YAML was rejected (see [decisions.md](decisions.md)).
- **Totals are always computed** from the lines with `computeTotals`. `recordedTotal` exists only to check the CSV import.
- **"Overdue" is never stored.** `displayStatus()` works it out from `status === 'issued'` and `dueDate < today`.
- **Drafts follow the supplier's VAT mode.** Switching it in settings refits every draft (`withVatMode`: rate, DUZP, reverse charge); issued invoices keep the mode they were issued with.
- **`customerSnapshot`** is a copy of the customer's name, IČ, DIČ and address, taken when an invoice is created. Editing a customer updates the snapshot on **drafts only**; issued invoices keep what was printed. When an issued, paid or cancelled invoice's snapshot differs from its customer (`snapshotDiffers`), the editor offers "Použít nové údaje" (Use the new details). The owner takes them on purpose, and saving rewrites the PDF in the folder.
- **Revenue is issued plus paid invoices, by issue date.** `countsAsRevenue` in `stats.ts` is the one rule; Home and the charts compute through `stats.ts`, so they show the same numbers. Invoices in another currency without an exchange rate add nothing, and Home lists them as a task. Customers show only **paid** invoices (`customerStats`, the owner's choice), so a customer's figure plus what's still unpaid equals the chart.
- **`checkData()`** in `check.ts` lists everything that breaks these rules (errors) or usually is a mistake (warnings): duplicate numbers, due before issue, a paid date without the paid status, gaps and out-of-order dates in the number series, and more. See [development.md](development.md#tests).
- **`schemaVersion`** is in every file, currently `1`.
  - A file with a higher version is refused with a message asking the user to update the app.
  - Migrations will run in `repo.ts` when a version changes.

## settings.json

| Field | Meaning |
|---|---|
| `supplier` | Name, IČ, DIČ, address, email, phone, web, `registration` (e.g. the trade-register line), and `bank` (`account`, `bankCode`, `iban`, `swift`). The IBAN is filled in automatically from a Czech account number and bank code. |
| `vatMode` | `payer`, `nonPayer` or `identifiedPerson`. See [invoicing-rules.md](invoicing-rules.md). |
| `defaultVatRate` | 21 by default. Used for new lines when the user is a VAT payer. |
| `numbering.pattern` | Default `{YYYY}{NNNN}`. See [invoicing-rules.md](invoicing-rules.md#numbering). |
| `numbering.creditNotePattern` | Default `D{YYYY}{NNNN}`: credit notes have their own series. |
| `numbering.proformaPattern` | Default `Z{YYYY}{NNNN}`: proformas have their own series. |
| `numbering.advanceTaxDocPattern` | Default `ZD{YYYY}{NNNN}`: VAT payers' tax documents for received advances. |
| `opening` | `{ year, income, turnover }`, default year 0 (none). This year before Invojka, typed in onboarding ("Fakturuji jinde") or Settings → Daně, CZK minor units: `turnover` (to Czech customers, by issue date) is added to the VAT limit (`vatTurnover`), `income` (received, without a payer's VAT) to the tax estimate (`cashIncome`). Only in its year. |
| `ui.firstSteps` | Optional array of step keys ticked by hand on Home's first-steps checklist (`domain/firstSteps.ts`). Onboarding sets `[]`; missing means the checklist is hidden (set up before it existed, or closed). |
| `numbering.continueFrom` | Default `''`. The last invoice number issued elsewhere, typed in onboarding without an import; the invoice series goes on after it (`usedNumbers`) until it restarts with a new year or month. |
| `defaults` | `dueDays` (14), `currency` (CZK), `invoiceLanguage`, `paymentMethod` (`bank`), `unit`, `note` |
| `invoice` | The PDF's look: `color` (`neutral` default, or `blue`, `teal`, `green`, `wine`, `orange`), `logo?` and `stamp?` (PNG data URLs shrunk to at most 600×200 and 480×240 px, so they travel with settings.json and need no extra file), `footer` (''). Demo mode drops the logo, stamp and footer. |
| `taxes` | `selfEmployed` (true): a sole trader sees the tax and insurance estimate on Home; `activity` (`main` or `secondary`, default `main`); `taxpayerCredit` (false): a secondary activity claims the basic allowance in the estimate (the main one always does); `expenseRate` (60): the flat-rate expense share, 80, 60, 40 or 30, which also sets the flat-tax band limits; `regime` (`standard`, `flat`, `records` or `accounts`, default `standard`): a tax return with flat-rate expenses, the flat-rate tax (paušální daň), tax records with real expenses, or accounts; the last two get no estimate; `flatBand` (1): the flat-tax band registered for. |
| `priceList` | Saved items `{ description, unit, unitPrice, vatRate }` (ceník). Defaults to `[]`. |
| `emailTemplates?` | The user's own e-mail texts: `{ invoice?, reminder? }`, each `{ cs?, en? }` of `{ subject, body }`. Missing means the built-in text. |
| `ui` | `language` (`cs` or `en`), `theme` (`system`, `light` or `dark`) |

## Customer

`id`, `name`, `ic`, `dic`, `address{street, zip, city, country}`, `email`, `cc[]`, `phone`, `web`, `contactName`, `defaultCurrency?`, `defaultLanguage?`, `reverseCharge`, `note` (internal only), `archived`, `recurring?` (`{ every: 'month' | 'quarter' | 'year', day: 1–28 }`, regular invoicing, see [invoicing-rules.md](invoicing-rules.md#regular-invoices-domainrecurringts)).

- **Archived** customers aren't offered for new invoices. A customer with no invoices can be deleted instead.
- DIČ is **not unique** (VAT groups), and IČ isn't unique in the source data either. See [csv-import.md](csv-import.md).

## Invoice

| Field | Meaning |
|---|---|
| `id` | UUID. Never shown to the user. |
| `number`, `variableSymbol` | The payment reference (variable symbol) is the number's digits by default. |
| `orderNumber` | Optional customer order or PO number. |
| `customerId`, `customerSnapshot` | See the invariants above. |
| `issueDate`, `dueDate`, `taxableSupplyDate?` | The tax point date (DUZP) is used only for VAT payers. |
| `paidDate?`, `paidAmount?` | Set when the invoice is marked paid. |
| `currency`, `exchangeRate?`, `exchangeRateSource?` | The rate is CZK per 1 unit. Source is `cnb`, `ecb` or `manual`. See [exchange-rates.md](exchange-rates.md). |
| `language` | `cs`, `en`, `de` or `sk`. The language the PDF is printed in. The settings' `defaults.invoiceLanguage` and the customer's `defaultLanguage` take the same four; the app's own `ui.language` stays `cs` or `en`. |
| `paymentMethod` | `bank` (bank transfer), `cash` or `cod` (cash on delivery, dobírka). Defaults to `bank`, so files saved before 2026-10-18 read as bank transfers without a migration. A new invoice takes it from the customer's last invoice, then from the settings. |
| `vatMode` | The supplier's mode **when the invoice was issued**, so changing the setting later doesn't rewrite history. |
| `reverseCharge` | Reverse charge (přenesení daňové povinnosti). Only meaningful for VAT payers. |
| `lines[]` | `description`, `quantity` (can be fractional), `unit`, `unitPrice` (**net**, minor units), `vatRate` |
| `status` | `draft`, `issued`, `paid` or `cancelled` |
| `kind` | `invoice` (default), `creditNote`, `proforma` or `advanceTaxDoc` (a VAT payer's tax document for a received advance; its `advanceId` and `advanceNumber` point to the proforma). Files from before 2026-10-18 read as `invoice`. |
| `advanceId?`, `advanceNumber?`, `advanceAmount?` | A final invoice that settles a paid proforma: the proforma's id and number, and the advance deducted (minor units). What is due is the total less `advanceAmount` (`amountDue`). |
| `advanceTaxDocNumber?`, `advanceVat?[]` | A VAT payer's final invoice: the number of the advance's tax document and the `{ rate, base, vat }` it deducts per rate. |
| `correctsId?`, `correctsNumber?`, `correctionReason` | Credit notes only: the corrected invoice's id and number (as printed), and the reason printed on the document. |
| `note`, `sentAt?`, `exportedAt?` | `sentAt` is the date the user opened the invoice e-mail in their mail program ([email.md](email.md)); `exportedAt` is the date of the last export for the accountant ([accounting-export.md](accounting-export.md)). |
| `reminders` | Dates the user opened a reminder e-mail, oldest first. Defaults to `[]`. |
| `privateNote` | A note for the user only, never printed. Defaults to `''`. |
| `uncollectible?` | The date the invoice was written off; it shows as "Nedobytná" and no longer waits for payment. |
| `tags` | The user's labels. Defaults to `[]`. |

The status changes like this:

```
draft ──Vystavit──► issued ──Zaplaceno──► paid
  │ (Smazat = delete)  │  ▲                  │
  ▼                    │  └──Nezaplaceno─────┘
 (gone)          Stornovat ▼ ▲ Obnovit
                        cancelled
```

- **Vystavit** (Issue) turns a draft into an issued invoice. **Smazat** (Delete) removes a draft.
- **Zaplaceno** (Mark paid) and **Nezaplaceno** (Mark unpaid) move between issued and paid.
- **Stornovat** (Cancel) and **Obnovit** (Restore) move between issued and cancelled.
- Only drafts can be deleted.
- "Revenue" means `issued` plus `paid`, counted by issue date.
