# Decision log

Newest first. Each entry records what was decided and why, and who decided when it was the owner's call.

## 2026-09-30

- **The Home screen's number tiles became a sentence, and the greeting became a joke by time of day** (the owner's request). The sentence is easier to read than four boxes and can say what matters ("all of it is overdue"). Greetings don't use a name, because Czech needs the vocative case. → [ui.md](ui.md)
- **Demo mode anonymizes the owner's own data in memory rather than showing generic sample data.** The owner wants screenshots and videos without creating data or touching files. Anonymizing the real data keeps the screens realistic: the same number of invoices, the same statuses and dates. At first, amounts were scaled by one hidden factor. The owner then asked for the amounts and charts to be made up too, so amounts are now invented per month and don't reveal real revenue or trends. → [architecture.md](architecture.md#demo-mode)
- **Colour scheme: beige papers + plain CSS blue, red only for overdue** (the owner's choice after six rounds of mockups). Cream content, kraft sidebar, blue headlines, buttons, links and charts; last year's bars are a pale blue tint. This replaces the petrol/teal/ochre scheme. The owner wanted fewer colours and text that stands out. → [ui.md](ui.md)
- **Bigger, bolder headlines** (the owner's request). Page titles are 36 px and section titles 24 px, all in Newsreader 600. Using one serif weight made the file about 50 kB smaller.
- **Typography review** (the owner's request, against Google Fonts, Material 3, Ramotion and Mosaiq). Fixes: embed Inter 500, because `font-medium` was rendering as regular; raise faint grey and warning text to 4.5:1; chart text at least 11 px; page titles in Newsreader 400 without negative tracking; tabular Inter instead of monospace for numbers; drop Inter `cv11`. The file grew by about 130 kB. → [ui.md](ui.md)
- **Warm paper look: cream background, serif headlines (Newsreader), Inter for everything else, small corners (max 6px), no all-caps labels, no shadows; teal and ochre charts.** The owner's choice. The serif is embedded as small woff2 subsets and used only in the UI, not in the PDF. The radius scale is capped in `@theme` so every `rounded-*` class stays subtle. → [ui.md](ui.md)
- **Exchange rates come from ECB (automatic), ČNB files (uploaded) and manual entry.** The owner allowed external requests as long as no user data is sent, and asked for manual entry. ČNB can't be fetched because of CORS; a proxy was rejected because it routes requests through a third party. → [exchange-rates.md](exchange-rates.md)
- **Revenue charts on the Home screen, by month (this year vs last) and by year.** The owner asked for them. They're hand-built SVG with no chart library, to keep the single file small and styling fully under control.
- **Foreign-currency revenue without a rate is excluded, and the UI says so.** A silent zero would under-report the NZD years.
- **Issuing an invoice saves its PDF into the data folder** (`pdf/<year>/<number>.pdf`), so every issued invoice has its document on disk.
- **PDFs use `@react-pdf/renderer` with embedded Inter TTFs.** They render the same everywhere and can be saved straight into the folder; the browser's print dialog can't do that.
- **QR Platba only for unpaid CZK invoices.** Czech banking apps expect CZK, and paying a paid invoice makes no sense.
- **A customer can be created from the invoice's customer search**, and "Edit customer" saves the invoice as a draft first. This came from the owner's feedback that the app should guide them and not lose work.
- **Drafts follow customer edits; issued invoices keep their snapshot.** An issued invoice must match what was sent.
- **Home screen with "Co dál" (Next steps) cards.** The owner found the first post-setup screen confusing ("it does nothing").
- **Onboarding Finish waits for the save; 0-byte files count as missing.** Fixes a real incident in the owner's OneDrive folder.
- **The source template is renamed to `index.html`; the only `invoicer.html` is the build output.** The owner opened the template and saw a blank page.
- **Single bundled HTML file** (the owner's choice). Tested: it works from `file://`, including folder access.
- **JSON, one file per type** (the owner's choice over one file per invoice). Sync conflicts are handled by a `lastModified` check and a conflict banner.
- **JSON rather than YAML.** YAML silently changes values: `01234567` becomes a number and loses its leading zero, and `no` becomes a boolean.
- **One business profile per data folder.** A different business uses a different folder, which keeps the model and numbering simple.
- **Chrome and Edge first, storage behind an adapter.** The File System Access API is Chromium-only; Firefox and Safari can get a browser-storage adapter with zip export later.
- **Stack:** React, TypeScript, Vite, Tailwind, Zustand, Zod, i18next, date-fns, papaparse. Common, typed, and small enough for one file.
- **Money in minor units, dates as ISO strings, IDs as strings, totals always computed.** See [data-model.md](data-model.md).
