# Sending invoices and reminders

Invojka has no server, so it never sends e-mail itself. It fills in a template and opens the e-mail in the user's own mail program through a `mailto:` link; the user attaches the PDF and presses Send there. Added 2026-10-18.

## Where

- **An issued invoice or proforma** has "Poslat" in the editor header. When it's overdue, the button is "Upomínka" instead; a reminder before the due date is under "Více".
- The dialog (`src/features/invoices/EmailDialog.tsx`) shows To (the customer's e-mail), Cc (the customer's copies), Subject and Text, all editable. If the customer has no e-mail, the hint says so.
- **"Otevřít v poště"** opens the mail program and records the date: `sentAt` for an invoice, one more date in `reminders` for a reminder. The editor shows "Odesláno 18. 10. 2026 · 2 upomínky, naposledy 18. 10. 2026".
- **"Stáhnout PDF"** downloads the document to attach; the dialog also names the file in the data folder. **"Zkopírovat text"** copies subject and text for webmail.

`mailto:` can't carry attachments, and Gmail's compose URL would put the customer's address and the amount into a Google URL, so neither is used for the PDF.

## Templates (`src/domain/email.ts`)

- Two kinds (invoice, reminder) in two languages (cs, en); the invoice's language decides. Built-in texts are in `DEFAULT_TEMPLATES`.
- Settings → E-maily edits them, with a language switch. A text left as the built-in one stores nothing (`settings.emailTemplates` stays empty), so improvements to the built-in text still reach the user; "Vrátit výchozí text" removes the user's own.
- **Placeholders** (each invoice language has its own names, and every language's names work in every template: en `{number}` `{amount}` `{due}` `{days}` `{payment}` `{reference}` `{account}` `{customer}` `{supplier}`; de `{nummer}` `{betrag}` `{faellig}` `{tage}` `{zahlung}` `{referenz}` `{konto}` `{kunde}` `{lieferant}`; sk as Czech except `{suma}` and `{dni}`). Czech: `{cislo}` number, `{castka}` amount due (the balance for a final invoice), `{splatnost}` due date, `{dny}` days overdue, `{platba}` the sentence with the account and payment reference (empty for cash, cash on delivery or without an account), `{vs}`, `{ucet}`, `{odberatel}`, `{dodavatel}`. An unknown placeholder stays as typed, so a typo shows. An empty one leaves no double spaces or blank paragraphs.
- The amount keeps its no-break spaces, so "14 500,00 Kč" never splits across lines.
