# UI

## Principles (from the owner)

- **Always show the next step.** The Home screen's table of things to check (under the greeting, next to the "Nová faktura" tile; captioned "Co dál" cards until 2026-10-17) comes from the data: create an invoice, N overdue invoices, missing profile fields, review customers. New screens should do the same.
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
| `#/` Přehled (Home) | A playful greeting by time of day; a summary sentence in place of number tiles; the "Nová faktura" tile and a table of things to check, above the charts; recent invoices |
| `#/invoices` Faktury (Invoices) | The total under the title adds up issued and paid invoices only, and says "bez konceptů a stornovaných" when the list shows some; filtered to drafts or cancelled, it adds those up. Search (number, customer, description), year filter, a segmented status filter with counts; due dates in grey (the status label says overdue, the date's tooltip says by how many days); "Zaplaceno" (Mark paid) on hover, inside the status cell |
| `#/invoices/:id` (editor) | Customer search (with "Vytvořit „…“" / Create "…"), lines, totals with VAT summary, note; side panel with number, payment reference, dates (7/14/30-day buttons), DUZP, currency, language, rate, reverse charge; actions: PDF, Issue, Mark paid / unpaid, Cancel / Restore, Delete draft |
| `#/customers` Odběratelé (Customers) | Search, paid invoices and the amount paid ("Zaplacených faktur", "Zaplaceno"), last invoice; "Show archived"; "New customer". Paid money without an exchange rate shows in its own currency ("8 500 Kč + 1 500 NZ$"), never as 0 Kč |
| `#/customers/:id` | Edit form, invoice defaults, internal note, stats (paid invoices with "Celkem vystaveno N faktur" under them, and the amount paid) and invoice history; Archive or Delete |
| `#/settings` Nastavení (Settings) | Your details, bank account, VAT, invoice defaults and numbering (with a preview of the next number), exchange rates, app language, theme, data folder, demo data switch (see [architecture.md](architecture.md#demo-mode)) |

## Design tokens (`src/index.css`)

- **Theme: Warm paper** (the owner's choice "F4", 2026-10-17, picked on the "Invojka colour scheme" design canvas from about twenty variants; it replaced the grayscale Ledger theme). A faintly cream page with white cards, warm greys, espresso text, a peach header band, blue for everything clickable and for charts, and the owner's darker orange used sparingly. The palette lives in `src/index.css` as `--paper` … `--peach` (light and dark); code uses only the role names. History: Ledger (2026-10-01), grayscale (2026-10-11), a white page (earlier on 2026-10-17).

  | Palette | Light | Dark | Roles |
  |---|---|---|---|
  | paper | `#f6eee8` | `#110d0b` | `bg` (since scheme A a step darker than the white cards, so boxes need no border) |
  | card | `#ffffff` | `#181411` | `surface` |
  | hover | `#faf6f3` | `#1c1714` | `row-hover`: hover on list and table rows (lighter than the `surface-2` table header) |
  | fill | `#f8eee7` | `#221d19` | `surface-2` (table header, hover rows, secondary buttons, selected chips, notice boxes) |
  | rule | `#eee6e0` | `#27221e` | `rule`: small dividers (menus, settings rows). Tables and lists use stripes instead |
  | line | `#e3d6ce` | `#332c28` | `line`, `surface-3` (hover on fills) |
  | field | `#f9f4f0` | `#1e1915` | `field`: the faint fill inside fields |
  | edge | `#93857b` | `#6f645d` | `input`: the even 2 px edge of fields (3.3:1 on the field fill, 3:1 in dark) |
  | mid | `#695a50` | `#b5a89f` | `fg-muted`, `fg-subtle`, `fg-faint`, `line-strong` (hover borders) |
  | ink (espresso) | `#342117` | `#f2e9e4` | `fg`, `title`, `scrim` (light) |
  | blue | `#006fb5` | `#5eaceb` | `accent`: links, the selected filter, focus, solid fills; `on-blue` text on it (white 5.3:1, dark `#110d0b`) |
  | blue-deep | `#005d9c` | `#48a0e0` | `accent-deep`: hover on accent fills (white text 6.9:1; dark text 6.8:1) |
  | chart-1, chart-2 | `#3899e2`, `#bddcf7` | `#5eaceb`, `#2a4b66` | `series-1` (this year, 3.1:1 on card), `series-2` (last year) |
  | orange | `#fa8d4e` | `#fa8d4e` | the logo only: the dot of the i (light) or the receipt (dark) |
  | logo, on-logo, logo-dot | `#342117`, `#fffaf6`, `#fa8d4e` | `#fa8d4e`, `#110d0b`, `#fffaf6` | `brand`, `brand-fg`, `brand-dot`: the logo's receipt, the stem of its i, the dot |
  | peach | `#f28d50` | `#342117` (espresso) | `header` (flat, practically the logo orange `#fa8d4e`; espresso text 6.3:1, muted 4.6:1) |
  | on-peach, on-peach-muted | `#342117`, `#4e372a` | `#f6e8df`, `#d7bfaf` | `header-fg`, `header-muted` |
  | red (crimson) | `#b7162d` | `#df676f` | `danger`: errors and delete (solid with `danger-fg`, or text). Rare |
  | rust | `#9e4501` | `#e48b53` | `warning`, `warning-chip-fg`: overdue and missing rates (6.1:1 on paper, 5.6:1 on fill) |
  | rust-chip | `#ffe6d6` | `#3a1e0e` | `warning-chip`, with rust text (5.3:1) |
  | green | `#1e7729` | `#66ac69` | `success`: short confirmations (saved, rates filled, file loaded) and the Paid status |
  | green-chip | `#e4f2e5` | `#173019` | `success-chip`: behind the Paid label (green text 4.9:1, dark 5.2:1) |

  - **Colours from the owner:** the blue comes from `#099bc1` (also tried: `#029bca`), the orange is `#fa8d4e`. Both fail contrast on white as they are (3.3:1 and 2.3:1), so the blue is darkened to `#077491` for text and white-text fills, `#099bc1` itself is used for chart bars, and the orange appears only as small marks or behind dark text.
  - **Owner's exceptions to the colour rules, recorded so nobody "fixes" them:** the peach header band is a large tinted area (the rule says large areas stay very muted); the page is faintly cream rather than white; orange is a second hue next to the blue accent, kept to the logo, never to anything clickable.
  - **Status on the header:** green and crimson reach only 3.1:1 and 3.7:1 on peach, so the save status in the header is a tick in header text, and an error is a solid crimson chip with `danger-fg`.
  - **Rust for warnings, crimson for errors** (2026-10-17). The owner found red aggressive, so overdue and missing rates are rust, a much darker step of the orange (L 0.50 vs 0.75), always with a label. Errors and delete stay crimson, because they are rare and must stand out. The Home tile icons are ink (overdue: rust), so in dark mode the logo is the only identity orange next to the rust.
  - **One gradient: the footer** (2026-10-17). Scheme "A" tried subtle gradients on primary buttons and the header band; the owner found both too much the same day, so buttons are flat `accent` (hover `accent-deep`) and the header is flat. Later the same day the owner asked for a footer with a very slight one, so that is the only gradient now.
  - **Scheme "A"** (2026-10-17): the header orange darker (`#f28d50`, flat, picked as "O3" from six steps), the blue moved from teal (hue 224) to azure (hue 245), a bluer chart. Buttons and links share `accent` `#006fb5` (white text 5.3:1).
  - **Status labels are all one style** (the owner's choice "T-C", 2026-10-17; it replaced the 2026-10-11 "green text with a check" for Paid): a soft rounded label (`rounded-[12px]`, the pill radius) with a 6 px dot and the word. Draft: `surface-2`, a hollow dot. Issued: `surface-2`, a `line-strong` dot. Overdue: `warning-chip` with rust. Paid: `success-chip` with green. Cancelled: `surface-2`, struck through. The words always say it, so grayscale and colour blindness are fine.
  - **Text links are underlined** (`underline underline-offset-2 decoration-line-strong`, darker on hover), so colour alone doesn't mark them.
  - **State rule:**
    - Fill hover is `/90`.
    - Neutral row and button hover is one step (`surface-2` → `surface-3`).
    - Outlined hover (fields, choices) darkens the border to `line-strong`; borderless clickable cards turn `row-hover`.
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
- **Header, no sidebar** (the owner's choice, 2026-10-17; the sidebar is gone): a full-width flat peach band (`header`) with no border under it, one row as wide as the page (`max-w-6xl`): the receipt logo and "Invojka" (display face, links to Home) on the left, the pages as centred pills with icons, and the business on the right with the save tick before it. "Nová faktura" is not in the header: it sits at the right end of the Faktury title row and on Home as the blue "Nová faktura" tile, with no separate button (2026-10-17), and on each customer.
- **Save tick:** everything saved is just a `Check` in `header-fg` before the business name; its tooltip (and screen-reader text) says "Vše uloženo v 18:05", the folder name and that the browser hides the full path. While saving it's a small spinner in `header-muted`. An error or conflict is never only an icon: a solid crimson chip with words. In demo mode the tick is replaced by "Ukázková data · Vypnout".
- **Pills, the owner's exception to "no pills"** (2026-10-17): navigation only, `rounded-[12px] px-4 py-1.5 text-sm` (first fully rounded, then a touch less at the owner's request). The labels are Roboto 500 with +0.02em letter spacing (`font-nav font-medium tracking-[0.02em]`, 8 px apart). The current page is a `header-active` pill (the page colour) with `aria-current`, the same weight as the rest; the others are `header-muted` text, hover `header-active/50`. Buttons, fields and boxes keep the small corners. The orange current-page edge went with the sidebar, so the orange is now only in the logo.
- Tailwind 4 `@theme` colors: `bg`, `surface`, `surface-2/3`, `line`, `line-strong`, `input`, `header`, `header-active`, `header-fg`, `header-muted`, `fg`, `fg-muted`, `fg-subtle`, `fg-faint`, `brand`, `brand-fg`, `brand-dot`, `title` (applied to `h1`–`h3` in base CSS), `accent`, `accent-fg`, `danger`, `danger-fg`, `warning`, `warning-chip`, `warning-chip-fg`, `success`, `scrim`, `series-1/2`.
- Dark mode is a `.dark` class on `<html>`, toggled from `settings.ui.theme` ("system" follows the OS).
- **Typography** (reviewed against Google Fonts' web typography guide and Material 3's type roles):
  **Five sizes only** (the owner's request, 2026-10-01): 36, 24, 18, 14 and 12 px. Don't add a sixth; pick the role instead. `body` defaults to `text-sm`, so text without a size class is body text and never the browser's 16 px.

  | Size | Role | Style | Use |
  |---|---|---|---|
  | 36 px | Page title | `font-display text-4xl leading-[1.2] font-bold tracking-[-0.03em]` (Bricolage Grotesque 700) | the `h1` of each screen |
  | 24 px | Section title | `font-display text-2xl font-bold tracking-[-0.015em] mb-3` (Bricolage Grotesque 700) | every title above a box: Home charts, "Poslední faktury", settings groups, customer sections; the error screen |
  | 24 px | Big number | Inter 600, `text-2xl`, `tabular-nums` | key numbers, such as a customer's invoice count and revenue |
  | 18 px | Lead | `text-lg` | the Home summary sentence, the invoice total, "Invojka" next to the logo |
  | 14 px | Body | Inter 400, `text-sm` (14/20); 500 for titles inside cards and for buttons | default app text, all buttons (also the `lg` size) |
  | 12 px | Label and caption | Inter 500 or 400, `text-xs` (12/16) | field labels, hints, secondary lines, badges, chart axis and value labels |
  - **Headings are Bricolage Grotesque 700** (the owner's choice "G2", 2026-10-17, for a more modern look; it replaced the Newsreader serif). Tight tracking only at display sizes: −0.03em at 36 px, −0.015em at 24 px. The product name next to the logo uses it too (`font-display text-lg font-bold`). Body and labels stay Inter.
  - **The header navigation is Roboto 500** (the owner's choice "R3", 2026-10-17, after rounds of Inter weights, Bricolage and seven other faces): 14 px, +0.02em, all pages the same weight. It is a third face, used only there; only weight 500 is embedded (latin + latin-ext woff2, about 40 kB). Don't use Roboto anywhere else without asking.
  - **Tables and lists have soft stripes, no row lines** (the owner's choice "T-C", 2026-10-17): even rows `row-hover`, hover `surface-2`; the header is 12 px `fg-muted` labels on the card with no line under it. No empty trailing column: a row action sits in the last cell. On the invoice list "mark paid" is an icon button before the status; on the customer list "+ Nová faktura" is a one-line `accent` link after the last-invoice date, shown on hover or keyboard focus (a boxed secondary button wrapped onto two lines and blended into the hovered row, 2026-10-17). Status filters are a segmented control: a `surface-3` track (dark: `surface-2`) with the chosen segment in `surface` (dark: `surface-3`), each with its count.
  - Numbers in tables, invoice numbers, IČ and variable symbols use Inter `tabular-nums`, not monospace. `font-mono` is only for the numbering pattern and raw error text.
  - Chart text is 12 px (`text-xs`).
  - Long help text is capped with `max-w-prose`.
  - Inter uses `ss01` (open digits). Don't turn on `cv11`.
  - **Contrast:** see the Warm paper theme above. Check new colours before using them for text.
- **Embedded fonts** (`loadUiFonts()`, `FontFace` API): Inter 400 and 600 are TTFs shared with the PDF. Inter 500 and Bricolage Grotesque 700 (the only display weight, from `@fontsource/bricolage-grotesque`) are UI-only woff2 subsets (latin and latin-ext, for Czech). Every weight used in the UI must be embedded: a missing weight silently falls back to another one (before this, `font-medium` rendered as 400).
- **Corners are small.** The `@theme` radius scale is capped: `rounded-sm` 2px, `rounded`/`rounded-md` 3px, `rounded-lg` 4px, `rounded-xl` 5px, `rounded-2xl` 6px. Don't use `rounded-full` for chips or badges.
- **Footer** (the owner's request, 2026-10-17): espresso with a very slight top-to-bottom gradient (`footer` `#39251a` to `footer-deep` `#2f1e15`, the same in both modes), 16 below the content, as wide as the page. Left: the logo in its dark-mode colours (the `on-espresso` class re-points the `brand` roles), "Invojka" in the display face and the tagline. Right: "Bez cloudu a bez účtu. Funguje i offline." and a link to invojka.cz. Text is `footer-fg` cream (11.5:1) and `footer-muted` (7.8:1). The layout is a full-height column, so the footer sits at the bottom of short pages too.
- **Home: a "Nová faktura" tile and a table of things to check** (the owner's choice "K2", 2026-10-17). Two different things, so they look different. The tile is permanent: a solid `accent` block (hover `accent-deep`), 17.5 rem wide, with a 44 px plus, the name at 18 px semibold and a one-line hint; it reads as the main button. The table is problem-based: a white card whose first line says how many things need checking (rust alert icon), then one striped row per problem (a dot, a title, a detail line, a small secondary-styled link button). Overdue invoices are rust; missing supplier details and active customers without an email are neutral. With nothing to check it becomes one line: a green check, "Vše v pořádku". The two sit side by side at equal height. Also tried the same day: four shortcut tiles ("C6 + C3"), which mixed the action with the to-dos.
- **No shadows, few borders** (fewer borders: the owner's request, 2026-10-17). Cards and boxes have no border: white `surface` on the darker page is enough. A clickable card shows hover as `row-hover`. Borders stay where they do a job: fields (an even 2 px edge on a faint fill), secondary buttons, choice cards, status labels, and floating things over content (menus, the customer picker, chart tooltips). Separator lines above form actions are gone; spacing does it. Table rows keep their `rule` dividers. Gradients: see the theme.
- **Boxes** (the owner's request, 2026-10-01: one pattern everywhere):
  - **The title goes above the box, never inside it.** A `<section>` holds an `h2` section title (`font-display text-2xl font-bold tracking-[-0.015em] mb-3`) and then the box. Actions for the whole box (for example "Zobrazit vše") sit at the right end of the title row. A title can cover a group of boxes, such as the customer's stats and invoice list under "Faktury".
  - **The box holds content only:** fields, rows, a chart. Field labels and a chart's legend and Table toggle are content.
  - **No bordered box inside a box.** A group inside a box uses a grey-filled panel (`rounded-lg bg-surface-2 p-4`), as in the exchange-rates panel.
  - **Spacing:** sections are 40 px apart (`space-y-10`); boxes in one group are 20 px apart (`gap-5`, `space-y-5`); side-by-side columns are 24 px apart (`gap-6`); a title sits 12 px above its box (`mb-3`).
  - **Page:** `px-8 pt-12 pb-8`, so each page title has 48 px above it (the owner asked for more room, 2026-10-17; it was 32).
  - **Padding:** content boxes use `p-5` (20 px); list boxes have no padding, and their rows use `px-5 py-3`. Only standalone centred dialogs (welcome, onboarding, the error screen) use `p-8`.
  - Boxes without a title are fine when their fields label themselves (the invoice editor).
- **No small caps or all-caps labels** in the UI. Use sentence case; a section title is a serif `h2`.
- Components live in `ui/primitives.tsx`: Button (primary, secondary, ghost, danger), Input, Select, Textarea, InputAffix, Labeled, Field, Checkbox, ErrorSummary, Card, Choice, SettingRow.
- **Forms** follow the design system's Forms section (2026-10-11):
  - **Field box:** the `.control` class in `index.css`, used by inputs, selects, text areas, InputAffix and the customer picker. It has a faint `field` fill and an even 2 px `input` edge on all four sides (the owner's choice, 2026-10-17; it replaced the "ledger line" with a heavier bottom, which read as a shadow). On hover the edge is `line-strong`; on focus it is `accent` with no inner shadow, which also wins over an error. An error shows a `danger` edge; disabled fields are plain `surface` with a `line` edge and muted text. Selects draw their own chevron in `fg-muted`.
  - **Labels and notes:** `Labeled` wraps any single control. It puts the label above in 14 px 500 `fg` and a hint or error under the field, and wires `id`, `aria-describedby` and `aria-invalid`. An error is 12 px 500 `danger` with a `CircleAlert` icon.
  - **Required and optional:** required fields get `*` in `fg-muted`. Optional fields are not marked ("nepovinné" was removed).
  - **Units:** units sit inside the field (`InputAffix`, e.g. due days), not in the label.
  - **Saving with mistakes:** save buttons stay enabled; they are disabled only when nothing changed. Pressing one with mistakes shows the errors and focuses the first wrong field. This applies to the customer name, the invoice customer and number, and onboarding step 1. With more than one error, an `ErrorSummary` sits above the invoice; its items are buttons, because the hash is used for routing. An error appears after a save attempt or after leaving the field, and goes away as soon as the value is right. A taken invoice number shows at once.
  - **Choices and settings:** `Choice` cards are `role="radio"` inside a `role="radiogroup"`; selected is `surface-2` with a 2 px `accent` edge. The settings "Aplikace" section uses `SettingRow`s.

## Colour schemes

Settings → App → Barevné schéma (`settings.ui.scheme`). Light and dark come from Vzhled, so every scheme has both. The default `warm` is Warm paper, defined in `src/index.css`. Every other scheme is a file in `src/schemes/` that redefines the palette (the `--paper` … `--peach` slots, the header pill and the footer) under `<html data-scheme="…">`; components never change.

How a scheme is made: the owner puts images and a brief (`zadani.md`) in `schemes/<name>/` (only the brief is committed, images may be under copyright). The palette is built in OKLCH, every text pair is computed to 4.5:1 and edges and chart bars to 3:1 in both modes, and a preview in the real app comes before it is wired in. A dark header needs its own `--color-header-active` (the default pill is the page colour, which only works on a light header).

| Scheme | From | Light | Dark |
|---|---|---|---|
| `warm` Teplý papír | the owner's choice "F4" | see the tokens above | |
| `branicek` Braníček (the owner approved it 2026-10-17) | a Braník Světlý can | foam-cream paper, bottle-green header and actions, a gold logo receipt with a crest-red dot, dark green footer | "Černý": stout-brown paper, foam text, light green actions, dark green header |

| `modrotisk` Modrotisk (2026-10-17) | Czech indigo blueprint fabric | linen-white paper tinted to indigo, an indigo header and actions, a white logo receipt with a sky-blue dot | "Indigová noc": deep indigo, pattern-white text, periwinkle actions |
| `praha` Praha za soumraku (2026-10-17) | roofs, sandstone, copper domes, gas lamps | sandstone paper, a terracotta header with a darker pill, actions in green copper patina, amber warnings | dusk: slate-blue night, gas-lamp gold actions and charts, a dark roof header, orange-red warnings |
| `kolac` Koláč (2026-10-17) | kolache: tvaroh, poppy seed, plum jam | tvaroh-cream paper, poppy blue-grey secondary text, a plum header and actions, a golden-crust receipt with a poppy dot | "Pražený mák": dark poppy, cream text, lighter plum actions |

The list of schemes lives in `SCHEMES` (`src/domain/schema.ts`); `src/schemes/schemes.test.ts` checks that each one has its file, is imported, has a name in both languages and redefines every slot in light and dark. The palettes were generated and checked by a script against the design system's scheme requirements, including the header text on the pill and the footer.

Every scheme but Warm paper has a saturated header, which breaks the "large areas are muted" rule like Warm paper's orange header does. Braníček breaks the "large areas are muted" rule with its saturated green header, like Warm paper's orange header; and its success green sits near the accent green (shifted towards yellow). Braník is a trademark: a public release should give the scheme a neutral name.

## Charts (`ui/BarChart.tsx`, `features/home/RevenueCharts.tsx`)

- Hand-built SVG, with no chart library.
- They follow the dataviz skill's rules:
  - columns at most 24 px wide, a 2 px rounded top, square at the baseline, 2 px gaps
  - light 1 px gridlines
  - a legend only when there are 2 or more series
  - selective value labels (the best year and the current year)
  - a hover tooltip for each band, with the whole band as the hover target
  - a "Tabulka" (Table) view
- **Colors:** focus style. This year is `mid` grey and last year a lighter grey (about 2:1). Lightness separates them, so it's colourblind-safe. The light bars are deliberately faint (the owner's choice), and the Table view has exact values. Legend text is `fg`.
- **Incomplete periods** (the current month or year) use a 45° striped texture, and the tooltip says "zatím, k {date}" (so far, to {date}). Future months have no bar rather than a zero.
- Only revenue (issued plus paid) in CZK is counted. See [exchange-rates.md](exchange-rates.md) for foreign currencies.
