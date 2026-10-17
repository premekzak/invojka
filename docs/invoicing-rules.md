# Czech invoicing rules as implemented

This page lists what the app does. It's not legal advice. Check any change against current Czech law (zákon o DPH, zákon o účetnictví).

## VAT modes (`settings.vatMode`, copied onto each invoice)

| Mode | VAT on lines | On the PDF |
|---|---|---|
| `payer` (plátce DPH) | Yes: rates 21, 12 or 0 % per line | Title "Faktura – daňový doklad" / "Tax invoice", tax point date (DUZP), VAT summary per rate |
| `payer` with `reverseCharge` | No, VAT is 0 | Title "Faktura", plus "Daň odvede zákazník (přenesení daňové povinnosti)." / "Reverse charge: VAT to be accounted for by the customer." |
| `nonPayer` (neplátce) | No | "Nejsem plátce DPH." / "Not registered for VAT." |
| `identifiedPerson` (identifikovaná osoba) | No | "Dodavatel je identifikovanou osobou k DPH." / "The supplier is an identified person for VAT purposes." |

The rules live in `domain/vat.ts`:
- `chargesVat(mode, reverseCharge)` is true only for a payer without reverse charge.
- `computeTotals`: **line prices are net**. The base is summed for each VAT rate, VAT is calculated from each sum and **rounded per rate** to whole minor units (half away from zero), then everything is added up.
- A fractional quantity multiplies the unit price and rounds the same way.

## Numbering

- `domain/numbering.ts` supports four placeholders in the pattern:
  - `{YYYY}`: the year
  - `{YY}`: the year's last two digits
  - `{MM}`: the month, two digits (added 2026-10-11 after a tester asked for it)
  - `{N…}`: a zero-padded sequence as wide as the number of N's
- **The sequence restarts every year, or every month when the pattern contains `{MM}`.** `nextNumber(pattern, issueDate, existing)` takes the highest existing number that matches the pattern for that period, plus one. Numbers stay unique because the month is part of them. The owner's historical numbers (`20260008`) fit the default `{YYYY}{NNNN}`.
- The payment reference (variable symbol) defaults to the number's digits, at most 10 of them in QR Platba.
- The editor rejects a number that another invoice already has.

## New invoices

`newInvoice(settings, invoices, customer?)`:
- Numbers and dates: the next number, issued today, due today + `dueDays`, and a DUZP of today for payers.
- **With a customer, it copies that customer's latest invoice**: the lines, currency and language. Most invoices repeat last month's, so the owner only has to change the period in the description.
- Otherwise the customer's defaults apply, then the settings defaults.

## What the PDF contains (`pdf/InvoiceDocument.tsx`)

- **Header:** the title (see the table above), the number, and a "STORNOVÁNO / CANCELLED" mark for cancelled invoices.
- **Supplier:** name, address, IČ, DIČ and the registration line.
- **Customer:** everything from `customerSnapshot`.
- **Dates and payment:**
  - issue date, due date, DUZP (payers only)
  - payment method "Převodem" / "Bank transfer"
  - account number / bank code, IBAN (in groups of four), SWIFT
  - payment reference, order number
- **Lines:** description, quantity with unit, unit price, VAT rate (payers only), line base.
- **Totals:** the VAT summary (payers only), then "Celkem k úhradě" / "Total due". Paid invoices also show "Uhrazeno {date}".
- **Notes:** the VAT-mode text, the reverse-charge text and the user's note.
- **Footer:** "Vystavil:" (Issued by) with name, email and phone, plus the web address (or the page number if there are several pages).
- **Text language:** all text on the PDF comes from `pdf/labels.ts` in the **invoice's** language, not the app's.

## QR Platba (`domain/spayd.ts`, `pdf/render.ts`)

- It uses the SPAYD format: `SPD*1.0*ACC:<IBAN>*AM:<amount>*CC:CZK*X-VS:<vs>*DT:<yyyymmdd>*MSG:<text>`.
- Diacritics and `*` are removed from the message, which is cut to 60 characters.
- The QR code is printed **only for unpaid CZK invoices with an IBAN and a total above 0**.
- `czechIban(account, bankCode)` builds the IBAN from `prefix-number` and a bank code. It's tested against ČNB's example `19-2000145399/0800` → `CZ6508000000192000145399`.
- **Still to verify:** scan the code with a real Czech banking app.
