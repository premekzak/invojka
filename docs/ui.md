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
| welcome / reconnect | One button: choose the folder, or reopen the remembered one; other remembered businesses are listed under it |
| onboarding | 3 steps: your details, VAT mode, CSV import with a summary of merges |
| `#/` Přehled (Home) | A playful greeting by time of day; a summary sentence in place of number tiles; charts; "Co dál" cards; recent invoices |
| `#/invoices` Faktury (Invoices) | Search (number, customer, description), year filter, status chips; overdue due dates in rust (`warning`); "Zaplaceno" (Mark paid) on hover |
| `#/invoices/:id` (editor) | Customer search (with "Vytvořit „…“" / Create "…"), lines, totals with VAT summary, note; side panel with number, payment reference, dates (7/14/30-day buttons), DUZP, currency, language, rate, reverse charge; actions: PDF, Issue, Mark paid / unpaid, Cancel / Restore, Delete draft |
| `#/customers` Odběratelé (Customers) | Search, invoice count, revenue, last invoice; "Show archived"; "New customer" |
| `#/customers/:id` | Edit form, invoice defaults, internal note, stats and invoice history; Archive or Delete |
| `#/settings` Nastavení (Settings) | Your details, bank account, VAT, invoice defaults and numbering (with a preview of the next number), exchange rates, app language, theme, data folder, demo data switch (see [architecture.md](architecture.md#demo-mode)) |

## Design tokens (`src/index.css`)

- **Theme: Warm paper** (the owner's choice "F4", 2026-10-17, picked on the "Invojka colour scheme" design canvas from about twenty variants; it replaced the grayscale Ledger theme). A faintly cream page with white cards, warm greys, espresso text, a peach header band, blue for everything clickable and for charts, and the owner's darker orange used sparingly. The palette lives in `src/index.css` as `--paper` … `--peach` (light and dark); code uses only the role names. History: Ledger (2026-10-01), grayscale (2026-10-11), a white page (earlier on 2026-10-17).

  | Palette | Light | Dark | Roles |
  |---|---|---|---|
  | paper | `#fffaf6` | `#110d0b` | `bg` |
  | card | `#ffffff` | `#181411` | `surface` |
  | hover | `#faf6f3` | `#1c1714` | `row-hover`: hover on list and table rows (lighter than the `surface-2` table header) |
  | fill | `#f8eee7` | `#221d19` | `surface-2` (table header, hover rows, secondary buttons, selected chips, notice boxes) |
  | rule | `#eee6e0` | `#27221e` | `rule`: row dividers in tables and lists, and the line under the table header |
  | line | `#e3d6ce` | `#332c28` | `line`, `surface-3` (hover on fills) |
  | edge-side | `#b5a89f` | `#544b45` | `input-side`: the top and sides of fields (about 2:1 on card and paper) |
  | edge | `#807167` | `#84776f` | `input`: the bottom edge of fields (4.2:1 or more on card and paper) |
  | mid | `#695a50` | `#b5a89f` | `fg-muted`, `fg-subtle`, `fg-faint`, `line-strong` (hover borders) |
  | ink (espresso) | `#342117` | `#f2e9e4` | `fg`, `title`, `scrim` (light) |
  | blue | `#077491` | `#47b3d7` | `accent`: buttons, links, the selected filter, focus; `on-blue` text on it (white, dark `#110d0b`) |
  | blue-deep | `#055f78` | `#1b94b7` | `accent-deep`: the bottom of the primary-button gradient (white text 7.2:1; dark text 5.5:1) |
  | chart-1, chart-2 | `#099bc1`, `#aed9e9` | `#47b3d7`, `#225465` | `series-1` (this year), `series-2` (last year) |
  | orange | `#fa8d4e` | `#fa8d4e` | the logo only: the letter (light) or the square (dark) |
  | logo, on-logo | `#342117`, `#fa8d4e` | `#fa8d4e`, `#110d0b` | `brand`, `brand-fg`: the logo square and its letter |
  | peach | `#fdb081` | `#342117` (espresso) | `header` |
  | on-peach, on-peach-muted | `#342117`, `#4e372a` | `#f6e8df`, `#d7bfaf` | `header-fg`, `header-muted` |
  | red (crimson) | `#b7162d` | `#df676f` | `danger`: errors and delete (solid with `danger-fg`, or text). Rare |
  | rust | `#9e4501` | `#e48b53` | `warning`, `warning-chip-fg`: overdue and missing rates (6.1:1 on paper, 5.6:1 on fill) |
  | rust-chip | `#ffe6d6` | `#3a1e0e` | `warning-chip`, with rust text (5.3:1) |
  | green | `#1e7729` | `#66ac69` | `success`: short confirmations (saved, rates filled, file loaded) and the Paid status |

  - **Colours from the owner:** the blue comes from `#099bc1` (also tried: `#029bca`), the orange is `#fa8d4e`. Both fail contrast on white as they are (3.3:1 and 2.3:1), so the blue is darkened to `#077491` for text and white-text fills, `#099bc1` itself is used for chart bars, and the orange appears only as small marks or behind dark text.
  - **Owner's exceptions to the colour rules, recorded so nobody "fixes" them:** the peach header band is a large tinted area (the rule says large areas stay very muted); the page is faintly cream rather than white; orange is a second hue next to the blue accent, kept to the logo, never to anything clickable.
  - **Status on the header:** green and crimson reach only 3.1:1 and 3.7:1 on peach, so the save status in the header is a tick in header text, and an error is a solid crimson chip with `danger-fg`.
  - **Rust for warnings, crimson for errors** (2026-10-17). The owner found red aggressive, so overdue and missing rates are rust, a much darker step of the orange (L 0.50 vs 0.75), always with a label. Errors and delete stay crimson, because they are rare and must stand out. The "Co dál" icons are ink, so in dark mode the logo is the only identity orange next to the rust.
  - **One gradient, on primary buttons only** (the owner's request: gradients very scarcely, 2026-10-17): `bg-linear-to-b from-accent to-accent-deep`, hover `/90` on both stops. No other gradients.
  - **"Paid" is green text with a check icon, not a chip** (the owner's request, 2026-10-11; before, it was plain grey). Most rows are paid, so a chip would make the list loud. The icon keeps it clearly apart from the pale rust Overdue chip in grayscale. "Cancelled" stays grey text, struck through.
  - **Text links are underlined** (`underline underline-offset-2 decoration-line-strong`, darker on hover), so colour alone doesn't mark them.
  - **State rule:**
    - Fill hover is `/90`.
    - Neutral row and button hover is one step (`surface-2` → `surface-3`).
    - Outlined and card hover darkens the border to `line-strong`.
    - Selected is `surface-2` with an accent border.
    - Focus is an accent border plus a `line` ring.
    - Disabled is `opacity-50`.
    - No translucent tints for surfaces. Only these state effects and the modal scrim (`bg-scrim/50`) are translucent.
  - **Contrast:** every text colour reaches 4.5:1 on paper, card and fill in both modes, and field borders are well above 3:1. Dark mode sets `color-scheme: dark`, so native controls match.
  - **Checked 2026-10-01:** a computed contrast sweep of every text element and field border on Home, Invoices, Customers, Settings and the invoice editor, in light and dark mode, plus a grayscale screenshot of the invoice list. Everything passes.
  - **PDF:** neutral by the owner's choice (warm ink greys, a near-black "to pay" box). The cancelled and paid stamps are ink too. All PDF colours are in the `C` object at the top of `src/pdf/InvoiceDocument.tsx`.
- **Home header:**
  - **Greeting:** chosen by time of day from `home.greetings.<slot>` (`dawn` 5–9, `morning` 9–12, `noon` 12–14, `afternoon` 14–18, `evening` 18–22, `night`). One per day and slot (`pickDaily` in `domain/greeting.ts`), so it doesn't change while you look at it. It never uses the owner's name: Czech would need the vocative case, and "Dobrý den, Jana" was wrong. The jokes, such as "pane Továrníku" (Mr Tycoon), were the owner's idea.
  - **Summary:** one or two sentences in `text-lg`, capped at `max-w-prose`. Numbers are semibold in `fg`, and the overdue part is in `warning` (rust). Amounts are rounded to whole units (`f.moneyWhole`). The sentence covers invoices and revenue this year, the change against the same point last year (`yearTrend`), then what's waiting to be paid and how much of it is overdue. Its variants: no invoices yet; everything paid; nothing overdue; some overdue; all overdue.
- **Status badges:** overdue is a pale rust chip with rust text; issued has a solid `line-strong` outline with `fg` text; draft has a dashed outline with `fg-muted` text (labels aren't clickable, so none uses the accent); paid is green (`success`) text with a check icon; cancelled is plain grey text, struck through.
- **Tables:** amounts, quantities and dates are right-aligned with `tabular-nums`, and their headers are right-aligned too; text and invoice numbers stay left-aligned. Status labels in the invoice list are right-aligned (the owner's request, 2026-10-17), so they end at the same edge as the amount column. Rows are divided by `rule` (lighter than `line`) and hovered rows use `row-hover`, just off the card colour; both were made subtler at the owner's request.
- **Business switcher:** the business name at the right of the header is a button with a `ChevronsUpDown` icon (hover `header-active/50`). It opens a menu under it, aligned right, on `surface` with a `line` border and no shadow: each business with its folder name under it in `fg-muted` (only when it differs), a `Check` in `accent` on the current one, a `rule` divider, and "Přidat další firmu" in `accent` with a one-line hint. Escape or a click outside closes it.
- **Header, no sidebar** (the owner's choice, 2026-10-17; the sidebar is gone): a full-width peach band (`header`) with a `line` border under it, one row as wide as the page (`max-w-6xl`): the logo square and "Invojka" (display face, links to Home) on the left, the pages as centred pills with icons, and the business on the right with the save tick before it. "Nová faktura" is not in the header: it sits at the right end of the Faktury title row, in "Co dál" on Home and on each customer.
- **Save tick:** everything saved is just a `Check` in `header-fg` before the business name; its tooltip (and screen-reader text) says "Vše uloženo v 18:05", the folder name and that the browser hides the full path. While saving it's a small spinner in `header-muted`. An error or conflict is never only an icon: a solid crimson chip with words. In demo mode the tick is replaced by "Ukázková data · Vypnout".
- **Pills, the owner's exception to "no pills"** (2026-10-17): navigation only, `rounded-[12px] px-4 py-1.5 text-sm` (first fully rounded, then a touch less at the owner's request). The current page is a `header-active` pill (the page colour) with `font-medium` and `aria-current`; the others are `header-muted` text, hover `header-active/50`. Buttons, fields and boxes keep the small corners. The orange current-page edge went with the sidebar, so the orange is now only in the logo.
- Tailwind 4 `@theme` colors: `bg`, `surface`, `surface-2/3`, `line`, `line-strong`, `input`, `header`, `header-active`, `header-fg`, `header-muted`, `fg`, `fg-muted`, `fg-subtle`, `fg-faint`, `brand`, `title` (applied to `h1`–`h3` in base CSS), `accent`, `accent-fg`, `danger`, `danger-fg`, `warning`, `warning-chip`, `warning-chip-fg`, `success`, `scrim`, `series-1/2`.
- Dark mode is a `.dark` class on `<html>`, toggled from `settings.ui.theme` ("system" follows the OS).
- **Typography** (reviewed against Google Fonts' web typography guide and Material 3's type roles):
  **Five sizes only** (the owner's request, 2026-10-01): 36, 24, 18, 14 and 12 px. Don't add a sixth; pick the role instead. `body` defaults to `text-sm`, so text without a size class is body text and never the browser's 16 px.

  | Size | Role | Style | Use |
  |---|---|---|---|
  | 36 px | Page title | `font-display text-4xl leading-[1.2] font-bold tracking-[-0.03em]` (Bricolage Grotesque 700) | the `h1` of each screen |
  | 24 px | Section title | `font-display text-2xl font-bold tracking-[-0.015em] mb-3` (Bricolage Grotesque 700) | every title above a box: Home charts, "Co dál", "Poslední faktury", settings groups, customer sections; the error screen |
  | 24 px | Big number | Inter 600, `text-2xl`, `tabular-nums` | key numbers, such as a customer's invoice count and revenue |
  | 18 px | Lead | `text-lg` | the Home summary sentence, the invoice total, the logo letter |
  | 14 px | Body | Inter 400, `text-sm` (14/20); 500 for titles inside cards and for buttons | default app text, all buttons (also the `lg` size) |
  | 12 px | Label and caption | Inter 500 or 400, `text-xs` (12/16) | field labels, hints, secondary lines, badges, chart axis and value labels |
  - **Headings are Bricolage Grotesque 700** (the owner's choice "G2", 2026-10-17, for a more modern look; it replaced the Newsreader serif). Tight tracking only at display sizes: −0.03em at 36 px, −0.015em at 24 px. The logo letter uses it too (`font-display text-lg font-bold`). Body and labels stay Inter.
  - **Table headers** are 12 px `fg-muted` labels on the card with a `rule` line under them, no filled bar (2026-10-17).
  - Numbers in tables, invoice numbers, IČ and variable symbols use Inter `tabular-nums`, not monospace. `font-mono` is only for the numbering pattern and raw error text.
  - Chart text is 12 px (`text-xs`).
  - Long help text is capped with `max-w-prose`.
  - Inter uses `ss01` (open digits). Don't turn on `cv11`.
  - **Contrast:** see the Warm paper theme above. Check new colours before using them for text.
- **Embedded fonts** (`loadUiFonts()`, `FontFace` API): Inter 400 and 600 are TTFs shared with the PDF. Inter 500 and Bricolage Grotesque 700 (the only display weight, from `@fontsource/bricolage-grotesque`) are UI-only woff2 subsets (latin and latin-ext, for Czech). Every weight used in the UI must be embedded: a missing weight silently falls back to another one (before this, `font-medium` rendered as 400).
- **Corners are small.** The `@theme` radius scale is capped: `rounded-sm` 2px, `rounded`/`rounded-md` 3px, `rounded-lg` 4px, `rounded-xl` 5px, `rounded-2xl` 6px. Don't use `rounded-full` for chips or badges.
- **No shadows.** Cards, popovers, tooltips and buttons are separated by a 1 px `line` border and the surface colour. Card hover darkens the border instead of lifting. The only gradient is on primary buttons (see the theme).
- **Boxes** (the owner's request, 2026-10-01: one pattern everywhere):
  - **The title goes above the box, never inside it.** A `<section>` holds an `h2` section title (`font-display text-2xl font-bold tracking-[-0.015em] mb-3`) and then the box. Actions for the whole box (for example "Zobrazit vše") sit at the right end of the title row. A title can cover a group of boxes, such as the customer's stats and invoice list under "Faktury", or the "Co dál" cards.
  - **The box holds content only:** fields, rows, a chart. Field labels and a chart's legend and Table toggle are content.
  - **No bordered box inside a box.** A group inside a box uses a grey-filled panel (`rounded-lg bg-surface-2 p-4`), as in the exchange-rates panel.
  - **Spacing:** sections are 40 px apart (`space-y-10`); boxes in one group are 20 px apart (`gap-5`, `space-y-5`); side-by-side columns are 24 px apart (`gap-6`); a title sits 12 px above its box (`mb-3`).
  - **Padding:** content boxes use `p-5` (20 px); list boxes have no padding, and their rows use `px-5 py-3`. Only standalone centred dialogs (welcome, onboarding, the error screen) use `p-8`.
  - Boxes without a title are fine when their fields label themselves (the invoice editor).
- **No small caps or all-caps labels** in the UI. Use sentence case; a section title is a serif `h2`.
- Components live in `ui/primitives.tsx`: Button (primary, secondary, ghost, danger), Input, Select, Textarea, InputAffix, Labeled, Field, Checkbox, ErrorSummary, Card, Choice, SettingRow.
- **Forms** follow the design system's Forms section (2026-10-11):
  - **Field box:** the `.control` class in `index.css`, used by inputs, selects, text areas, InputAffix and the customer picker. It draws the "ledger line": `input-side` on the top and sides and the stronger `input` edge at the bottom. On hover the border is `line-strong`; on focus it is a 2 px `accent` edge (border plus 1 px inset), which also wins over an error. An error shows a `danger` border; disabled fields use `surface-2`. Selects draw their own chevron in `fg-muted`.
  - **Labels and notes:** `Labeled` wraps any single control. It puts the label above in 14 px 500 `fg` and a hint or error under the field, and wires `id`, `aria-describedby` and `aria-invalid`. An error is 12 px 500 `danger` with a `CircleAlert` icon.
  - **Required and optional:** required fields get `*` in `fg-muted`. Optional fields are not marked ("nepovinné" was removed).
  - **Units:** units sit inside the field (`InputAffix`, e.g. due days), not in the label.
  - **Saving with mistakes:** save buttons stay enabled; they are disabled only when nothing changed. Pressing one with mistakes shows the errors and focuses the first wrong field. This applies to the customer name, the invoice customer and number, and onboarding step 1. With more than one error, an `ErrorSummary` sits above the invoice; its items are buttons, because the hash is used for routing. An error appears after a save attempt or after leaving the field, and goes away as soon as the value is right. A taken invoice number shows at once.
  - **Choices and settings:** `Choice` cards are `role="radio"` inside a `role="radiogroup"`; selected is `surface-2` with a 2 px `accent` edge. The settings "Aplikace" section uses `SettingRow`s.

## Charts (`ui/BarChart.tsx`, `features/home/RevenueCharts.tsx`)

- Hand-built SVG, with no chart library.
- They follow the dataviz skill's rules:
  - columns at most 24 px wide, a 2 px rounded top, square at the baseline, 2 px gaps
  - light 1 px gridlines
  - a legend only when there are 2 or more series
  - selective value labels (the best year and the current year)
  - a hover tooltip for each band, with the whole band as the hover target
  - a "Tabulka" (Table) view
- **Colors:** focus style. This year is `mid` grey and last year the lighter `edge-side` grey (about 2:1). Lightness separates them, so it's colourblind-safe. The light bars are deliberately faint (the owner's choice), and the Table view has exact values. Legend text is `fg`.
- **Incomplete periods** (the current month or year) use a 45° striped texture, and the tooltip says "zatím, k {date}" (so far, to {date}). Future months have no bar rather than a zero.
- Only revenue (issued plus paid) in CZK is counted. See [exchange-rates.md](exchange-rates.md) for foreign currencies.
