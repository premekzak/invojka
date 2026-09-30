# UI

## Principles (from the owner)

- **Always show the next step.** The Home screen's "Co dál" (Next steps) cards come from the data: create an invoice, N overdue invoices, missing profile fields, review customers. New screens should do the same.
- **Smooth and fast:**
  - keyboard-first editors: the customer search works with ↑ ↓ Enter; Enter in a line description adds the next line, which takes focus
  - no page reloads
  - short rise animations (`animate-rise`)
  - hover actions on list rows
- **Never lose work:** autosave with a visible status; Finish and Issue wait for the save to finish; leaving the editor through "Upravit odběratele" (Edit customer) saves a draft first.
- **Explain in plain words.** The owner isn't a developer. Error and confirmation text says what happened and what to do.

## Screens

| Route | Screen |
|---|---|
| welcome / reconnect | One button: choose the folder, or reopen the remembered one |
| onboarding | 3 steps: your details, VAT mode, CSV import with a summary of merges |
| `#/` Přehled (Home) | A playful greeting by time of day; a summary sentence in place of number tiles; charts; "Co dál" cards; recent invoices |
| `#/invoices` Faktury (Invoices) | Search (number, customer, description), year filter, status chips; overdue due dates in red; "Zaplaceno" (Mark paid) on hover |
| `#/invoices/:id` (editor) | Customer search (with "Vytvořit „…“" / Create "…"), lines, totals with VAT summary, note; side panel with number, payment reference, dates (7/14/30-day buttons), DUZP, currency, language, rate, reverse charge; actions: PDF, Issue, Mark paid / unpaid, Cancel / Restore, Delete draft |
| `#/customers` Odběratelé (Customers) | Search, invoice count, revenue, last invoice; "Show archived"; "New customer" |
| `#/customers/:id` | Edit form, invoice defaults, internal note, stats and invoice history; Archive or Delete |
| `#/settings` Nastavení (Settings) | Your details, bank account, VAT, invoice defaults and numbering (with a preview of the next number), exchange rates, app language, theme, data folder, demo data switch (see [architecture.md](architecture.md#demo-mode)) |

## Design tokens (`src/index.css`)

- **Look (from the owner):** paper and one colour. A cream page (`bg` `#faf6ea`) with cream-white cards (`surface` `#fffdf7`), a kraft sidebar (`sidebar` `#efe4cf`), warm near-black text, and plain CSS blue (`accent` and `title`, `#0000ff`) for buttons, links, headlines and data. Red (`danger` `#a8322b`) is reserved for overdue items and errors. Otherwise, use only beige papers and warm greys. Dark mode keeps the warm brown-black and uses a lighter blue (`#9a9aff`, titles `#a3a3ff`) so it stays readable.
- **Home header:**
  - **Greeting:** chosen by time of day from `home.greetings.<slot>` (`dawn` 5–9, `morning` 9–12, `noon` 12–14, `afternoon` 14–18, `evening` 18–22, `night`). One per day and slot (`pickDaily` in `domain/greeting.ts`), so it doesn't change while you look at it. It never uses the owner's name: Czech would need the vocative case, and "Dobrý den, Jana" was wrong. The jokes, such as "pane Továrníku" (Mr Tycoon), were the owner's idea.
  - **Summary:** one or two sentences in `text-xl`, capped at `max-w-prose`. Numbers are semibold in `fg`, and the overdue part is in `danger`. Amounts are rounded to whole units (`f.moneyWhole`). The sentence covers invoices and revenue this year, the change against the same point last year (`yearTrend`), then what's waiting to be paid and how much of it is overdue. Its variants: no invoices yet; everything paid; nothing overdue; some overdue; all overdue.
- **Status badges:** overdue is red-tinted; issued is outlined blue; draft is outlined grey; paid is filled grey; cancelled is grey and struck through. The "Po splatnosti" (Overdue) key number turns red when it's above zero.
- **Sidebar:** the current page is marked with blue text and a 2 px blue line on the left, on `sidebar-active`.
- Tailwind 4 `@theme` colors: `bg`, `surface`, `surface-2/3`, `line`, `sidebar`, `sidebar-active`, `fg`, `fg-muted`, `fg-subtle`, `title` (applied to `h1`–`h3` in base CSS), `accent`, `danger`, `success`, `warning`, `series-1/2`.
- Dark mode is a `.dark` class on `<html>`, toggled from `settings.ui.theme` ("system" follows the OS).
- **Typography** (reviewed against Google Fonts' web typography guide and Material 3's type roles):
  | Role | Style | Use |
  |---|---|---|
  | Page title | `font-serif text-4xl leading-[1.2] font-semibold` (Newsreader 600, 36/43) | the `h1` of each screen |
  | Section title | `font-serif text-2xl font-semibold` (Newsreader 600, 24/32) | "Co dál", settings groups; chart and card titles use `text-lg font-semibold` |
  | Body | Inter 400, `text-sm` (14/20) | default app text |
  | Label and caption | Inter 500 or 400, `text-xs` (12/16) | field labels, hints, secondary lines |
  | Big number | Inter 600, `text-2xl`, `tabular-nums` | key numbers on Home |
  - No negative tracking on the serif. It's already tight.
  - Numbers in tables, invoice numbers, IČ and variable symbols use Inter `tabular-nums`, not monospace. `font-mono` is only for the numbering pattern and raw error text.
  - Chart text is at least 11 px.
  - Long help text is capped with `max-w-prose`.
  - Inter uses `ss01` (open digits). Don't turn on `cv11`, because its single-storey "a" clashes with the serif.
  - **Contrast:** all text colours reach 4.5:1 on `surface`, `bg` and `surface-2`, including `fg-subtle` (`#6b6150`, also on the kraft sidebar) and `warning` (`#9a5c0c`). Check new colours before using them for text.
- **Embedded fonts** (`loadUiFonts()`, `FontFace` API): Inter 400 and 600 are TTFs shared with the PDF. Inter 500 and Newsreader 600 (the only serif weight) are UI-only woff2 subsets (latin and latin-ext, for Czech). Every weight used in the UI must be embedded: a missing weight silently falls back to another one (before this, `font-medium` rendered as 400).
- **Corners are small.** The `@theme` radius scale is capped: `rounded-sm` 2px, `rounded`/`rounded-md` 3px, `rounded-lg` 4px, `rounded-xl` 5px, `rounded-2xl` 6px. Don't use `rounded-full` for chips or badges.
- **No shadows.** Cards, popovers, tooltips and buttons are separated by a 1 px `line` border and the surface colour. Card hover darkens the border instead of lifting.
- **No small caps or all-caps labels** in the UI. Use sentence case; a section title is a serif `h2`.
- Components live in `ui/primitives.tsx`: Button (primary, secondary, ghost, danger), Input, Field, Card, Choice. Native `<select>` elements use a shared class.

## Charts (`ui/BarChart.tsx`, `features/home/RevenueCharts.tsx`)

- Hand-built SVG, with no chart library.
- They follow the dataviz skill's rules:
  - columns at most 24 px wide, a 2 px rounded top, square at the baseline, 2 px gaps
  - light 1 px gridlines
  - a legend only when there are 2 or more series
  - selective value labels (the best year and the current year)
  - a hover tooltip for each band, with the whole band as the hover target
  - a "Tabulka" (Table) view
- **Colors:** focus style. This year is blue (`#0000ff`; dark `#8f8fff`) and last year is a pale tint of it (`#b3b8ff`; dark `#44449e`). Lightness, not hue, separates them, so it's colourblind-safe. The pale bars are deliberately faint (about 1.8:1, the owner's choice), and the Table view has exact values. Legend text is `fg`.
- **Incomplete periods** (the current month or year) use a 45° striped texture, and the tooltip says "zatím, k {date}" (so far, to {date}). Future months have no bar rather than a zero.
- Only revenue (issued plus paid) in CZK is counted. See [exchange-rates.md](exchange-rates.md) for foreign currencies.
