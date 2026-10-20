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

1. **First run.** An empty folder → "Teprve začínám" → your details → VAT mode → taxes → Home → first customer → first invoice → PDF → mark it paid.
2. **Import.** First run with both CSVs → the merge summary → Home and the customer list show the imported history.
3. **Fakturoid.** First run → "Přecházím z Fakturoidu" → the export → your details and VAT come prefilled → a company starts with the sole trader's taxes off → Home shows the history; a final invoice settled by a proforma isn't counted twice.
4. **Elsewhere.** First run → "Fakturuji jinde" → last number `FV2026/041` and this year's turnover and income → the first new invoice is `FV2026/042`; Home's VAT and tax cards include the amounts and say so; First steps shows four steps.
   Then Settings → Aplikace → import a Fakturoid export → it warns about the amounts before Invojka → load → the same file again adds nothing.
5. **Daily work.** A new invoice for an existing customer (it copies the last one) → issue → it becomes overdue (change the due date) → Home's task and the Overdue filter agree → mark it paid from the list → Home updates.
6. **Corrections.** Edit a customer who has a draft and an issued invoice: the draft follows, the issued one offers "Použít nové údaje". Cancel an invoice and restore it. Delete a draft (it leaves a gap in the numbers).
7. **Foreign currency.** An EUR invoice → no rate → the warning on the charts → fill the rate → it counts in CZK.
8. **Settings.** Switch the VAT mode, the language, the theme and the numbering pattern, then check that new invoices follow them and old ones don't change.
9. **More businesses and demo mode.** Add a business, switch between businesses, enter and leave demo mode: nothing leaks from one into another.

8. **Phone width.** At 390 px (see [development.md](development.md#testing-in-a-real-browser) for the frame trick): the desktop-app notice shows and closes, the menu button opens the pages and closes after a choice or Escape, no screen scrolls sideways, tables scroll inside their box.
9. **Language in the address.** `?lang=en` with Czech saved: the welcome screen and the app are English, Settings shows English; choosing Čeština there removes `?lang=` and saves it.
10. **Showcase.** `npm run build:showcase` and open `dist-showcase/index.html` over a local server: it opens on made-up data with no folder dialog, Home shows the things to check (overdue, VAT limit, regular invoices, a proforma, missing rates, customers without e-mail), and a reload starts over.

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

## Findings

### Step 1, decided and done (2026-10-17)

- The invoice list total counts issued and paid invoices only and says so ("bez konceptů a stornovaných").
- Home lists foreign invoices without a rate as a task ("2 faktury bez kurzu").
- Customers show paid invoices only: "Zaplacených faktur" and "Zaplaceno", with "Celkem vystaveno N faktur" on the detail.
- A CSV that can't be imported gets a plain message that says what to do.

### Step 2, fixed (2026-10-17)

Walked through journeys 1 to 6 on the made-up export. Journey 7 (businesses and demo mode), the edge cases, the keyboard pass and the PDF content are still to do.

- **Bug:** an empty CSV file was silently ignored; now it says so.
- **Bug:** drafts kept the old VAT mode after switching to a VAT payer, so they would have been issued without VAT. Drafts now follow, and `check()` warns about one that doesn't.
- **Inconsistent:** a customer with paid foreign invoices showed "0,00 Kč"; now "1 500,00 NZ$".
- **Inconsistent:** an issued invoice showed the customer's new name in the customer field while printing the old one; the field now shows the printed name.
- **Inconsistent:** Home showed "14 500 Kč" in the sentence and "14 500,00 Kč" in the task; both are whole crowns now. The new rates task said "obrat", the charts say "tržby"; now "tržby".
- **Illogical:** an exchange rate field without a rate showed "0"; now it's empty.
- **Illogical:** onboarding said the import can be skipped, but had no skip button; the button now reads "Přeskočit import" until files are chosen. A customer listed twice showed as "Sokol media ← Sokol media"; now "(v exportu víckrát)".

### Step 2, waiting for the owner's decision

1. **"Vystaveno" means three things**: the issue-date column, a status filter that leaves out paid and overdue invoices, and Home's "Letos máte vystavené 3 faktury", which includes paid ones. Proposal: name the status "Čeká na platbu" (it matches Home's "Na zaplacení čeká").
2. **Issuing with missing supplier details**: the app issues an invoice without the supplier's IČ, address or bank account, although Home lists them as missing. Proposal: Issue shows what's missing and offers to fill it in; issuing anyway stays possible.
3. **Done 2026-10-18** (locked documents and credit notes, see [invoicing-rules.md](invoicing-rules.md#locked-documents-and-credit-notes)). **Issued and cancelled invoices stay fully editable**, including the number, the customer and the amounts, and a cancelled invoice still offers "Použít nové údaje". Czech practice corrects an issued invoice with a credit note. Proposal: lock the number, customer and lines once issued, with an "Upravit" escape that warns; hide the banner on cancelled invoices.
4. **Done 2026-10-18** (`shiftMonths`, see [invoicing-rules.md](invoicing-rules.md#regular-invoices-domainrecurringts)). **A copied line keeps the old month**: "Provoz e-shopu za srpen 2026" is copied as is to the next invoice. Proposal: move "za <měsíc> <rok>" to the previous month of the new issue date.
5. **"Doplnit" on the Home task opens settings, "Doplnit kurzy" under the charts fills the rates at once.** Proposal: the task fills them at once too.
6. **Date fields follow the browser's language** ("10/17/2026" in an English Chrome) while the rest of the app writes "17. 10. 2026". Native date fields can't be told otherwise; a custom date field would fix it. Low priority.
