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

## Going public as Invojka (set 2026-10-17)

- [ ] Register invojka.cz and invojka.com (and decide on .app); check trademarks (ÚPV, EUIPO)
- [x] Rename the code, build output, UI texts, PDF labels and docs from Invoicer to Invojka, with a fallback for the renamed storage keys (2026-10-17)
- [ ] **Effortless first run** (main focus, see [product.md](product.md#first-run-from-download-to-first-invoice)): an unsupported-browser guide, a "move me out of Downloads" hint, a data-folder step that suggests a concrete place, a bookmark or shortcut hint, and an update check
- [x] Downloads on GitHub Releases, built and published by a workflow on each version tag (2026-10-17; v0.2.0)
- [ ] Show the app's version (e.g. in Settings), so a user can tell whether their file is the newest
- [ ] Download page with step-by-step instructions per system and browser; test it with someone who has never seen the app
- [ ] Remove anything owner-specific that a stranger would trip over (the CSV import is built for the previous service's export)
- [ ] Website on invojka.cz: download, the privacy story, comparison with Fakturoid and iDoklad, screenshots (demo mode)
- [ ] Research the other competitors (Vyfakturuj, SuperFaktura, Pohoda, Money S3)
- [ ] A licence for the public repo

## Next (from the original plan)

- [ ] **Deeper analytics:** top customers and their share, days until payment per customer, revenue by currency, year-over-year by customer
- [ ] **Polish:** command palette (Ctrl+K), shortcuts (N = new invoice, / = search), a theme toggle in the header, date inputs in Czech format
- [ ] **Sending:** a pre-filled email with the PDF (Gmail draft or `mailto:`), recording `sentAt`
- [ ] **Customers:** merge two customers (e.g. one company that was renamed and appears twice)
- [ ] **Drafts nobody meant to make** (the owner, 2026-10-17): open "Upravit odběratele" from the invoice form in a dialog instead of saving a silent draft, and remind about open drafts on Home
- [ ] **Businesses:** copy a customer from another business; show each business's own initial in the business switcher (the logo is one mark for every business since the receipt, 2026-10-17)

## Later

- [ ] ARES lookup by IČ to fill in customer details (network: only the IČ is sent; check CORS first)
- [ ] Export for the accountant: ISDOC, Pohoda XML, or a CSV of the year's invoices (`exportedAt`)
- [ ] Recurring invoices or monthly templates
- [ ] Firefox and Safari: a browser-storage adapter with zip export and import
- [ ] Playwright end-to-end test of create → PDF → mark paid with `MemoryAdapter`
- [ ] Migrations framework once `schemaVersion` 2 is needed
