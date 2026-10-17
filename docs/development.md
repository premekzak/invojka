# Development

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server. `index.html` is only the source template (blank if opened directly). |
| `npm run build` | `tsc -b`, then the single-file build to `dist/invojka.html`. This is the file users open. |
| `npm test` | Vitest, run once |
| `npx vitest run src/domain/vat.test.ts` | One test file. Add `-t "<name>"` for one test. |
| `npm run typecheck` | `tsc -b` |

Toolchain: TypeScript 7, Vite 8, Vitest 5, React 19, Zod 4, Tailwind 4 (via `@tailwindcss/vite`, no config file), Zustand 5. The `@/` import alias maps to `src/`.

## Tests

- The unit tests cover everything in `src/domain/`, plus the importer, storage, store and PDF rendering.
- PDFs render in Node and the tests check for a `%PDF-` header.
- Tests run on the **made-up export** in `src/import/fixture.ts`, so `npm test` passes on a fresh clone. When the owner's real (git-ignored) `customers.csv` and `invoices.csv` are present, extra local-only tests also run on them. They check rules that hold for any data, never hard-coded real numbers or names. Read real files only when they exist: `describe.skipIf` still runs its body to collect the tests.
- The store tests use `MemoryAdapter`, which also simulates external edits with `touch()`.
- Three kinds of tests catch inconsistencies rather than single bugs:
  - **Data health** (`check.test.ts`): every rule of `checkData()`, and no errors in the fixture or the real export.
  - **Same number on every screen** (`stats.test.ts`): Home's "this year" equals this year's chart, all customers together equal the all-time chart, and Home's overdue count equals the Overdue filter. It runs on several dates, with drafts and cancelled invoices mixed in.
  - **Texts** (`i18n/messages.test.ts`): Czech and English use the same placeholders and markup, and every text with `{{count}}` has `_one`, `_few` and `_other` forms (otherwise Czech reads "1 faktur"). TypeScript already makes sure both languages have the same keys.
- How the app is tested beyond unit tests, with the user journeys and the checklist, is in [test-plan.md](test-plan.md).

## Testing in a real browser

- The folder dialog is native and can't be automated. In `npm run dev`, `main.tsx` exposes `window.__invojka` (**dev only**; check that `grep -c __invojka dist/invojka.html` returns `0`):
  - `seedFromCsv(vatMode?)` loads the repo's CSVs into in-memory storage and opens the app ready to use.
  - `openMemory()` opens an empty in-memory folder (onboarding).
  - `check()` runs `checkData()` on the open data and prints a table of errors and warnings. Run it after a test session to see whether anything the UI did broke the data.
  - `useStore` is the store, e.g. `useStore.getState().adapter.files.get('invoices.json')`.
- Editing modules that aren't hot-reloadable (e.g. `src/pdf/*`, `main.tsx`) and the first use of a new dependency make Vite **reload the page, which wipes in-memory data**. Seed again.
- Headless Chrome with `--virtual-time-budget` stalls on IndexedDB, so a `--dump-dom` of the built file shows an empty root. **That isn't an app bug.**

## Pitfalls met so far

- **Dates come from `today()` in `id.ts`, never `toISOString()`.** That is UTC: in Czechia, after midnight it still gives yesterday, so new invoices were dated a day early and overdue switched an hour or two late.
- **`file://` works:** Chrome treats `file://` as a secure context, and `showDirectoryPicker` plus IndexedDB work there (checked).
- **Opening `index.html` directly shows a blank page.** It's only the template. That's why the build output is renamed to `invojka.html`.
- **An interrupted first save** left a 0-byte `settings.json`. Now Finish waits for the save, and the loader treats empty files as missing.
- **`position: fixed` inside the animated container** squeezed the PDF preview into a box. Use `createPortal`.
- **Components defined inside other components** are recreated on every render, which reset the invoice form on each autosave. Keep components at module level.
- **CORS:** ČNB endpoints can't be fetched from the browser. See [exchange-rates.md](exchange-rates.md).
- **PDF fonts** must be complete TTFs. The `@fontsource` web subsets split Latin and Latin Extended into separate files, which react-pdf can't combine.
- `Intl` formats Czech money with U+202F (a narrow no-break space). The PDF replaces it with U+00A0.
- On this Windows machine the project path contains `Můj disk`. Double-check the path when writing files: a mistyped `Môj disk` has created stray folders several times.
- When editing files with Python heredocs in Git Bash, use `python -X utf8`, or non-ASCII characters (`·`, `–`) get garbled.
