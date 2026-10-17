# Test plan

Tests catch bugs, but not things that are illogical or inconsistent. A screen can be correct and still confuse someone, and two correct screens can disagree. So testing runs in three steps. Repeat them after every larger change.

## 1. Automatic checks (`npm test`)

Every run checks the calculations and also:

- **Data health.** `checkData()` lists what should never happen (two invoices with one number, due before issued, paid without a paid date…) and what usually is a mistake (gaps in the number series, a foreign invoice without a rate, a total of zero…).
- **The same number on every screen.** Home, the charts and the customers compute revenue through one rule, and tests prove their totals agree.
- **Texts.** Czech and English have the same placeholders, and every count has its plural forms.

Details are in [development.md](development.md#tests).

## 2. Walking through the app in dev

Run `npm run dev`, then in the browser console:
- `__invojka.seedFromCsv()` for a full data set (your real export when present, otherwise the made-up one), or `seedFromCsv('payer')` to test as a VAT payer
- `__invojka.openMemory()` for a brand-new user

After each journey, run `__invojka.check()`: it must show no errors.

### Journeys

1. **First run.** An empty folder → your details → VAT mode → skip the import → Home → first customer → first invoice → PDF → mark it paid.
2. **Import.** First run with both CSVs → the merge summary → Home and the customer list show the imported history.
3. **Daily work.** A new invoice for an existing customer (it copies the last one) → issue → it becomes overdue (change the due date) → Home's task and the Overdue filter agree → mark it paid from the list → Home updates.
4. **Corrections.** Edit a customer who has a draft and an issued invoice: the draft follows, the issued one offers "Použít nové údaje". Cancel an invoice and restore it. Delete a draft (it leaves a gap in the numbers).
5. **Foreign currency.** An EUR invoice → no rate → the warning on the charts → fill the rate → it counts in CZK.
6. **Settings.** Switch the VAT mode, the language, the theme and the numbering pattern, then check that new invoices follow them and old ones don't change.
7. **More businesses and demo mode.** Add a business, switch between businesses, enter and leave demo mode: nothing leaks from one into another.

### Edge cases worth one pass each

A line of 0 Kč or with quantity 0, a negative line (a discount), very long customer names and descriptions, a customer with no address, an invoice dated next year, 31 January plus a month, the language switched halfway through editing, two tabs open on the same folder.

### The checklist, on every screen

- **Next step.** Is it obvious what to do next? Does the empty state say how to fill it?
- **One name for one thing.** The same thing has the same name everywhere (odběratel, not sometimes zákazník), and so do buttons. One exception is on purpose: "Daň odvede zákazník" is the wording the VAT law requires for reverse charge.
- **One format.** Money, dates and statuses look the same on every screen and in the PDF.
- **One number.** A total shown in two places is the same in both.
- **Grammar.** Czech plurals (1 faktura, 2 faktury, 5 faktur), both languages complete, nothing left in the other language.
- **Mistakes.** A wrong entry gives a message that says how to fix it, next to the field. Nothing fails silently.
- **Saving.** After every change the save status ends at "saved", and a reload shows the same data.
- **Keyboard.** Tab order follows the page, and Enter and Esc do what you'd expect.

Report each finding as a **bug** (wrong result), **illogical** (correct, but surprising) or **inconsistent** (two places disagree), with the screen and the steps.

## 3. A first-time user

Someone who has never seen the app follows the path from the download to the first invoice (see [product.md](product.md#first-run-from-download-to-first-invoice)) and says out loud wherever they hesitate. An AI agent with no context can do a first pass; real testers do the final one.

## Open questions from step 1

Found by the automatic checks and by reading the code on 2026-10-17. They need the owner's decision before anything changes:

- **The invoice list total includes drafts and cancelled invoices** when no status filter is on ("12 faktur · 150 000 Kč"), while Home and the customers leave them out. Should the list total leave them out too, or say what it includes?
- **Home counts foreign invoices without a rate as 0 Kč without saying so.** The charts warn "Excludes 3 invoices in EUR". Home's "this year" sentence should probably warn the same way.
- **The customer list counts only issued and paid invoices**, but the customer detail lists every invoice, drafts and cancelled ones included, so the two counts can differ.
- **Importing an empty or wrong CSV** shows "CSV parse error on row undefined: Unable to auto-detect delimiting character". A beginner needs a message that says what to do.
