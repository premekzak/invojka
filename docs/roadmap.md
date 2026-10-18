# Roadmap

## Done (as of 2026-09-30)

- [x] Single-file build that works from `file://`
- [x] Folder storage with atomic writes, conflict detection and one-click reconnect
- [x] Onboarding: your details, VAT mode, CSV import with duplicate merging
- [x] Home: key numbers, a "Nová faktura" tile and a table of things to check ("Co dál" cards until 2026-10-17), recent invoices, revenue charts by month and year
- [x] Invoice list: search, year and status filters, mark paid
- [x] Invoice editor: multiple lines, VAT for payers, reverse charge, copies the customer's last invoice, numbering, due-date shortcuts, cancel and restore
- [x] PDF in Czech and English: preview, save to folder, download, QR Platba, saved automatically on issue
- [x] Customers: list, detail and edit, create from the invoice's customer search, archive
- [x] Settings: profile, bank account (IBAN filled in automatically), VAT, defaults, numbering, language, theme, folder
- [x] Exchange rates: ECB automatic, ČNB file upload, manual; foreign revenue counted in CZK
- [x] Demo mode for screenshots and videos: an anonymized in-memory copy; the folder is never written
- [x] 104 unit tests, including data health, cross-screen consistency and text checks (2026-10-17); they run on a made-up export, so a fresh clone passes
- [x] Colour cleanup (2026-10-01): the PDF has its own neutral palette in one place; `danger-fg` and `scrim` tokens; one selected tint (`accent/10`); dark red raised to pass contrast on its badge
- [x] Neutral 12-step scale (2026-10-01): three text levels, visible field borders, `color-scheme` in dark mode
- [x] Ledger theme (2026-10-01), reached by going all-grey first and then adding colour role by role: light grey page (cream tried and replaced), blue for actions, black identity (navy tried and replaced), red warnings and errors, green confirmations

- [x] Design system "Invoicer Ledger" (2026-10-11): colour-agnostic roles, type, layout, and a forms standard (ledger-line fields, labels above, hint or error under the field, error summary, setting rows), all built into the app

- [x] Scheme "A": a darker flat header (`#f28d50`), azure accent, no gradients, borderless cards on a darker page; Roboto nav; striped tables with one status style; a "Nová faktura" tile and a task table above the charts on Home (2026-10-17)
- [x] Logo: a receipt with a lowercase i, in the header, the welcome screen and the favicon (2026-10-17)
- [x] No sidebar: a one-row peach header with the logo, the pages as pills, and the business with a save tick (2026-10-17)
- [x] More businesses: one folder each, a switcher in the header (2026-10-17)
- [x] Bricolage Grotesque headings, rust warnings, primary-button gradient (2026-10-17)
- [x] Theme "Warm paper" (2026-10-17): peach band (first a sidebar), cream page, espresso text, blue actions and charts, an orange logo, rust warnings, crimson errors, green success; designed dark mode

## To verify with the owner

- [ ] Reopening after a browser restart takes one click (not yet confirmed on the real folder)
- [ ] The QR Platba code scans in a real Czech banking app
- [ ] Walk through the user journeys in [test-plan.md](test-plan.md) in the browser and fix what they find (journeys 1–6 done 2026-10-17; journey 7, edge cases, keyboard and PDF content left)
- [ ] First-time user check: an agent with no context follows the download-to-first-invoice path
- [ ] Generating a PDF in the built `dist/invojka.html` opened from disk (so far tested only via the dev server)
- [ ] **Bank statement import with a real export** (the owner, 2026-10-18: later): the owner downloads a GPC or CSV statement from their bank and reads it in Faktury → "Načíst výpis z banky"; so far tested only on made-up files built from the specification ([bank-import.md](bank-import.md))

- [ ] **EET 2027:** check whether the new EET law passed and whether it covers cash invoices of Invojka's users ([czech-rules.md](czech-rules.md#cash-payments)); before December 2026

