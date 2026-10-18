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

## VAT registration limit

`domain/vatThreshold.ts`, shown on Home for non-payers and identified persons (not for payers):

- **Limits since 2025:** over **2,000,000 Kč** of turnover in a calendar year, the business becomes a VAT payer from 1 January of the next year; over **2,536,500 Kč**, from the day after it was exceeded. Home warns from 80 % of the first limit, and when last year was over the limit while the settings still say non-payer.
- **Turnover** is the CZK total of issued and paid invoices **by issue date** (non-payers have no DUZP), the same set as revenue (`countsAsRevenue`).
- **Only Czech customers count.** Turnover (§ 4a) is supplies with the place of supply in Czechia. A service to a foreign business is supplied where the business is (§ 9(1)), inside or outside the EU, so it doesn't count. Double taxation treaties don't matter here: they cover income tax, not VAT. A service to a foreign **consumer** is usually supplied in Czechia (§ 9(2)) and would count; the app can't tell the two apart, so it treats every foreign customer as a business (the owner's are). A customer counts as Czech when the country is empty or reads Czech (`isCzechCountry`: "Česká republika", "Česko", "Czech Republic", "Czechia", "CZ", "ČR"). Foreign invoices are shown as a separate amount.
- Invoices in another currency without an exchange rate are left out and named.
- It is an estimate: exempt supplies, foreign consumers and other edge cases aren't modelled, and the card says to ask an accountant when unsure.

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

- **Header:** the title (see the table above; in the chosen accent colour), the number, and a "STORNOVÁNO / CANCELLED" mark for cancelled invoices; on the right the logo when there is one, else the supplier's name.
- **Supplier:** name, address, IČ, DIČ and the registration line.
- **Customer:** everything from `customerSnapshot`.
- **Dates and payment:**
  - issue date, due date, DUZP (payers only)
  - payment method: "Převodem" / "Hotově" / "Dobírkou" ("Bank transfer" / "Cash" / "Cash on delivery")
  - for bank transfers only: account number / bank code, IBAN (in groups of four), SWIFT
  - payment reference (not for cash), order number
- **Lines:** description, quantity with unit, unit price, VAT rate (payers only), line base.
- **Totals:** the VAT summary (payers only), then "Celkem k úhradě" / "Total due". The box takes the chosen accent colour. Paid invoices also show "Již uhrazeno {date}, neplaťte" / "Paid on {date}, nothing to pay". The stamp and signature picture, when there is one, sits on the right below.
- **Notes:** the VAT-mode text, the reverse-charge text and the user's note.
- **Footer:** the user's footer line if set, then "Vystavil:" (Issued by) with name, email and phone, plus the web address (or the page number if there are several pages).
- **Text language:** all text on the PDF comes from `pdf/labels.ts` in the **invoice's** language, not the app's: Czech, English, German or Slovak (since 2026-10-18; the app itself stays Czech and English). Dates follow the language (5. 10. 2026, 5 Oct 2026, 05.10.2026), amounts and quantities its locale (`domain/language.ts`). The QR Platba message starts with the language's word for invoice; e-mail templates exist in all four.

## Regular invoices (`domain/recurring.ts`)

