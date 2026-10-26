import { SCHEMA_VERSION } from './schema'

/** Written into the data folder, so AI agents the user lets read it understand the data (docs/data-model.md#agentsmd). */
export const AGENT_GUIDE_FILE = 'AGENTS.md'

// The rules below restate src/domain (vat.ts, invoice.ts, stats.ts); agentGuide.test.ts checks every field is named.
export const AGENT_GUIDE = `# Invojka data folder: a guide for AI agents

> Tento soubor zapisuje Invojka pro AI asistenty, kterým dovolíte data číst. Neupravujte ho, Invojka ho při otevření přepíše.

This folder holds the invoicing data of one business, kept by Invojka (https://invojka.cz), an invoicing app that runs in the browser and stores everything as plain files here. If you help the owner with finances or clients, read this before the data.

## Rules

- **Read only.** Never create, change, rename or delete anything in this folder. Invojka checks the number series, VAT and totals when it saves; a hand edit can leave a gap or a duplicate in the invoice numbers (Czech law requires an unbroken series), make a file unreadable so the app won't open, or clash with the app while it's open. When something should change, tell the user what to do in Invojka.
- **The data is private:** the owner's business and their clients' personal data. Don't send it to any other service unless the user asks.
- The folder may sync through Google Drive, OneDrive or similar. If a file doesn't parse, it may be mid-sync: read it again later.

## Make read-only enforced, not just promised

The first time you read this folder, offer the user to block writes to it in your own tool, and set it up when they agree. Use the folder's absolute path as you see it (the folder holding this file); Invojka itself can't know it, because the browser never reveals it.

- **Claude Code:** add a deny rule to the user's settings, \`~/.claude/settings.json\`, so it holds in every project: \`"permissions": { "deny": ["Edit(//<absolute path>/**)"] }\`. Merge it into the rules already there. \`//\` starts an absolute path; on Windows write \`C:\\Users\\Jana\\Faktury\` as \`//c/Users/Jana/Faktury\`. The rule covers every file-writing tool. It doesn't cover shell commands, so don't write here through the shell either.
- **Another tool:** use its permission or read-only setting for this path. If it has none, tell the user that read-only rests on your word only.

## Files

| File | Contents |
|---|---|
| \`settings.json\` | The business (supplier), its VAT mode, number series and defaults |
| \`customers.json\` | \`{ schemaVersion, customers: Customer[] }\` |
| \`invoices.json\` | \`{ schemaVersion, invoices: Invoice[] }\`: every document, also credit notes and proformas |
| \`pdf/<year>/<number>.pdf\` | Printed invoices; \`P…\` is a cash receipt, \`DL…\` a delivery note |
| \`export/\` | Exports made for the accountant |

\`schemaVersion\` is ${SCHEMA_VERSION}. If a file has a higher one, this guide is out of date: say so instead of guessing.

## Formats

- **Money is an integer in minor units** (haléře or cents) of the document's currency: \`123450\` is 1 234,50. Never read it as whole crowns.
- **Dates** are \`YYYY-MM-DD\` strings, so comparing strings compares dates.
- **IČ and DIČ** (company and VAT IDs) are strings; an IČ may start with 0.
- \`exchangeRate\` is CZK per 1 unit of \`currency\`. A foreign-currency document without it has no CZK value; leave it out of CZK sums and say so.

## Invoice

- \`id\`: internal UUID. \`number\`: the document number as printed. \`variableSymbol\`: the payment reference. \`orderNumber\`: the client's order number.
- \`kind\`: \`invoice\`; \`creditNote\` (opravný doklad, corrects \`correctsId\` / \`correctsNumber\`, with \`correctionReason\`; its prices are negative); \`proforma\` (zálohová faktura, a request for an advance, not revenue); \`advanceTaxDoc\` (a VAT payer's tax document for a received advance, \`advanceId\` points to the proforma).
- \`status\`: \`draft\` (not issued yet, not a real document), \`issued\` (waiting for payment), \`paid\`, \`cancelled\` (ignore it).
- \`customerId\` points to a customer, or is null for some imported documents. \`customerSnapshot\` (\`name\`, \`ic\`, \`dic\`, \`address\`) is what was printed; use it for names.
- \`issueDate\`, \`dueDate\`, \`taxableSupplyDate\` (DUZP, VAT payers only), \`paidDate\`, \`paidAmount\`.
- \`currency\`, \`exchangeRate\`, \`exchangeRateSource\` (\`cnb\`, \`ecb\` or \`manual\`), \`language\` (of the PDF), \`paymentMethod\` (\`bank\`, \`cash\`, \`cod\`).
- \`vatMode\`: the supplier's VAT mode when the document was made (\`payer\`, \`nonPayer\`, \`identifiedPerson\`). \`reverseCharge\`: VAT is paid by the customer.
- \`lines\`: \`description\`, \`quantity\` (may be fractional), \`unit\`, \`unitPrice\` (net, without VAT, minor units), \`vatRate\` (percent).
- A final invoice that settles a paid proforma: \`advanceId\`, \`advanceNumber\`, \`advanceAmount\` (the advance deducted), and for VAT payers \`advanceTaxDocNumber\` and \`advanceVat\` (\`rate\`, \`base\`, \`vat\` deducted).
- \`uncollectible\`: the date it was written off; it no longer waits for payment.
- \`sentAt\`: when it was e-mailed; \`reminders\`: dates of payment reminders; \`exportedAt\`: last export for the accountant.
- \`note\` is printed; \`privateNote\` is the owner's own. \`tags\`: the owner's labels. \`recordedTotal\`: the total an import reported, only for checks.

## Computing amounts

Totals are never stored. Compute them as Invojka does:

1. **Line base** = \`unitPrice × quantity\`, rounded to a whole minor unit.
2. **VAT** is charged only when \`vatMode\` is \`payer\` and \`reverseCharge\` is false; otherwise every line counts at rate 0. Sum the line bases per \`vatRate\`; each rate's VAT = base × rate / 100, rounded to a whole minor unit.
3. **Total** = sum of bases + sum of VAT. **Due** = total − \`advanceAmount\` (0 when missing).
4. **In CZK**: as is for \`CZK\`, otherwise × \`exchangeRate\`, rounded.

## What the owner sees in Invojka

- **Overdue** is never stored: \`status\` is \`issued\`, \`kind\` isn't \`creditNote\`, no \`uncollectible\`, and \`dueDate\` is before today.
- **Waiting for payment**, per document: \`status\` \`issued\`, \`kind\` \`invoice\`, no \`uncollectible\`. The amount is its due amount plus the totals of the issued credit notes whose \`correctsId\` is its \`id\` (those are negative), never below 0. A credit note for a paid invoice doesn't change what's waiting. Unpaid proformas are requests, not debts: list them apart.
- **Debtors**: the overdue documents among those waiting, grouped by \`customerId\` (or \`customerSnapshot.name\` when null), with their sum and the oldest \`dueDate\`.
- **Revenue**: documents with \`status\` \`issued\` or \`paid\`, \`kind\` \`invoice\` or \`creditNote\` (credit notes lower it), counted in CZK by \`issueDate\`. Drafts, cancelled documents, proformas and advance tax documents aren't revenue.
- **Money received**: paid documents by \`paidDate\`, \`paidAmount\` when set, otherwise the due amount.

## Customer

\`id\`, \`name\`, \`ic\`, \`dic\`, \`address\` (\`street\`, \`zip\`, \`city\`, \`country\`), \`email\`, \`cc\` (copy addresses), \`phone\`, \`web\`, \`contactName\`, \`defaultCurrency\`, \`defaultLanguage\`, \`reverseCharge\`, \`note\` (the owner's own), \`archived\` (no longer offered for new invoices), \`recurring\` (\`every\` month, quarter or year from \`day\`: invoiced regularly).

## settings.json

\`supplier\` (the business: name, IČ, DIČ, address, bank account), \`vatMode\` (now; documents keep their own), \`defaultVatRate\`, \`numbering\` (the number series), \`defaults\` (due days, currency, language), \`taxes\` (the income-tax setup Invojka estimates from), \`opening\` (this year's income and turnover from before Invojka, CZK minor units), \`priceList\`, \`invoice\` (the PDF's look), \`emailTemplates\`, \`ui\`.
`