- [ ] **Tax rates for 2027:** add the year to `RATES` in `src/domain/taxes.ts` in January ([czech-rules.md](czech-rules.md#sole-traders-taxes-and-insurance)); until then Home says the rates are missing

## Going public as Invojka (set 2026-10-17)

- [ ] Register invojka.cz and invojka.com (and decide on .app); check trademarks (ÚPV, EUIPO)
- [x] Rename the code, build output, UI texts, PDF labels and docs from Invoicer to Invojka, with a fallback for the renamed storage keys (2026-10-17)
- [ ] **Effortless first run** (main focus, see [product.md](product.md#first-run-from-download-to-first-invoice)): an unsupported-browser guide, a "move me out of Downloads" hint, a data-folder step that suggests a concrete place, a bookmark or shortcut hint, and an update check
- [x] Downloads on GitHub Releases, built and published by a workflow on each version tag (2026-10-17; v0.2.0)
- [ ] Show the app's version (e.g. in Settings), so a user can tell whether their file is the newest
- [ ] Download page with step-by-step instructions per system and browser; test it with someone who has never seen the app
- [ ] Remove anything owner-specific that a stranger would trip over (the CSV import is built for the previous service's export)
- [x] **Catch crashes** (the owner, 2026-10-18; done the same day: `src/ui/ErrorBoundary.tsx` around each screen, which also covers its dialogs, and around the app): an error on one screen blanks the whole app, because nothing catches render errors (found when the export dialog hit an invalid date). Add React error boundaries around each screen and dialog that show a plain message ("Něco se pokazilo, vaše data jsou v pořádku"), a way back (reload, Přehled) and the error text to copy; data must never be saved from a broken state
- [ ] Website on invojka.cz: download, the privacy story, comparison with Fakturoid and iDoklad, screenshots (demo mode)
- [ ] Research the other competitors (Vyfakturuj, SuperFaktura, Pohoda, Money S3)
- [ ] A licence for the public repo

## From the Fakturoid comparison (2026-10-18)

Ordered by value against effort; details in [competitor-fakturoid.md](competitor-fakturoid.md). Card payments are left out for now (the owner, 2026-10-18).

- [x] **VAT registration threshold watch** for non-payers: this year's turnover against 2,000,000 Kč and 2,536,500 Kč, a card on Home and a task from 80 % (2026-10-18)
- [x] **ARES lookup** by IČ or name: on a new customer, "Načíst z ARES" on a saved one, and in onboarding (2026-10-18)
- [x] **Payment methods:** cash and cash on delivery besides bank transfer; no bank details or QR for them; a cash receipt (pokladní doklad); a warning above the 270,000 Kč cash limit (2026-10-18)
- [x] **Lock issued invoices** with a per-document unlock, and **credit notes** in their own series (2026-10-18)
- [x] **Proforma** (zálohová faktura) and a final invoice that deducts it, for non-payers (2026-10-18)
- [x] **Tax document for a received payment** (daňový doklad k přijaté platbě) for VAT payers, and deducting it on the final invoice (2026-10-18)
- [x] **Bank statement import** (GPC/ABO, CAMT.053, CSV) with matching by variable symbol and amount, all local (2026-10-18)
- [x] **Reminders:** "Upomínka" on overdue invoices and "Poslat" on issued ones, a pre-filled e-mail opened in the user's mail program, editable templates, sent and reminder dates recorded (2026-10-18)
- [x] **Insurance and tax estimate** (2026-10-18; rates for 2025 and 2026, add each new year): social and health insurance and income tax, flat-rate expenses vs the flat-rate tax; rates kept per year in `src/domain/` with tests
- [x] **Export for the accountant:** CSV overview, ISDOC 6.0.2 (validated against the official schema), PDFs, as a ZIP or into the data folder (2026-10-18). Pohoda XML left out: Pohoda imports ISDOC
- [x] **Recurring invoices** as a "to issue this month" list on Home, set per customer (monthly, quarterly, yearly, from a day); copied lines move their months on (2026-10-18)
- [x] **Invoice look:** logo and stamp/signature, an optional accent colour, footer text, "Již uhrazeno, neplaťte" on paid invoices (2026-10-18)
- [x] **More invoice languages:** German and Slovak, on the PDF, in dates and amounts, and in the e-mail templates (2026-10-18)
- [x] **Statistics:** a Statistiky page: by issue date, DUZP or payment date, months, quarters or years, year-on-year per period, biggest customers with share and days to pay, debtors, revenue by currency, CSV download (2026-10-18)
- [x] **Small helpers:** duplicate, discount, private note, "not invoiced for a long time", mark uncollectible, delivery note, event log, price list, tags (2026-10-18)
- [ ] **UX from Fakturoid:** the resulting date next to the due-date shortcuts, "more options" folding rare invoice fields, a single name-or-IČO box for a new contact, summary tiles above the invoice list as filters

## Next (from the original plan)

- [ ] **Deeper analytics:** year-over-year by customer (top customers and their share, days until payment and revenue by currency are on the Statistiky page since 2026-10-18)
- [ ] **Polish:** command palette (Ctrl+K), shortcuts (N = new invoice, / = search), a theme toggle in the header, date inputs in Czech format
- [x] **Sending:** a pre-filled e-mail (`mailto:`), recording `sentAt` (2026-10-18; the PDF is attached by hand, see [email.md](email.md))
- [ ] **Customers:** merge two customers (e.g. one company that was renamed and appears twice)
- [ ] **Drafts nobody meant to make** (the owner, 2026-10-17): open "Upravit odběratele" from the invoice form in a dialog instead of saving a silent draft, and remind about open drafts on Home
- [ ] **Businesses:** copy a customer from another business; show each business's own initial in the business switcher (the logo is one mark for every business since the receipt, 2026-10-17)

## Later

- [ ] Firefox and Safari: a browser-storage adapter with zip export and import
- [ ] Playwright end-to-end test of create → PDF → mark paid with `MemoryAdapter`
- [ ] Migrations framework once `schemaVersion` 2 is needed
