# Bank statement import

Invojka can't connect to a bank (that would need a server and the bank's token), so the user downloads a statement in their internet banking and Invojka reads it. This replaces Fakturoid's paid automatic payment matching without anything leaving the computer. Added 2026-10-18.

## Where

Faktury → "Načíst výpis z banky" opens a dialog (`src/features/invoices/BankImport.tsx`). It explains what to download, says the file stays on the computer, and has one button to choose the file. The file is read in the browser and forgotten when the dialog closes: it's never sent, and never saved to the data folder.

## Formats (`src/domain/bank.ts`)

| Format | How it's recognised | What's read |
|---|---|---|
| **GPC** (ABO), the Czech banks' fixed-width statement | starts with `074` | "075" records with posting code `2` (credit); amount in haléře, VS, payer's short name, currency (ISO numeric, `0203` = CZK), date. Debits (1) and reversals (4, 5) are skipped. Layout as Fio documents it; see [czech-rules.md](czech-rules.md#bank-statement-formats) |
| **CAMT.053** (ISO 20022 XML) | `BkToCstmrStmt` or `camt.053` | `<Ntry>` with `CdtDbtInd` CRDT, not reversed; amount and currency, booking date, payer (`RltdPties/Dbtr/Nm`), message (`Ustrd`). The VS is taken from the structured reference, the end-to-end id ("VS123/SS/KS") or "VS 123" in the message |
| **CSV** from the bank | anything else that isn't XML | The header row is the first of the first 30 lines that has a VS and an amount column; names are matched without diacritics (Fio "Objem", KB/ČSOB "Částka", Air Bank "Částka v měně účtu", Raiffeisenbank "Zaúčtovaná částka", "Variabilní symbol" or "VS", "Název protiúčtu"…). Separator `;`, tab or `,`; decimal comma or point; dates `d.m.yyyy` or ISO. Positive amounts are incoming |

Text is decoded as UTF-8, or as Windows-1250 when UTF-8 doesn't fit (GPC and many Czech CSV exports). A file Invojka can't read gets a message that says what to download instead.

## Matching (`matchPayments`)

Candidates are invoices and proformas that are issued, not paid, and still have something due (`amountDue`, so a final invoice asks only for its balance). Credit notes and tax documents for payments are never candidates. Each invoice is matched at most once.

1. **Exact:** same variable symbol (leading zeros ignored), currency and amount due. Ticked.
2. **Different amount:** same variable symbol and currency. Shown in rust with the amount the invoice waits for; not ticked, the user decides (a partial payment is marked paid with the amount actually paid, and the data check then notes the difference).
3. **Already paid:** the symbol belongs to an invoice already marked paid (e.g. the same statement read twice). Listed in one line, nothing to do.
4. **By amount:** no usable symbol, but exactly one open invoice of that amount and currency whose customer's name shares a word with the payer's. Ticked, with a note.
5. Everything else is listed under "N plateb bez faktury" with date, amount, payer, VS and message.

Applying marks the ticked invoices paid with the payment's date and amount. Overdue invoices are listed first.

## Not done (ideas)

- Partial payments as such (a paid amount below the total keeps the invoice open).
- Remembering which statements were read.
- A per-bank guide with pictures of where to download the statement.
