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
- Tests use the **real** CSV export as fixtures, e.g. 620 invoices, the known merges, yearly totals that match the CSV, and 70 invoices missing a rate.
- The store tests use `MemoryAdapter`, which also simulates external edits with `touch()`.

## Testing in a real browser

- The folder dialog is native and can't be automated. In `npm run dev`, `main.tsx` exposes `window.__invojka` (**dev only**; check that `grep -c __invojka dist/invojka.html` returns `0`):
  - `seedFromCsv(vatMode?)` loads the repo's CSVs into in-memory storage and opens the app ready to use.
  - `openMemory()` opens an empty in-memory folder (onboarding).
  - `useStore` is the store, e.g. `useStore.getState().adapter.files.get('invoices.json')`.
- Editing modules that aren't hot-reloadable (e.g. `src/pdf/*`, `main.tsx`) and the first use of a new dependency make Vite **reload the page, which wipes in-memory data**. Seed again.
- Headless Chrome with `--virtual-time-budget` stalls on IndexedDB, so a `--dump-dom` of the built file shows an empty root. **That isn't an app bug.**

## Pitfalls met so far

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
