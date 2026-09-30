# Invoicer

Create and analyse invoices in your browser. Your data stays on your computer as plain JSON files in a folder you choose. There's no account, no cloud and no database.

- Invoices in Czech or English, for VAT payers and non-payers, with multiple lines, VAT summary and reverse charge
- PDF with a QR Platba payment code, saved into your folder
- Overdue tracking, and revenue by month and by year
- Foreign-currency invoices converted to CZK (ECB rates automatically, ČNB rates from their yearly file, or entered by hand)
- Import from a previous invoicing service's CSV export

## Using it

1. Open `invoicer.html` in **Chrome or Edge** (double-click it).
2. Click **Choose data folder** and pick an empty folder, or one that already holds Invoicer data. A folder synced by Google Drive or OneDrive gives you a backup for free.
3. Fill in your details and VAT status, and optionally import CSV files.

On the next launch, one click reconnects to the same folder.

The folder contains `settings.json`, `customers.json`, `invoices.json` and `pdf/<year>/…pdf`. You can back them up, keep them in version control, or read them in any editor.

**Privacy:** the only network requests are exchange-rate lookups (a currency code and dates). No invoice data ever leaves your computer.

## Developing

```
npm install
npm run dev      # development server
npm test         # unit tests
npm run build    # produces dist/invoicer.html
```

Documentation: [docs/](docs/README.md).
