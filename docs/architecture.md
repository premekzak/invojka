# Architecture

## Overview

```
index.html ─► src/main.tsx ─► App (phase switch) ─► Layout + screens (features/*)
                                   │
                        state/store.ts (Zustand)  ◄── the only place that writes data
                                   │  debounced autosave, conflict check
                        storage/repo.ts ── validates with domain/schema.ts (Zod)
                                   │
                        StorageAdapter ── FsAccessAdapter (real folder) | MemoryAdapter (tests/dev)
```

| Layer | Folder | Rule |
|---|---|---|
| Domain | `src/domain/` | Pure TypeScript with no React or browser APIs. All business rules live here and are unit-tested. |
| Storage | `src/storage/` | Reads and writes files, and nothing else. |
| State | `src/state/` | One Zustand store that holds the loaded data and saves it. |
| Features | `src/features/<area>/` | Screens and their local components. |
| UI kit | `src/ui/` | Primitives (Button, Field, Card…), formatting, the router, BarChart. |
| PDF | `src/pdf/` | The invoice document, fonts, labels and rendering. Lazy-loaded. |
| Network | `src/fx/`, `src/ares/` | The only code that calls the internet: exchange rates (currency and dates), and the ARES business register (only the IČ or name typed into the lookup). |
| Import | `src/import/` | CSV import from the previous service. |
| i18n | `src/i18n/` | App text. `en.ts` is typed against `cs.ts`, so a missing key fails the type-check. |

## Startup and phases

`store.phase` decides what's shown:

1. `boot`: `App` checks IndexedDB for a remembered folder.
   - If one is remembered and permission is still granted, the app opens it directly.
   - If one is remembered without permission, it goes to `needsPermission`, which shows one button: "Otevřít složku X" (Open folder X).
   - If none is remembered, it goes to `noFolder`, which shows "Vybrat složku s daty" (Choose data folder).
2. After the folder opens, `reload()` first asks `adapter.exists()`. A folder moved, renamed or deleted since it was picked still opens, but its files read as missing, so it would look empty; instead the app goes to `missingFolder`: the welcome screen says the folder is no longer where it was and offers "Vybrat složku na novém místě" (Choose the folder at its new place). The folder picked there replaces the old entry in the list of businesses. Otherwise `loadAll()` reads the three files. Without `settings.json` the app goes to `onboarding`; with it, to `ready`.
3. `onboarding` (3 steps): the user's details, VAT mode, optional CSV import. Under the "Jak začínáte?" choices a link opens a folder that already has Invojka data instead (the onboarding folder, still empty, leaves the list). **Finish waits until the files are really on disk** (see the decision log, 2026-09-30).
4. `ready`: hash-routed screens.
5. `error`: a data file is invalid. The message names the file and the field path, e.g. `invoices.json: invoices.0.id: …`.

## Storage

- `StorageAdapter` has these methods: `read`, `write` (atomic), `lastModified`, `writeBinary` (for PDFs).
- `FsAccessAdapter` uses `showDirectoryPicker` and remembers the directory handle in IndexedDB (`invojka` DB, `handles` store, key `dataDir`; a handle left in the pre-rename `invoicer` DB is moved over once). After a browser restart, Chrome asks the user to confirm access with one click.

## Businesses