- A customer can be billed regularly (Odběratelé → customer → "Fakturuji pravidelně"): every month, quarter or year, from day 1–28 of the period.
- **Home** shows "Pravidelné faktury: <month>" with each such customer's state this period (`recurringStatus`): **K vystavení** (the day has come and no invoice is issued in the period), **Rozpracovaná** (a draft exists), **Od <date>** (the day hasn't come), **Vystavená** (issued or paid; cancelled ones don't count). Due ones come first and also make a task row. "Vystavit" opens `#/invoices/new?customer=<id>`, the usual copy of the customer's last invoice.
- Invojka issues and sends nothing by itself: no server, and an invoice nobody checked shouldn't go out.

**Months in copied lines (`shiftMonths`):** when a new invoice copies the customer's last one, the months its lines name move on by the calendar months between the two issue dates: "za srpen 2026" → "za září 2026", "duben - srpen 2026" → "květen - září 2026", "prosinec 2026" → "leden 2027". Czech month names in the nominative and genitive (with or without a year), English names, "8/2026", "08/2026" and "2026-08" are understood; full dates are left alone. Only when the last invoice is at most 12 months old (`copyShift`): copying a 2019 invoice moved "prosinec 2017 - listopad 2019" seven years on, so older invoices are copied as they are. This fixed finding 4 of [test-plan.md](test-plan.md).

## Small helpers (`domain/invoice.ts`)

- **Duplikovat** (Více): a new draft copying the invoice's customer, lines (months moved on, as above), currency, language, payment method, note and tags, with the next number and today's dates (`duplicateInvoice`, `#/invoices/new?copy=<id>`).
- **Přidat slevu**: a percentage next to "Přidat položku" becomes one negative line per VAT rate, "Sleva 10 %", worth that share of the rate's positive lines (`discountLines`), so a payer's VAT drops at the right rate.
- **Nedobytná** (Více → Označit jako nedobytnou): `uncollectible` with the date. The invoice stays issued and stays revenue, but is no longer overdue or waiting to be paid, shows "Nedobytná", and the CSV export says so. Marking it paid later clears it. (A VAT payer can then correct the VAT under § 46; Invojka doesn't do that.)
- **Dodací list** (Více): a PDF with the parties, delivery date (DUZP or issue date), the invoice number, the lines with quantities but no prices, and two signature lines; `DL` + the invoice number, saved as `pdf/<year>/DL<number>.pdf`.
- **Historie** in the side panel (`invoiceHistory`): issued, sent, reminders, paid, written off, exported, and the credit notes, final invoice or tax document that refer to it, from what the documents already record; nothing extra is stored.
- **Poznámka jen pro vás** (`privateNote`) is never printed; **Štítky** (`tags`) are the user's labels, found by the invoice list search and shown as #tag there. Both stay editable on a locked invoice.
- **Ceník** (Settings): saved items; typing or picking one's description on a line fills its unit, price and VAT rate.
- **Dlouho nefakturovaní** (Odběratelé): customers invoiced at least twice, the last time between three months and two years ago, longest silence first (`longUninvoiced`); regular and archived customers are left out.

## Locked documents and credit notes

- **Issued, paid and cancelled documents are locked** (the owner, 2026-10-18): the customer, number, payment reference, dates, payment method, DUZP, currency, language, reverse charge and lines can't be changed. The note, the exchange rate and the paid date stay editable, and the status actions (mark paid, cancel) still work. "Odemknout" next to "Zamčeno" unlocks the one document for this visit, with a warning that it may already be with the customer; "Zamknout" throws away unsaved changes and locks it again. Saving an unlocked document rewrites its PDF as before.
- **A credit note corrects an issued invoice** (`kind: 'creditNote'`, `newCreditNote` in `domain/invoice.ts`): "Opravný doklad" on an issued or paid invoice opens a new one with its own number series (`D{YYYY}{NNNN}`), the same customer (fixed), currency, rate, VAT mode and payment method, dated today (also its DUZP for payers, § 42(3)), and the original lines with negative prices. The user edits the lines down to the actual difference and must give a reason.
- **On the PDF:** "Opravný daňový doklad" for payers, "Opravná faktura" otherwise ("Corrective tax document" / "Credit note"); "Opravuje doklad <number>" next to the payment reference; "Důvod opravy: …" first among the notes; the total is "Rozdíl celkem", with the VAT summary per rate showing the differences, as § 45 asks. No QR code when the difference is negative.
- **In the numbers:** a credit note lowers revenue, the VAT turnover and the customer's paid total by its amount, but isn't counted as an invoice, and is never overdue. The original invoice shows "Opraveno dokladem D… (−2 000 Kč)". The data check flags a credit note without its invoice (error) or without a reason (warning).
- Background in [czech-rules.md](czech-rules.md#corrections-and-credit-notes).

## Proformas and final invoices (non-payers)

- **A proforma** (`kind: 'proforma'`, zálohová faktura) is a request for an advance. A draft switches between "Faktura" and "Zálohová faktura" at the top of the side panel (`withKind`), which gives it the next number of that series (`Z{YYYY}{NNNN}`) and drops the DUZP. The PDF is titled "Zálohová faktura" / "Proforma invoice" and says "Nejedná se o daňový doklad." It has a QR code like an invoice.
- **It isn't revenue:** `countsAsRevenue` leaves proformas out, so they don't show in revenue, the VAT turnover, the customer's totals or "waiting to be paid". It can still be overdue in the list. It's no template for the customer's next invoice (`latestFor` only looks at invoices).
- **Once paid,** the proforma shows "Záloha je zaplacená" with "Vystavit fakturu", and Home lists paid proformas without an invoice as a task. "Vystavit fakturu" opens `#/invoices/new?settles=<id>` (`newFinalInvoice`): an invoice in the invoice series, dated today, with the proforma's customer, lines, currency and payment method, and the advance (what was paid, at most the total) deducted. The editor and the PDF show the total, "Uhrazeno zálohou Z…" and "Zbývá uhradit". If the advance covers it all, issuing marks it paid on the day the advance came in (`issuedStatus`); otherwise it waits for the rest, and Home, the QR code and "mark paid" use the balance. The proforma then shows "Vyúčtováno fakturou …".
- **VAT payers** go through a tax document first:
  - A paid proforma shows "Vystavte daňový doklad k přijaté platbě do <date>" (15 days after the payment, `advanceTaxDocDeadline`; rust once it's passed) with "Daňový doklad k platbě". Home lists it as a task, rust from the deadline on.
  - The tax document (`kind: 'advanceTaxDoc'`, `newAdvanceTaxDoc`, series `ZD{YYYY}{NNNN}`) has the proforma's customer (fixed), its DUZP is the day the money came in ("Datum přijetí platby"), and it has no due date or payment method. The money received is split over the proforma's VAT rates in proportion and turned into net lines with `netFromGross`, so base + VAT equals what came in (at most a haléř off at the last rate when there are several rates, because whole haléře can't always add up). The editor warns if it's issued after the 15 days, and the data check flags that too. Issuing marks it paid on the payment date. PDF: "Daňový doklad k přijaté platbě", "K zálohové faktuře Z…", the VAT summary, "Přijatá platba".
  - Then "Vystavit fakturu" makes the final invoice, which stores the tax document's number and base and VAT per rate (`advanceVat`). Its PDF shows the full VAT summary, then "Odečet zálohy 21 %: −base / −VAT" per rate, "Uhrazeno zálohou ZD…" with the money received, and "Zbývá uhradit".
  - The tax document isn't revenue (`countsAsRevenue`); the final invoice carries the full amount.
- Background in [czech-rules.md](czech-rules.md#advance-payments-zálohy).

## Payment methods (`domain/payment.ts`)

- **Bank transfer** (`bank`, the default): account, IBAN, SWIFT, payment reference and QR Platba on the PDF.
- **Cash** (`cash`): "Hotově"; no bank details, no payment reference, no QR. Above **270,000 Kč** (`CASH_LIMIT`) the editor warns that the amount must go by bank, after the cash payment limit act. A foreign-currency invoice is converted with its rate; without a rate it isn't flagged.
- **Cash on delivery** (`cod`): "Dobírkou"; no bank details or QR, but the payment reference stays, because carriers pass it on with the payout.
- **Cash receipt** (příjmový pokladní doklad, `pdf/ReceiptDocument.tsx`): offered once a cash invoice is paid. Number `P` + the invoice number (`P20260008`), so each paid cash invoice has exactly one receipt; saved as `pdf/<year>/P<number>.pdf`. It shows the recipient (supplier) and payer (customer) with IČ and DIČ, the date received (`paidDate`), "Úhrada faktury <number>" as the purpose, the amount received, VAT per rate for payers, and lines for both signatures. Background in [czech-rules.md](czech-rules.md#cash-payments).

## QR Platba (`domain/spayd.ts`, `pdf/render.ts`)

- It uses the SPAYD format: `SPD*1.0*ACC:<IBAN>*AM:<amount>*CC:CZK*X-VS:<vs>*DT:<yyyymmdd>*MSG:<text>`.
- Diacritics and `*` are removed from the message, which is cut to 60 characters.
- The QR code is printed **only for unpaid CZK invoices paid by bank transfer, with an IBAN and a total above 0**.
- `czechIban(account, bankCode)` builds the IBAN from `prefix-number` and a bank code. It's tested against ČNB's example `19-2000145399/0800` → `CZ6508000000192000145399`.
- **Still to verify:** scan the code with a real Czech banking app.
