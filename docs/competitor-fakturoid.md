# Fakturoid compared with Invojka

Researched 2026-10-18 from fakturoid.cz, its price list and the read-only demo (`app.fakturoid.cz/demo/lite`). Fakturoid is the market leader for Czech freelancers (it claims 16 years and 100,000+ users). Prices and features change; check again before quoting them on the website.

## Fakturoid's plans

Monthly prices, excluding VAT (including VAT in brackets); paying yearly is about 8 % cheaper, and a business under a year old gets 50 % off the first year.

| Plan | Price | What it adds |
|---|---|---|
| Zdarma | 0 | Invoices with QR code and a web page per invoice, 6 designs with colour, mobile apps, **at most 5 customers**, 1 user |
| Na lehko | 164 Kč (199) | Unlimited customers; running estimate of social and health insurance and income tax; flat-rate tax (paušální daň) band; tax return (DPFO) and ČSSZ overview; VAT-registration turnover watch; exports to Pohoda, Money S3, ABRA Flexi and others, Excel, XML, CSV |
| Na každý den | 231 Kč (279) | Bank connection with automatic payment matching and thank-you emails; automatic reminders; expenses with AI extraction (paid per document); price list; drafts; tags |
| Na maximum | 429 Kč (519) | Recurring invoices and expenses; VAT return, control statement and summary statement; deals and quotes; stock; financial plans; GoPay and PayPal; sending from your own email address; several numbering series |

Extra users and an accountant's seat cost extra on every paid plan.

## What the Lite demo shows

- **Dashboard:** income and expenses for the last 6 months, quarters or years; unpaid and overdue totals; a running estimate of insurance and tax compared with the flat-rate tax ("odvody podle příjmu" vs "paušální daň"); alerts (unmatched payments, reminders, scheduled emails); latest invoices. Panels can be configured.
- **Invoice editor:** invoice or proforma (zálohovka); customer picker with "new customer"; number with its own variable symbol; issue date and tax point date; payment method (bank, card, cash, cash on delivery, other); due-date shortcuts (today, week, 10 days, 14 days, month, other) with the resulting date shown; about 70 currencies including crypto. "More options": 12 invoice languages, bank account, show IBAN (auto/always), order number, design (6), a "do not pay, already paid" note, attachments for the client, a sentence before the lines, a footer. Lines: quantity, unit, description, unit price; a discount on the whole invoice; preview; save as draft.
- **Invoice detail:** status badge ("2 dny po splatnosti"), web invoice, PDF, reminder by email, record a payment, edit. "More": lock, duplicate, cancel, create a template, create a recurring invoice, mark as uncollectible, delete. Private note. Printouts: invoice PDF, **delivery note, cash receipt**. An event log (overdue, viewed by client, etc.).
- **Invoice list:** tabs for quotes, templates, recurring invoices, price list and export; summary tiles (all, unpaid, overdue, paid, proformas only, cancelled); sort by issue date, tax point date, payment date, due date or number; bulk actions; advanced search; a bin.
- **Contacts:** look up by name or IČO in the Czech and Slovak registers, which fills in the details; customer, supplier or both; "not invoiced for a long time" list; import and export.
- **Statistics:** by month, quarter or year; by issue date, tax point date, payment date or cash flow; year-over-year % per month; Excel download; the **VAT registration threshold** with this year's turnover (2,000,000 Kč, and 2,536,000 Kč for immediate registration; the VAT act § 6(2)(b) says 2,536,500 Kč, checked 2026-10-18). Rankings: biggest customers (paid only) and biggest debtors. Revenue by tag. Plans (targets).
- **Settings:** invoice design with colour, header background, line spacing, **logo and stamp/signature**; default due days, unit, payment method, language, currency, fixed or own exchange rates, automatic rounding; texts before the lines and in the footer, with examples of the registration line; an optional Fakturoid ad in the footer; email templates; notifications; numbering series; users and permissions; integrations (API, webhooks, e-shops, GoPay, PayPal); 2FA; dark mode.
- **Elsewhere:** partner offers inside the app (accounting firms, an ad network, a currency exchange); mobile apps; public API and an MCP server; a command palette (added 2026-06).

## What both have

Invoices with multiple lines, payers and non-payers, QR Platba, foreign currencies counted in CZK for statistics, Czech and English invoices, due-date shortcuts, numbering patterns, cancel, mark paid, overdue tracking, customer list and detail, monthly and yearly revenue charts, dark mode.

## Where Invojka is better

