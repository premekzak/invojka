# Product

## What it is

Invoicer is a browser app for **creating and analysing invoices**. It is built mainly for its owner, a Czech freelancer doing PPC and Google Ads work for Czech and New Zealand clients. It should also work for other small businesses.

## Constraints set by the owner

- **Local data, no cloud, no database.** All data is plain JSON in a folder the user chooses. Syncing that folder (Google Drive, OneDrive) is the user's own business and doubles as a backup.
- **Distributed as a single HTML file.** The user double-clicks `invoicer.html` and there's nothing to install and no server.
- **The UI should be nice and smooth**, and it should **guide the user to the next step**. The owner judges progress by using the app, not by reading code. A screen that "does nothing" counts as a bug.
- **External requests are allowed as long as none of the user's data leaves the computer.** A request may contain a currency code and dates, never names, amounts or invoice contents.
- It has to work for other people too, so none of these are hard-coded; each is a setting:
  - VAT payer or non-payer (plátce / neplátce DPH, plus "identified person")
  - Czech or English, for the app and separately for each invoice
  - invoices with multiple lines
  - numbering format, due days and currency

## Who uses it

| User | Needs |
|---|---|
| The owner (non-payer, CZK and NZD clients) | Fast repeat invoices ("same as last month"), overdue tracking, revenue per month and year, NZD income counted in CZK |
| Other freelancers or small companies | VAT payer support (DUZP, VAT summary, reverse charge), their own numbering, English invoices |

## Browser support

Chrome and Edge, because folder access needs the File System Access API. Storage sits behind an interface (see [architecture.md](architecture.md)), so a Firefox or Safari fallback can be added later without touching features.

## Owner's data

- The owner's real data lives in their own synced folder, never in the repo.
- The source export (`customers.csv`, `invoices.csv` in the project root) holds about 50 customers and 620 invoices from 2014–2026: 550 in CZK, 69 in NZD and 1 in EUR. **It is real client data, so it's git-ignored.** Tests that read it are skipped when it's missing. `src/import/fixture.ts` is a small made-up export in the same format, which the committed tests use.

