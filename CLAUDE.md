# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Invoicer is a local-first invoicing and analytics app in the browser. It is distributed as one self-contained HTML file, and its data is JSON in a folder the user picks (File System Access API, Chrome and Edge).

**The full context lives in [`docs/`](docs/README.md).** Read the relevant page before changing an area:
- [architecture](docs/architecture.md)
- [data model](docs/data-model.md)
- [Czech invoicing rules](docs/invoicing-rules.md)
- [exchange rates](docs/exchange-rates.md)
- [CSV import](docs/csv-import.md)
- [UI](docs/ui.md)
- [development and pitfalls](docs/development.md)
- [decisions](docs/decisions.md)
- [roadmap](docs/roadmap.md)

**Keep the docs current.** When you change behaviour, update the matching page. Add dated entries to `decisions.md` and tick items in `roadmap.md`.

## Commands

- `npm run dev` runs the dev server. `index.html` is only the template; the build output is `dist/invoicer.html`.
- `npm run build` runs `tsc -b`, then the single-file build.
- `npm test` runs Vitest. For one file: `npx vitest run src/domain/vat.test.ts`, and add `-t "<name>"` for one test.
- `npm run typecheck`

## Rules that are easy to break

- Business rules belong in `src/domain/` (pure TypeScript, unit-tested). Only `src/state/store.ts` changes data.
- Money is an **integer in minor units**. Dates are ISO strings. IČ and DIČ are strings. Totals are always computed from lines. "Overdue" is worked out, never stored.
- Issued invoices keep their `customerSnapshot`; only drafts follow customer edits.
- Nothing may be loaded from a CDN, because the build must stay a single offline file. Network code lives only in `src/fx/` and may send only currencies and dates, **never user data**.
- ČNB endpoints block browser requests (CORS). Don't try to fetch them.
- Modals need `createPortal` to `document.body`, because the animated page container traps `position: fixed`.
- Define components at module level, never inside other components.
- **The design system is the source of design truth:** the "Invoicer Ledger" Design System artifact (https://claude.ai/artifact/Uy6dgG74ESca8FjsGKrVDN). When the owner asks for a design change, update the design system as well as the app. If the request goes against one of its principles, tell the owner which one before changing anything. It is colour-agnostic: it names only colour roles, never hues or hex.
- Before any UI or styling change, load the `typography` skill (user-level) and run its checklist. When colours change, load the `color` skill too. The project's type roles, tokens and colour exceptions are in [docs/ui.md](docs/ui.md). If a request breaks a rule, tell the owner first.
- App text goes in both `src/i18n/cs.ts` and `en.ts`. Text printed on the PDF goes in `src/pdf/labels.ts`.
- To test in a browser: in dev, run `window.__invoicer.seedFromCsv()` (dev-only hook; it must not appear in `dist/`). It loads the real export when present, otherwise the made-up `src/import/fixture.ts`.
- `customers.csv` and `invoices.csv` are the owner's **real client data** and are git-ignored. Never commit them, and never put real client names, IČ or amounts into tests or docs (the repo is public).
- The project path contains `Můj disk`. Double-check paths when writing files.
