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
  - **Before any action that saves, check that the app still runs on the test data:** `__invojka.useStore.getState()` must have `adapter.constructor.name === 'MemoryAdapter'` and `settings.supplier.name === 'Test Dodavatel'`. On 2026-10-18 the remembered real folder finished loading after a seed and a test setting was saved into the owner's folder; the race is fixed (see decisions), but the check stays.
  - `openMemory()` opens an empty in-memory folder (onboarding).
  - `check()` runs `checkData()` on the open data and prints a table of errors and warnings. Run it after a test session to see whether anything the UI did broke the data.
  - `useStore` is the store, e.g. `useStore.getState().adapter.files.get('invoices.json')`.
- **A full reload in dev reopens the folder you last used on `localhost`, which may be your real one.** In-memory test data is then gone, and every click saves into the real files. Before clicking through a test, check `__invojka.useStore.getState().adapter.name` (`memory` for test data), and check again after editing a module that can't be hot-reloaded. On 2026-10-17 a preview switched the colour scheme in the owner's real `settings.json` this way.
- **Vite can keep a CSS block you deleted from `src/index.css`**, even after a page reload (seen 2026-10-17 with a removed `:root:not([data-scheme])` block). The build is right; restart the dev server with `--force`. `TaskStop` on a backgrounded `npm run dev` may leave the Vite process running: free the port by stopping the process that listens on it.
- Editing modules that aren't hot-reloadable (e.g. `src/pdf/*`, `main.tsx`) and the first use of a new dependency make Vite **reload the page, which wipes in-memory data**. Seed again.
- Headless Chrome with `--virtual-time-budget` stalls on IndexedDB, so a `--dump-dom` of the built file shows an empty root. **That isn't an app bug.**

## Releasing

Users download `invojka.html` from [GitHub Releases](https://github.com/premekzak/invojka/releases). The link `https://github.com/premekzak/invojka/releases/latest/download/invojka.html` always gives the newest version, so the website can use it.

1. Merge into `main`.
2. Set the version: `npm version 0.3.0 --no-git-tag-version` (it updates `package.json` and the lock file).
3. Write the notes in `docs/releases/v0.3.0.md`, in Czech and English, for someone who has never seen the app: start with what to do with the file.
4. Commit, then tag and push: `git tag v0.3.0 && git push origin main v0.3.0`.

The `Release` workflow (`.github/workflows/release.yml`) then runs the tests, builds, checks that the build has no dev hooks and that the tag matches `package.json`, and publishes the release with the file attached. If a step fails, nothing is published: fix it, delete the tag (`git push origin :v0.3.0`, `git tag -d v0.3.0`) and tag again.

## Showcase for testers

- **What:** the app on made-up data at https://premekzak.github.io/invojka-demo/, for friends and testers (not linked from the website yet). It opens straight on the data, with no folder to pick; changes stay in the tab and a reload starts over. Search engines are told to stay away (`noindex` and `robots.txt`).
- **Build:** `npm run build:showcase` makes `dist-showcase/index.html` (`--mode showcase`). `src/showcase/history.ts` invents about forty customers and invoices every month from 2019 to today, through the normal CSV import; `src/showcase/boot.ts` runs `anonymize()` over it (the demo-mode names) and opens it in memory. Nothing comes from the owner's data.
- **Publish:** `bash scripts/deploy-showcase.sh` builds and force-pushes just that page to the separate public repo `premekzak/invojka-demo` (GitHub Pages from `main`). The demo names live only in the local `src/domain/demo.ts` and that repo, never in this one's history.

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
