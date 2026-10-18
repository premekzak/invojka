# Product

## What it is

Invojka (called Invoicer until 2026-10-17) is a browser app for **creating and analysing invoices**. It started as a tool for its owner, a Czech freelancer doing PPC and Google Ads work for Czech and New Zealand clients.

## Target (set 2026-10-17)

Invojka becomes a **free public app with its own website** (invojka.cz) and marketing, aimed at Czech freelancers and small businesses. It stays local-first: there will be **no cloud service**, and that is the main advantage, not a gap to apologise for.

### Competitors

| Product | Model | Notes |
|---|---|---|
| [Fakturoid](https://www.fakturoid.cz/) | Paid cloud subscription (limited free tier) | Market leader for Czech freelancers. Full comparison: [competitor-fakturoid.md](competitor-fakturoid.md) |
| [iDoklad](https://www.idoklad.cz/) | Cloud, free tier plus paid plans | Run by Solitea (Pohoda, Money) |

Not researched yet: Vyfakturuj, SuperFaktura, and the invoicing modules of desktop accounting software (Pohoda, Money S3).

### Our advantages

- **Privacy:** invoices and client data never leave the user's computer. No company stores them, so none can leak, sell or lose them.
- **Free:** no subscription, no invoice limits, no paid tier.
- **No account:** download one file and start. No sign-up, no password, no email.
- **Works offline,** and keeps working even if the project stops: the file and the data stay on the user's disk.
- **You own your data:** plain JSON and PDFs in your own folder, readable without the app. Backup and sync come from the drive you already use (OneDrive, Google Drive).
- **Open source:** the repo is public, so anyone can check the privacy claims.

### Honest weaknesses (address them or explain them on the website)

- No built-in sync between devices; it relies on the user's own synced folder.
- Chrome and Edge only (File System Access API); no mobile app.
- No server, so no automatic emailing, automatic bank connection or online access for an accountant. Reading a downloaded bank statement ([bank-import.md](bank-import.md)), exports and a pre-filled email cover these.

### First run: from download to first invoice

A single HTML file is unusual, and that is where a beginner gets lost. Setup convenience is a main focus (the owner's priority, 2026-10-17). The user must never wonder what to do next. Assume they don't know what an HTML file, a browser or a folder path is.

Where people get stuck, and the plan for each:

| Step | Risk | Plan |
|---|---|---|
| Download | The browser opens the file instead of saving it, or it lands in Downloads and gets lost | The website's download button forces a save, then shows step-by-step instructions for the visitor's system and browser, with pictures |
| Where to keep it | The app runs from Downloads, gets cleaned up or duplicated | The app knows its own path (`location.href`). If it runs from Downloads or a temp folder, it suggests moving it, e.g. to `Documents\Invojka` |
| Opening it | Double-click opens the default browser, which may be Firefox or Safari, where folder access doesn't work | The app detects an unsupported browser and shows a full-screen guide: "Open this file in Chrome or Edge", with how (right-click → Open with, or drag into the window). No broken screens |
| Data folder | "Pick a folder" means nothing to a beginner | Explain in one sentence what the folder is for and suggest a concrete place (a new `Invojka` folder in Documents, or in OneDrive or Google Drive for backup). Open the picker in Documents |
| Coming back | They can't find the file again; the browser asks for folder permission after a restart | Suggest a bookmark or a desktop shortcut after the first invoice. Reconnecting the folder takes one click with a clear explanation |
| Updates | They don't know a new version exists, or how to replace the file | The app can check the website for a newer version (sends only its version number) and says "download and replace this file; your data stays in your folder" |

Open idea: keep the app file inside the data folder, so one folder holds everything and syncs together.

### What this means for changes

- Never add a server, user accounts, analytics or tracking. Network requests stay limited to currencies and dates, plus the IČ or name a user types into the ARES lookup (see Constraints below).
- Each feature has to work for a stranger without the owner's help: clear onboarding, no hard-coded owner details, and good empty states.

## Constraints set by the owner

- **Local data, no cloud, no database.** All data is plain JSON in a folder the user chooses. Syncing that folder (Google Drive, OneDrive) is the user's own business and doubles as a backup.
- **Distributed as a single HTML file.** The user double-clicks `invojka.html` and there's nothing to install and no server.
- **The UI should be nice and smooth**, and it should **guide the user to the next step**. The owner judges progress by using the app, not by reading code. A screen that "does nothing" counts as a bug.
- **External requests are allowed as long as none of the user's data leaves the computer.** A request may contain a currency code and dates, never names, amounts or invoice contents. The one exception is the ARES lookup (approved 2026-10-18 with the Fakturoid list): it sends the IČ or company name the user is typing into it, which is public register data, and only at that moment.
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

