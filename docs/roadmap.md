# Roadmap

## Done (as of 2026-09-30)

- [x] Single-file build that works from `file://`
- [x] Folder storage with atomic writes, conflict detection and one-click reconnect
- [x] Onboarding: your details, VAT mode, CSV import with duplicate merging
- [x] Home: key numbers, "Co dál" (Next steps), recent invoices, revenue charts by month and year
- [x] Invoice list: search, year and status filters, mark paid
- [x] Invoice editor: multiple lines, VAT for payers, reverse charge, copies the customer's last invoice, numbering, due-date shortcuts, cancel and restore
- [x] PDF in Czech and English: preview, save to folder, download, QR Platba, saved automatically on issue
- [x] Customers: list, detail and edit, create from the invoice's customer search, archive
- [x] Settings: profile, bank account (IBAN filled in automatically), VAT, defaults, numbering, language, theme, folder
- [x] Exchange rates: ECB automatic, ČNB file upload, manual; foreign revenue counted in CZK
- [x] Demo mode for screenshots and videos: an anonymized in-memory copy; the folder is never written
- [x] 56 unit tests
- [x] Colour cleanup (2026-10-01): the PDF has its own neutral palette in one place; `danger-fg` and `scrim` tokens; one selected tint (`accent/10`); dark red raised to pass contrast on its badge
- [x] Neutral 12-step scale (2026-10-01): three text levels, visible field borders, `color-scheme` in dark mode
- [x] Ledger theme (2026-10-01), reached by going all-grey first and then adding colour role by role: light grey page (cream tried and replaced), blue for actions, black identity (navy tried and replaced), red warnings and errors, green confirmations

- [x] Design system "Invoicer Ledger" (2026-10-11): colour-agnostic roles, type, layout, and a forms standard (ledger-line fields, labels above, hint or error under the field, error summary, setting rows), all built into the app

## To verify with the owner

- [ ] Reopening after a browser restart takes one click (not yet confirmed on the real folder)
- [ ] The QR Platba code scans in a real Czech banking app
- [ ] Generating a PDF in the built `dist/invoicer.html` opened from disk (so far tested only via the dev server)

## Next (from the original plan)

- [ ] **Deeper analytics:** top customers and their share, days until payment per customer, revenue by currency, year-over-year by customer
- [ ] **Polish:** command palette (Ctrl+K), shortcuts (N = new invoice, / = search), a theme toggle in the sidebar, date inputs in Czech format
- [ ] **Sending:** a pre-filled email with the PDF (Gmail draft or `mailto:`), recording `sentAt`
- [ ] **Customers:** merge two customers (e.g. one company that was renamed and appears twice)

## Later

- [ ] ARES lookup by IČ to fill in customer details (network: only the IČ is sent; check CORS first)
- [ ] Export for the accountant: ISDOC, Pohoda XML, or a CSV of the year's invoices (`exportedAt`)
- [ ] Recurring invoices or monthly templates
- [ ] Firefox and Safari: a browser-storage adapter with zip export and import
- [ ] Playwright end-to-end test of create → PDF → mark paid with `MemoryAdapter`
- [ ] Migrations framework once `schemaVersion` 2 is needed