- **Each business is its own data folder** with its own settings, customers, invoices, numbering and PDFs (the owner's choice, 2026-10-17). Nothing is shared between them, and the data format didn't change.
- IndexedDB key `folders` lists every folder the user has opened, as `{ dir, label }`. `label` is the supplier name from the last time that business was open (`setLabel`, kept current by the switcher), so the list can show names without opening each folder. `dataDir` stays the folder opened last. If `folders` is missing (before 2026-10-17), the list starts from `dataDir`.
- `pick()` adds the folder to the list (once; `isSameEntry` finds duplicates). `activate()` asks for permission if needed and makes the folder the one opened next. `forgetFolder()` drops it from the list; its files stay.
- **Switching:** `store.switchTo(adapter)` flushes pending saves and refuses with `unsaved` if something couldn't be saved, or with `demo` in demo mode; then it opens the other folder like `open()`. `store.previous` keeps the business open before, so the onboarding of a newly added business offers "Zrušit a vrátit se k …" (Cancel and go back), which forgets the new folder and reopens the old one.
- **UI:** the business name at the right of the header is the switcher (`features/shell/BusinessSwitcher.tsx`): the list of businesses, the current one ticked, and "Přidat další firmu" (Add another business). That opens `NewBusinessDialog` first, because the system folder window alone left users lost (the owner's feedback, 2026-10-17): the user types the business name, the dialog lists what the folder window and the permission prompt will ask, then `FsAccessAdapter.createIn()` creates a folder named after the business (`domain/folderName.ts`: diacritics kept, characters Windows forbids removed) inside the place they pick. A place that is itself a business folder is refused, so businesses never nest. Onboarding starts with the name filled in (`store.newBusinessName`). A link in the dialog opens an existing data folder instead. The welcome screen after a restart offers the other businesses under the reconnect button. Settings → Složka s daty can take the current business off the list when there are others. In demo mode the switcher is a plain name.
- Language and theme live in each business's `settings.json`, so they can differ between businesses.
- **Atomic writes:** `createWritable()` writes to a temporary file and swaps it in on `close()`.
- **Conflicts:** the store remembers each file's `lastModified` from when it was loaded. `saveFile` compares it with the file on disk and throws `ConflictError` if they differ, e.g. after sync from another computer or a hand edit. The UI then offers "Načíst novou verzi" (Load new version) or "Přepsat mou verzí" (Overwrite with mine).
- **A 0-byte file counts as "not created yet"**, because an interrupted first save leaves exactly that. Its timestamp is still recorded, so the next save isn't mistaken for a conflict.

## State and autosave

- Every mutation (`saveSettings`, `upsertCustomer`, `upsertInvoice(s)`, `removeInvoice`, `removeCustomer`, `replaceAll`) updates memory and marks the affected file dirty.
- After **400 ms** of quiet, `flush()` writes each dirty file once.
- `saveState` (`saved`, `pending`, `saving`, `conflict`, `error`) is shown as a tick before the business name in the header. Its tooltip is the sentence "Vše uloženo v 18:05" (All saved at; `savedAt`, the time of the last save in this session; just "Vše uloženo" before any save) and "Složka: faktury" (Folder). Saving is a spinner; an error or conflict is a solid chip with words. **The full path can't be shown:** the File System Access API gives the page only the folder's name, never where it is on the disk; the tooltip says so.
- `beforeunload` tries to flush and warns the user if unsaved changes remain.
- Forms (invoice editor, customer form) keep a **local draft** and commit through the store on an explicit Save or Issue. Settings commit on every change, and autosave handles the rest.

## Demo mode

- **What it's for:** screenshots and videos without showing real data. It's toggled in Settings → Aplikace → "Ukázková data" (Demo data). Since 2026-10-18 nothing marks it (the owner wants screenshots that look real): the header shows the usual save tick and the demo supplier's name, and the in-memory folder is called "faktury". The only way out is the same switch in Settings → Aplikace, whose hint says so.
- **Turning it on:** `store.enterDemo()` first flushes pending saves and refuses if anything is unsaved or in conflict. It then keeps the real adapter aside, runs `anonymize()` (`src/domain/demo.ts`) on the loaded data, and swaps in a `MemoryAdapter`. Autosave, PDF saving and every edit go to memory only.
- **What `anonymize()` changes:** it's pure and deterministic (fixed seed). It replaces names, IČ and DIČ (valid check digits), addresses, contacts, bank details (a valid account and IBAN), line descriptions ("za <month> <year>" is kept), notes and order numbers. It invents all amounts: each month gets a made-up revenue (gentle growth over the years plus random variation), split across that month's invoices. Neither the amounts nor the chart heights reflect real revenue or how many invoices there were; only months with no invoices stay empty. Paid amounts equal the new totals. It keeps dates, invoice numbers, statuses, currencies and VAT settings. Customer IDs stay, so links work.
- **Turning it off:** `store.exitDemo()` discards the demo copy and reloads the real folder. `reload()` does nothing while demo mode is on, and `open()` always leaves it.
- **Remount on toggle:** the page content is keyed by `section:demo`, so it remounts when the mode changes. Editors therefore can't carry a local draft from one data set into the other.
- **Tests:** `demo.test.ts` checks that no real name, IČ, email or description survives in the output, and that the amounts aren't a scaled copy of the real ones. `store.test.ts` checks that the real folder is byte-for-byte unchanged after demo edits.

## Routing

- Hash routes work from `file://`:
  - `#/` (home)
  - `#/invoices?status=&customer=&year=` (the invoice list)
  - `#/invoices/new?customer=` and `#/invoices/:id` (the invoice editor)
  - `#/customers`, `#/customers/new` and `#/customers/:id`
  - `#/stats`
  - `#/settings`
- The screen element is keyed by the full route, so it remounts on navigation. Editors build their initial state once per mount, so later store updates (autosave) never reset a form.
- A new invoice's URL is replaced with `#/invoices/<id>` after its first save (`history.replaceState`), so Back doesn't create a duplicate.

**Exceptions at start-up:**
- The showcase build (`--mode showcase`) never looks for a remembered folder: `main.tsx` imports `src/showcase/boot.ts`, which opens a `MemoryAdapter` with made-up data and goes straight to `ready`.
- **UI language:** `src/i18n/index.ts` picks `?lang=cs|en` from the page address first, then the remembered language (localStorage), then the browser's. A `?lang=` is never saved and wins over `settings.json` while it is there; choosing a language in Settings removes it from the address (`clearUrlLanguage()`).

## Single-file build

- `vite-plugin-singlefile` inlines everything: JS, CSS, fonts and the lazily-imported PDF engine.
- The source template is `index.html`. A small plugin in `vite.config.ts` renames the output to `dist/invojka.html`.
- Nothing may be loaded from a CDN at runtime.
- A second build, `npm run build:showcase`, writes `dist-showcase/index.html` with a `noindex` meta for the public showcase (see [development.md](development.md#showcase-for-testers)); `dist-showcase` is git-ignored.
- The output is about 2.7 MB (1 MB gzipped). Most of it is two Inter TTFs and `@react-pdf/renderer`.

## Overlays

The page container animates in with a CSS transform. A transform makes `position: fixed` elements position relative to that container instead of the window, so **modals must render through `createPortal(…, document.body)`** (see `PdfPreview`).
