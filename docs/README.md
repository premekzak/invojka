# Invojka documentation

This folder holds the project's lasting context: what the app is for, how it works, and why it was built this way. Keep it current when something changes. A decision that isn't written down here will be lost.

| Document | What it covers |
|---|---|
| [product.md](product.md) | Goals, who the app is for, scope, and the constraints set by the owner |
| [competitor-fakturoid.md](competitor-fakturoid.md) | Fakturoid's features and plans compared with Invojka: what we can add, what we can't, where we're better |
| [architecture.md](architecture.md) | Layers, data flow, storage, state, routing, the single-file build |
| [data-model.md](data-model.md) | The three JSON files, every field, and the invariants the code relies on |
| [invoicing-rules.md](invoicing-rules.md) | Czech invoicing: VAT modes, numbering, what the PDF must contain, QR Platba |
| [czech-rules.md](czech-rules.md) | What we've learned about Czech invoicing, VAT, taxes and registers (ARES), with sources and dates |
| [exchange-rates.md](exchange-rates.md) | How foreign-currency invoices get a CZK rate, and why ČNB can't be fetched directly |
| [bank-import.md](bank-import.md) | Reading a bank statement (GPC, CAMT.053, CSV) and marking the invoices it pays |
| [accounting-export.md](accounting-export.md) | The export for the accountant: CSV overview, ISDOC, PDFs, ZIP |
| [email.md](email.md) | Sending an invoice or a reminder through the user's own mail program, and the e-mail templates |
| [csv-import.md](csv-import.md) | Importing the previous service's CSV export and what the real data looks like |
| [ui.md](ui.md) | Screens, UX principles, design tokens, charts |
| [development.md](development.md) | Commands, testing (including in the browser), known pitfalls |
| [test-plan.md](test-plan.md) | How to find bugs and inconsistencies: automatic checks, user journeys, the checklist |
| [decisions.md](decisions.md) | Dated log of decisions and the reasons behind them |
| [roadmap.md](roadmap.md) | What's done, what's next, ideas for later |

`CLAUDE.md` in the repo root is the short version for AI assistants and points back here.