- **Privacy and ownership:** the data never leaves the computer and is plain JSON and PDFs in the user's own folder. Fakturoid keeps it on its servers, and cancelling the account deletes it.
- **Free without limits:** unlimited customers and invoices. Fakturoid's free plan stops at 5 customers, and its insurance and tax estimate, exports and unlimited customers need a paid plan.
- **No account, works offline,** and keeps working if the project ends.
- **Several businesses for free** (one folder each). In Fakturoid each business is a separate account with its own subscription.
- **No upsells or ads:** no locked features with "available in plan …", no partner offers, no ad on the invoice.
- **Repeat invoices by default:** choosing a customer copies their last invoice. Fakturoid needs a template, a duplicate or a recurring invoice.
- **Exchange rates fetched automatically** (ECB) with a source on each invoice; Fakturoid offers fixed or own rates.
- **Open source,** so the privacy claim can be checked.

## What Invojka can never have (needs a server), and what to offer instead

| Fakturoid feature | Why we can't | Local alternative |
|---|---|---|
| Web invoice, "viewed by the client" | Needs hosting and tracking | The PDF with QR Platba; a "sent" date recorded by the user |
| Automatic reminders and scheduled emails | The app isn't running when it's closed, and sending email needs a server | A reminder list on Home when the app is opened, and a pre-filled reminder email (`mailto:` or a Gmail draft) |
| Bank connection with automatic matching | The bank API needs a token and a server, and bank data would go through a third party | **Import a bank statement file** (CSV, GPC/ABO) and match by variable symbol and amount, all locally |
| Card payments on the invoice (GoPay, PayPal) | Needs a merchant account and a server | Not planned for now (the owner, 2026-10-18); later perhaps a payment link printed on the PDF |
| Several users with roles, accountant login | No accounts | A shared synced folder; an export for the accountant |
| Mobile apps | One HTML file for desktop Chrome and Edge | None for now; the website should say so honestly |
| AI extraction of expense receipts | Would send documents to a service | Manual entry, if expenses are added at all |
| API, webhooks, e-shop plugins, MCP | No server | The data is documented plain JSON, so scripts can read it directly |

## What Invojka could add (works locally)

Ordered by value for a Czech freelancer against the effort.

1. **VAT registration threshold watch:** this year's turnover against 2,000,000 Kč and 2,536,500 Kč, for non-payers. Small: it is a sum and two limits (check the current limits in the VAT act).
2. **ARES lookup by IČ or name** when creating a customer (already under "Later"; only the IČ or name is sent, check CORS).
3. **Payment methods besides bank transfer:** cash and cash on delivery; hide the bank details and QR for them. A **cash receipt** (pokladní doklad) for cash. Card payments are left out for now (the owner, 2026-10-18).
4. **Proforma and tax document for a received payment** (zálohová faktura, daňový doklad k přijaté platbě), and a **credit note** (opravný daňový doklad) instead of editing issued invoices (see the proposal in [test-plan.md](test-plan.md)). Lock issued invoices.
5. **Bank statement import with matching** by variable symbol (see the table above). It replaces Fakturoid's paid main feature, without a server.
6. **Reminders:** an overdue invoice offers "Poslat upomínku" with a pre-filled email; editable email templates for invoices and reminders.
7. **Insurance and tax estimate:** social and health insurance and income tax from this year's revenue, with flat-rate expenses (paušální výdaje) or the flat-rate tax compared. High value, but the rates change every year and must be maintained; pure functions in `src/domain/` with tests per year.
8. **Export for the accountant** (already under "Later"): CSV and Excel first, then Pohoda XML and ISDOC.
9. **Recurring invoices** as a "to issue this month" list on Home, without automatic sending.
10. **Invoice look:** logo and stamp/signature images (stored in the data folder), an accent colour, a footer text; a "do not pay, already paid" line.
11. **More invoice languages** (German, Slovak) through `src/pdf/labels.ts`.
12. **Statistics:** by tax point date and payment date; quarters; year-over-year % per month; biggest customers and biggest debtors (partly under "Deeper analytics"); download as CSV.
13. **Small helpers:** a duplicate button; a discount line; a private note that is not printed; "not invoiced for a long time" customers; mark uncollectible; a delivery note; an event log on the invoice (created, issued, PDF saved, paid); a price list of saved items; tags.
14. **Command palette** (already under "Polish"; Fakturoid added one in 2026).

Out of scope unless the target changes: quotes and deals, stock, financial plans, VAT return and control statement XML (possible locally, but a large and legally sensitive area), expenses.

## UX worth borrowing

- Due date shortcuts that show the resulting date next to them ("vychází na 01. 11. 2026").
- "More options" that folds away rarely used invoice fields, so the form starts short.
- Contact creation that starts with one search box for the name or IČO and fills in the rest.
- Status in words with a count ("2 dny po splatnosti") on the list and the detail.
- Summary tiles above the invoice list that double as filters.
- The VAT threshold shown under the statistics, with a one-line explanation and a link.

## What Fakturoid does worse (points for the website)

- Its free plan is a trial in practice (5 customers).
- Locked panels ("available in plan Na každý den") and partner ads inside the app.
- Data on someone else's server; it ends with the subscription.
- Each business is a separate paid account.
