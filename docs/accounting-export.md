# Export for the accountant

Faktury → "Export pro účetní" hands the accountant one month, quarter or year: an overview as a spreadsheet, the documents as ISDOC for their accounting program, and optionally the PDFs. Added 2026-10-18.

## The dialog (`src/features/invoices/ExportDialog.tsx`)

- **Period:** year, then the whole year, a quarter or a month; the previous month is preselected, the usual handover. The dates come from `periodRange` in `src/domain/accounting.ts` (the real last day of the month).
- **What:** CSV overview (on), ISDOC (on), PDFs (off; rendering takes a moment per invoice, and progress is shown).
- **Which documents:** everything issued in the period except drafts, cancelled ones included and marked (`exportable`, `inPeriod`). It says how many, and how many were exported before.
- **Where:** "Stáhnout" gives one ZIP (`invojka-2026-09.zip`), or just the CSV when that's all that was chosen. "Uložit do složky" writes the same files into the data folder under `export/<period>/`, which a synced folder can share with the accountant.
- Every exported document gets `exportedAt` (today). Nothing is sent anywhere; the user passes the files on.

## CSV (`accountingCsv`)

One row per document: number, kind, status, issue date, DUZP, due date, paid on, customer with IČ, DIČ and country, currency, rate, base, VAT, total, total in CZK, balance due, payment method, payment reference, the related document (corrected invoice, tax document or proforma) and the line descriptions. Semicolons, decimal commas, a byte order mark and CRLF, which is what Czech Excel opens without an import wizard.

## ISDOC (`toIsdoc`)

ISDOC 6.0.2, the Czech e-invoice standard (namespace `http://isdoc.cz/namespace/2013`). One `.isdoc` file per document.

- **Document type:** invoice 1, credit note 2, proforma 4, tax document for a payment 5. `VATApplicable` is false for non-payers and reverse charge.
- **Parties:** IČ as the party ID, name, address with the street split into street and building number (`splitStreet`), country code (CZ for an empty or Czech country), DIČ as the VAT scheme, e-mail and phone for the supplier.
- **Lines:** quantity and unit, base, base with VAT and the line's VAT, unit price with and without VAT, the rate, VAT calculated from the base ("zdola", method 0).
- **Foreign currency:** amounts in CZK at the document's rate, with the invoice currency's amounts in the `…Curr` elements and the rate in `CurrRate`. A foreign-currency document without a rate can't be exported this way; the dialog names it, and it's still in the CSV.
- **Final invoices:** a payer's lists the advance as `TaxedDeposits` per rate and fills `AlreadyClaimed…` and `Difference…` in the VAT summary; a non-payer's lists it as `NonTaxedDeposits` and `PaidDepositsAmount`. `PayableAmount` is what's left to pay (0 when paid).
- **Credit notes** refer to the corrected invoice in `OriginalDocumentReferences`, and the reason goes into `Note`.
- **Payment:** bank transfer (code 42) with the account, bank code, IBAN, BIC and payment reference; cash and cash on delivery as code 10 with the document number.
- The document's id is its ISDOC UUID; ids that aren't UUIDs (old imports) get a stable UUID made from them (`uuidOf`).

**Checked against the official XSD.** The tests can write sample files of every kind; validate them with the schema from isdoc.cz:

```
ISDOC_OUT=<dir> npx vitest run src/domain/accounting.test.ts
# then, with Python and lxml: validate each <dir>/*.isdoc against isdoc-invoice-6.0.2.xsd
```

All eight samples (invoice, foreign currency in cash, proforma, final invoice, payer's invoice, credit note, tax document for a payment, payer's final invoice) passed on 2026-10-18.

## ZIP (`src/domain/zip.ts`)

A minimal writer: stored entries, no compression, UTF-8 names, CRC-32. Nothing may load from a CDN, and invoices are small, so a library isn't needed.

## Not done

- Pohoda's own XML: Pohoda imports ISDOC, so it waits until someone needs it.
- Importing into Fakturoid or iDoklad.
