# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Invojka is a local-first invoicing and analytics app in the browser. It is distributed as one self-contained HTML file, and its data is JSON in a folder the user picks (File System Access API, Chrome and Edge).

## Where it's going

- **The product name is Invojka** (decided 2026-10-17; domains invojka.cz and .com). It was called Invoicer until then. Storage keys were renamed with a fallback to the old ones (`src/storage/fsAccess.ts`, `src/i18n/index.ts`); never rename a storage key or data file name without such a migration, or existing users lose their folder.
- **The target is a free public app with its own website and marketing,** not just the owner's tool. Every change should work for a stranger who downloads it, without the owner's help.
- **No cloud, on purpose, and that is the selling point.** Competitors (Fakturoid, iDoklad) are paid cloud services. Invojka wins on privacy (your data never leaves your computer), being free, no account, offline use and owning your data as plain files. Never add a server, an account, analytics or tracking that would weaken this. Positioning and competitors are in [docs/product.md](docs/product.md).
- **Setup must be effortless for a beginner.** The single file stays, so the burden is on us: from the download to the first invoice, the user must always know what to do next (where to put the file, how to open it, which browser, which data folder). Assume they don't know what an HTML file or a browser is. The plan is in [docs/product.md](docs/product.md#first-run-from-download-to-first-invoice).

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

- `npm run dev` runs the dev server. `index.html` is only the template; the build output is `dist/invojka.html`.
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
- To test in a browser: in dev, run `window.__invojka.seedFromCsv()` (dev-only hook; it must not appear in `dist/`). It loads the real export when present, otherwise the made-up `src/import/fixture.ts`.
- `customers.csv` and `invoices.csv` are the owner's **real client data** and are git-ignored. Never commit them, and never put real client names, IČ or amounts into tests or docs (the repo is public).
- The project path contains `Můj disk`. Double-check paths when writing files.
