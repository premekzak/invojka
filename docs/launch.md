# Before launch

What has to be true before invojka.cz offers Invojka for download to strangers. Written 2026-11-01, assuming the website itself is done. Features belong in [roadmap.md](roadmap.md); this page holds only what stands between today and a public download, plus what has to run once people use it.

Each item says why it matters. **Blockers** must be done before the download goes public; the rest should be done before or soon after.

## 1. Data safety (blockers)

A stranger who loses their invoices loses their bookkeeping. Nobody can help them, because there is no server.

- [ ] **Backups in the data folder.** Every save overwrites `invoices.json`; the previous version is gone. One bug or one wrong click can destroy the data, and few users know their cloud drive keeps file versions. Plan: copy the data files into a subfolder (e.g. `zalohy/`) once a day and on each start, keep the last N copies, and offer "Obnovit ze zálohy" in Settings.
- [ ] **An older app must not drop fields saved by a newer one.** The Zod schemas in `src/domain/schema.ts` strip unknown keys. When a release adds an optional field without raising `schemaVersion`, an older `invojka.html` (a second computer, a user who didn't update) loads the data, saves, and silently deletes that field. The guard for a higher `schemaVersion` (`src/storage/repo.ts`) helps only when the version is raised. Fix: keep unknown keys (`z.looseObject`), or make every data change raise `schemaVersion`; either way write the rule into [data-model.md](data-model.md).
- [ ] **A migrations framework** (was "Later" in the roadmap). After launch the data format can't change without migrating users' files.
- [ ] **Check the shared `file://` storage.** In Chrome every page opened from disk shares one origin, so any other downloaded HTML file can read the same IndexedDB and localStorage where Invojka keeps the folder handle. Find out whether such a file can open the data folder without a new permission prompt. If it can, it breaks the privacy promise: fix it or explain it honestly.

## 2. Updates (blockers)

- [ ] **Show the app's version** (e.g. in Settings and on the error screen), so a user and support can tell which file they run.
- [ ] **Decide and build the update notice** (designed in [roadmap.md](roadmap.md#going-public-as-invojka-set-2026-10-17), on hold). Without it users keep old bugs and old tax rates forever; the 2027 rates must reach them in January. Decide: on by default with a switch, and GitHub or invojka.cz as the source.

## 3. Correct documents (blockers)

An invoicing tool that prints an invalid invoice harms its user.

- [ ] **A tax adviser or accountant checks sample PDFs** in every mode: non-payer, payer, identified person, reverse charge, proforma, tax document for a received payment, credit note, cash receipt. Required fields (§29 ZDPH), rounding, wording. Record the result in [czech-rules.md](czech-rules.md).
- [ ] **QR Platba scans in a real Czech banking app**
- [ ] **Generating a PDF in the built `dist/invojka.html` opened from disk** (so far only via the dev server)
- [ ] **Reopening after a browser restart takes one click** on a real folder
- [ ] **Issuing with missing supplier details:** today an invoice can be issued without the supplier's IČ, address or bank account ([test-plan.md](test-plan.md#step-2-waiting-for-the-owners-decision), item 2). Proposal: Issue shows what's missing and offers to fill it in
- [ ] **EET 2027:** check whether the new EET law passed and whether it covers cash invoices of Invojka's users ([czech-rules.md](czech-rules.md#cash-payments)); before December 2026

## 4. Legal (blockers)

- [ ] **A licence for the public repo** (MIT, or AGPL to stop a closed cloud copy). Without one the "open source" claim in [product.md](product.md) isn't true
- [ ] **Third-party notices inside the file.** `invojka.html` bundles React, react-pdf and the fonts (Inter, Roboto, Bricolage Grotesque and others); MIT and OFL require their copyright and licence text to travel with copies. Generate an "O aplikaci / Licence" page at build time
- [ ] **No-warranty notice** in the app and on the website: VAT, the VAT limit, tax and insurance are estimates; the user is responsible for their documents
- [ ] **Trademark check** (ÚPV, EUIPO) and domains invojka.cz and .com registered (decide on .app)
- [ ] **Website:** a privacy page (even "we collect nothing" must be said), contact and who runs it

## 5. First run and trust

- [ ] **Effortless first run** ([product.md](product.md#first-run-from-download-to-first-invoice)): today the welcome screen says only one sentence about an unsupported browser. Still missing: a full-screen "open me in Chrome or Edge" guide, a "move me out of Downloads" hint, a data-folder step that suggests a concrete place, a bookmark or shortcut hint
- [ ] **Browsers beyond Chrome and Edge:** Brave turns the File System Access API off by default (needs its own guide); test Opera and Vivaldi; on a Mac a double-click opens Safari
- [ ] **Synced folders:** OneDrive with Files On-Demand, Google Drive for Desktop, and two computers editing at once (copies like `invoices (1).json`)
- [ ] **Download warnings and antivirus:** download the release on a clean Windows with Defender and two or three common antiviruses; a 3.4 MB HTML with inline script may be flagged. Publish the file's SHA-256 next to the download
- [ ] **Content-Security-Policy in the HTML** allowing network requests only to the exchange-rate and ARES hosts: a checkable proof of "your data never leaves your computer"
- [ ] **Download page** with step-by-step instructions per system and browser
- [ ] **Remove anything owner-specific** a stranger would trip over (the CSV import is built for the previous service's export); bring `README.md` up to date (it misses ARES)
- [ ] **Check the git history and docs** for real client names before the launch draws attention to the repo

## 6. Testing with people

- [ ] The remaining journeys in [test-plan.md](test-plan.md): 7–12, the edge cases, the keyboard pass, the PDF content
- [ ] First pass: an agent with no context follows the download-to-first-invoice path
- [ ] Three to five people who have never seen the app go from the download to the first invoice, on their own computers
- [ ] Bank statement import with a real export from the owner's bank ([bank-import.md](bank-import.md))

## 7. Support and running it after launch

- [ ] **Where to report a problem** without an account (GitHub Issues need one): an e-mail address on the website, and "Poslat e-mailem" on the error screen with the error text (never data) pre-filled
- [ ] **FAQ on the website** (first version in `src/website/Faq.tsx`, 2026-11-27; the 10 years are not stated until checked and recorded in czech-rules.md)**:** backup, moving to another computer, updating, what happens if the project ends (plain JSON stays readable), keeping invoices for 10 years (the PDFs are in the folder)
- [ ] **Yearly calendar for the owner:** tax and insurance rates for the new year in `src/domain/taxes.ts` every January ([czech-rules.md](czech-rules.md#sole-traders-taxes-and-insurance)), VAT limits, law changes
- [ ] **Version 1.0:** decide what "stable" means; from then on no data format change without a migration
- [x] ~~No tracking on the website~~ **Overridden by the owner on 2026-11-27:** the website is measured with Google Analytics through Tag Manager, only after consent, because he runs ads and wants conversions ([website.md](website.md#measuring)). The app itself stays unmeasured. Was: "or only cookie-free statistics: Google Analytics would undercut the main argument"

## Suggested order

1. Backups and keeping unknown fields (the only risks of losing data for good)
2. The shared `file://` storage
3. Version shown and the update notice
4. PDF in the built file, QR in a bank app, the tax adviser
5. Licence, no-warranty notice, third-party notices, trademark
6. First run (browsers, Downloads, Mac)
7. Testing with people and antiviruses
8. Contact for problems, FAQ, CSP
