# CSV import

Onboarding's first step asks where the user comes from (see [ui.md](ui.md)); two services can be imported:

- **iDoklad** (`src/import/csv.ts`): two files, customers and invoices. The owner's previous service; the sections below describe it.
- **Fakturoid** (`src/import/fakturoid.ts`): one file of invoices; see [Fakturoid](#fakturoid).

Both run again at the end of onboarding with the VAT mode finally chosen. Both can also run later from **Settings → Aplikace → Import z jiné služby** (`src/features/settings/ImportHistory.tsx`), which adds the import to what's there (`src/import/merge.ts`): customers matched by IČ, then by name; a document with the same kind and number is skipped, and links between imported documents follow to the ones they end up as. Your details and number formats aren't touched there. The number format of the newest invoice becomes the invoice pattern (`guessPattern`), so the series carries on.

## iDoklad (`src/import/csv.ts`)

The import reads the iDoklad export the owner used before. The two files in the repo root are the real export, and the tests run against them.

## Format quirks

- UTF-8 **with a BOM** and **Czech headers**.
- Quoted fields contain commas, so the files are parsed with papaparse, never split on commas.
- **Dates are US `MM/DD/YYYY`** (`usDate()`), and amounts use a decimal point.
- The `Měna` (currency) column holds `Kč`, `EUR` or `NZD`, mapped to ISO codes.
- `Stav úhrady` (payment status) is `Uhrazeno` (paid) or `Neuhrazeno a po splatnosti` (unpaid and overdue). An import only knows **paid** or **issued**; "overdue" is worked out later.
- **There's no VAT breakdown and no lines.** Each invoice becomes one line (`Popis` (description), quantity 1, total as net price, VAT 0), and the original total is kept as `recordedTotal`.

## Customers and matching

| Problem in the data | Handling |
|---|---|
| Same company twice: with and without the legal form (`Orion Travel` and `Orion Travel, s.r.o.`), or two identical rows | Merged by `nameKey()`, which ignores case, punctuation and legal forms (s.r.o., a.s., spol. s r.o., Ltd, Limited, AG, GmbH…). Blanks are filled from the duplicate. Merges are listed in onboarding for the user to review. |
| **DIČ shared by different companies** (a VAT group: several companies share one group DIČ) | DIČ is **never** used to match |
| **IČ shared** by two differently named companies (probably a rename) | Kept separate. The user can archive or merge later. |
| IČ formatted inconsistently (`123 45 678`) | Spaces removed (`normalizeIc`) |
| Trailing spaces in names | Trimmed |

Invoices link to customers by `nameKey(name)`, falling back to IČ. With the real data all 620 invoices match an existing customer. A company written as `a.s.` on invoices matches the same name with `s.r.o.` in customers, because the legal form is ignored. If nothing matches, a customer is created from the invoice and reported.

- **Language:** CZK invoices import as Czech, others as English.
- **VAT mode:** the one chosen in onboarding.

Result on the real export: 620 invoices, 49 customers, 2 merges, no warnings.

## Files that can't be imported

`importCsv` throws an `ImportError` with a reason, and onboarding shows a plain message for each: **empty** file, **notCsv** (the parser fails), **swapped** (the customers file is in the invoices box or the other way round, told apart by their columns) and **unknownFormat** (another service's export). Every message says what to do next, including that the import can be skipped. A repeated customer row with the same name shows as "v exportu víckrát" rather than a merge of a name into itself. With no files chosen, the last button reads "Přeskočit import".

## Fakturoid

Fakturoid's invoice export (the list of invoices → export as CSV) is **one file**: each row is a document with the supplier's details, the client's details, totals and VAT, but **no lines and no line texts**. Tested on a made-up demo account export (2026-10-19); the test fixture in `fakturoid.test.ts` is made up too.

| Quirk | Handling |
|---|---|
| English headers, ISO dates, newest row first | Read as they are; rows sorted newest first, so customers and the supplier get the latest details |
| Amounts with a decimal comma (`"4598,0"`) but VAT with a point (`798.0`) | `toMinor` accepts both |
| No customer file | Customers are rebuilt from the rows, keyed by Fakturoid's client id (`Subject`), so a rename stays one customer (listed as a merge); the name is the fallback key |
| No lines | One line naming the document ("Podle dokladu 2025-0055 z Fakturoidu", or English for other languages). For a payer the VAT rate comes from VAT ÷ base (21 or 12 %); a mix of 21 and 12 % is split into two lines when that adds up exactly; otherwise one 0 % line at the total. `recordedTotal` keeps the original total |
| A proforma and its final invoice point at each other (`Related`), both paid, both with the full total | The final invoice gets `advanceId`, `advanceNumber`, `advanceAmount` = the proforma's total, and `paidAmount` 0, so the money counts once (as the proforma's) |
| Negative documents | A credit note when `Related` points to the invoice it corrects; otherwise a negative invoice (a refund or a discount), which the data check flags for review |
| `Tax document` | An advance tax document (`advanceTaxDoc`) linked to its proforma; not seen in a real export yet |
| `Status` open, sent, overdue, paid, cancelled, uncollectible | issued (overdue is worked out), paid, cancelled; uncollectible keeps the date |
| `Language` `cz` | `cs`; others kept if Invojka has them, else English |
| Country codes (`CZ`, `NO`) | Czech names via `Intl.DisplayNames` (`CZ` → "Česká republika") |
| `Bank account` `1234567890/2010` | Split into account and bank code |

The newest row also gives the **supplier** (name, IČ, DIČ, address, account, IBAN, SWIFT), filled into onboarding only where the user left a field empty; the **VAT mode** (payer when any document charges VAT, non-payer without a DIČ, otherwise the user chooses); and **number formats** for invoices and proformas (a series shared with invoices, as Fakturoid's credit notes often are, keeps Invojka's own default).

A Fakturoid file dropped into the iDoklad boxes says to choose Fakturoid instead (`isFakturoidCsv`).

Exports for testing go in `exports/`, which is git-ignored: an export may hold real client data.
