# Exchange rates

Foreign-currency invoices count towards the statistics (charts, KPIs, customer revenue) in CZK. `totalCzk(inv)` returns `total × exchangeRate`, or `undefined` when there's no rate. Such invoices are **excluded, and the UI says so**; they're never silently counted as zero.

## Where rates come from

| Source | How | `exchangeRateSource` |
|---|---|---|
| **ECB** (automatic) | `fx/ecb.ts` → `api.frankfurter.dev`: one request per currency and year (`fetchEcbYear`) or per invoice (`fetchEcbRate`, the "ECB" button in the editor) | `ecb` |
| **ČNB** (official) | The user downloads ČNB's yearly file `rok.txt?rok=YYYY` in the browser, saves it and uploads it. `parseCnbYear` reads it. | `cnb` |
| **Manual** | Typed into the rate field on the invoice | `manual` |

**Why not fetch ČNB directly:** both `api.cnb.cz/cnbapi/exrates/*` and `cnb.cz/…/rok.txt` send no CORS headers. The latter allows only `apl.cnb.cz`. Chrome blocks them from `localhost` and from `file://` (checked 2026-09-30). A proxy would send requests through a third party, so it was rejected. Frankfurter sends `access-control-allow-origin: *` and returns every trading day for a year range. ECB and ČNB rates differ only slightly (NZD on 14 Mar 2016: ECB 16.304, ČNB 16.307).

**Privacy:** a rate request carries only the currency code and dates.

## Rules (`domain/fx.ts`)

- **Rate date:** `rateDateOf(inv)` is the DUZP if set, otherwise the issue date.
- **Weekends and holidays:** `rateOn` uses the latest published rate on or before the date, within 10 days, as ČNB and ECB do. `fetchEcbYear` starts on 24 December of the previous year so that 1–2 January are covered.
- **ČNB file format:** `Datum|1 AUD|…|100 HUF|…`, with dates as `DD.MM.YYYY` and decimal commas. The rate is divided by the amount in the header (`100 HUF`). The header can repeat mid-file. Tested against the real 2016 file: 32 currencies, 252 NZD days.
- **Filling in never overwrites an existing rate.** `fillRates` only touches invoices with `needsRate`, so manual rates stay.
- In the editor:
  - changing the **currency** clears the rate
  - changing the **date** clears only a fetched (`ecb`/`cnb`) rate; a manual one stays
  - issuing a foreign-currency invoice without a rate fetches one from ECB (best effort)
- Drafts are skipped when rates are filled in bulk.

## UI

- **Home:** the note under the charts shows "Bez N faktur v … – chybí kurz." (N invoices excluded, no exchange rate), with **Doplnit kurzy** (Fill in rates) and **Další možnosti** (More options).
- **Settings → Kurzy měn** (Exchange rates):
  - a status line with the number of invoices missing a rate
  - the ECB button with progress
  - direct `rok.txt` links for exactly the years still missing, and a multi-file upload
- **Invoice editor:** the rate field, an ECB button, and a line showing the source and the approximate CZK amount.
