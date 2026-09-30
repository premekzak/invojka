# CSV import (`src/import/csv.ts`)

The import reads the export of the owner's previous invoicing service. It runs in onboarding step 3. The two files in the repo root are the real export, and the tests run against them.

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
