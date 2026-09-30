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
- **`customerSnapshot`** is a copy of the customer's name, IČ, DIČ and address, taken when an invoice is created. Editing a customer updates the snapshot on **drafts only**; issued invoices keep what was printed.
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
| `defaults` | `dueDays` (14), `currency` (CZK), `invoiceLanguage`, `unit`, `note` |
| `ui` | `language` (`cs` or `en`), `theme` (`system`, `light` or `dark`) |

## Customer

`id`, `name`, `ic`, `dic`, `address{street, zip, city, country}`, `email`, `cc[]`, `phone`, `web`, `contactName`, `defaultCurrency?`, `defaultLanguage?`, `reverseCharge`, `note` (internal only), `archived`.

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
| `language` | `cs` or `en`. The language the PDF is printed in. |
| `vatMode` | The supplier's mode **when the invoice was issued**, so changing the setting later doesn't rewrite history. |
| `reverseCharge` | Reverse charge (přenesení daňové povinnosti). Only meaningful for VAT payers. |
| `lines[]` | `description`, `quantity` (can be fractional), `unit`, `unitPrice` (**net**, minor units), `vatRate` |
| `status` | `draft`, `issued`, `paid` or `cancelled` |
| `note`, `sentAt?`, `exportedAt?` | `sentAt` and `exportedAt` are reserved for later features. |

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
