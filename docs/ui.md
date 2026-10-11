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

- **Theme: Ledger, mild grey** (the owner's choices, 2026-10-01: Ledger was picked from a gallery of five paper themes after a grayscale-first pass, then its cream paper was replaced by a very light grey). A very light grey page, white cards, near-neutral greys with a faint cool tint, black (ink) for identity, and colour only where it has a job. The palette lives in `src/index.css` as `--paper` … `--green` (light and dark); code uses only the role names.

  | Palette | Light | Dark | Roles |
  |---|---|---|---|
  | paper | `#f6f7f8` | `#101112` | `bg`, `sidebar` (separated by its border) |
  | card | `#ffffff` | `#161719` | `surface` |
  | fill | `#ecedef` | `#1f2122` | `surface-2` (hover rows, secondary buttons, selected chips, notice boxes), `sidebar-active` |
  | line | `#d4d6d8` | `#343538` | `line`, `surface-3` (hover on fills), the top and sides of fields |
  | edge | `#86898d` | `#6b6e72` | `input`: the bottom edge of fields (3.3:1 or more on card and paper) |
  | mid | `#595b5e` | `#a2a5a8` | `fg-muted`, `fg-subtle`, `fg-faint`, `line-strong` (hover borders) |
  | ink | `#181a1c` | `#eaebed` | `fg`, `scrim` (light), and `brand`/`title`: identity, never clickable (`h1`–`h3`, the logo, the "Co dál" icons) |
  | blue | `#0000ff` | `#9a9aff` | `accent`: everything you can click (primary buttons, active page, selected chips, links, focus), this year's bars |
  | blue-pale | `#b3b8ff` | `#44449e` | last year's bars (`series-2`) |
  | red | `#be2323` | `#d16c5d` | `danger` (errors, delete: solid with `danger-fg`), `warning` (overdue, missing rates: text and pale chips) |
  | red-chip | `#ffd5d1` | `#3b1514` | `warning-chip`, with red text (`warning-chip-fg`) |
  | green | `#1e7729` | `#4e9a5b` | `success`: short confirmations only (saved, rates filled, file loaded) |

  - **One accent.** Blue is what you can click; identity (titles, logo, next-step icons) is black ink, never clickable. Navy `#0f2a5f` (dark `#7489b4`) was tried as a second interface colour the same day and replaced by black at the owner's request. Never make blue decorative.
  - **Red covers warnings and errors** (the owner's choice: warnings will be common, errors rare, so there's no separate warning colour). Warnings are pale red chips with red text, so a list with many overdue rows stays calm. Real errors are solid red with white text, or red text.
  - **"Paid" and "Cancelled" are plain grey text, not chips.** Paid is the normal state, and in a grayscale test it must stay clearly apart from the pale red Overdue chip.
  - **`#0000ff`** is picker-pure (maximum chroma), the owner's deliberate exception. It stays on small elements and is never a fill for large areas.
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
  - **Summary:** one or two sentences in `text-lg`, capped at `max-w-prose`. Numbers are semibold in `fg`, and the overdue part is in `warning` (red). Amounts are rounded to whole units (`f.moneyWhole`). The sentence covers invoices and revenue this year, the change against the same point last year (`yearTrend`), then what's waiting to be paid and how much of it is overdue. Its variants: no invoices yet; everything paid; nothing overdue; some overdue; all overdue.
- **Status badges:** overdue is a pale red chip with red text; issued is outlined blue; draft is outlined grey; paid is plain grey text; cancelled is plain grey text, struck through.
- **Sidebar:** the current page is marked with blue text and a 2 px blue line on the left, on `sidebar-active`.
- Tailwind 4 `@theme` colors: `bg`, `surface`, `surface-2/3`, `line`, `line-strong`, `input`, `sidebar`, `sidebar-active`, `fg`, `fg-muted`, `fg-subtle`, `fg-faint`, `brand`, `title` (applied to `h1`–`h3` in base CSS), `accent`, `accent-fg`, `danger`, `danger-fg`, `warning`, `warning-chip`, `warning-chip-fg`, `success`, `scrim`, `series-1/2`.
- Dark mode is a `.dark` class on `<html>`, toggled from `settings.ui.theme` ("system" follows the OS).
- **Typography** (reviewed against Google Fonts' web typography guide and Material 3's type roles):
  **Five sizes only** (the owner's request, 2026-10-01): 36, 24, 18, 14 and 12 px. Don't add a sixth; pick the role instead. `body` defaults to `text-sm`, so text without a size class is body text and never the browser's 16 px.

  | Size | Role | Style | Use |
  |---|---|---|---|
  | 36 px | Page title | `font-serif text-4xl leading-[1.2] font-semibold` (Newsreader 600) | the `h1` of each screen |
  | 24 px | Section title | `font-serif text-2xl font-semibold mb-3` (Newsreader 600) | every title above a box: Home charts, "Co dál", "Poslední faktury", settings groups, customer sections; the error screen |
  | 24 px | Big number | Inter 600, `text-2xl`, `tabular-nums` | key numbers, such as a customer's invoice count and revenue |
  | 18 px | Lead | `text-lg` | the Home summary sentence, the invoice total, the logo letter |
  | 14 px | Body | Inter 400, `text-sm` (14/20); 500 for titles inside cards and for buttons | default app text, all buttons (also the `lg` size) |
  | 12 px | Label and caption | Inter 500 or 400, `text-xs` (12/16) | field labels, hints, secondary lines, badges, chart axis and value labels |
  - No negative tracking on the serif. It's already tight.
  - Numbers in tables, invoice numbers, IČ and variable symbols use Inter `tabular-nums`, not monospace. `font-mono` is only for the numbering pattern and raw error text.
  - Chart text is 12 px (`text-xs`).
  - Long help text is capped with `max-w-prose`.
  - Inter uses `ss01` (open digits). Don't turn on `cv11`, because its single-storey "a" clashes with the serif.
  - **Contrast:** see the Ledger theme above. Check new colours before using them for text.
- **Embedded fonts** (`loadUiFonts()`, `FontFace` API): Inter 400 and 600 are TTFs shared with the PDF. Inter 500 and Newsreader 600 (the only serif weight) are UI-only woff2 subsets (latin and latin-ext, for Czech). Every weight used in the UI must be embedded: a missing weight silently falls back to another one (before this, `font-medium` rendered as 400).
- **Corners are small.** The `@theme` radius scale is capped: `rounded-sm` 2px, `rounded`/`rounded-md` 3px, `rounded-lg` 4px, `rounded-xl` 5px, `rounded-2xl` 6px. Don't use `rounded-full` for chips or badges.
- **No shadows.** Cards, popovers, tooltips and buttons are separated by a 1 px `line` border and the surface colour. Card hover darkens the border instead of lifting.
- **Boxes** (the owner's request, 2026-10-01: one pattern everywhere):
  - **The title goes above the box, never inside it.** A `<section>` holds an `h2` section title (`font-serif text-2xl font-semibold mb-3`) and then the box. Actions for the whole box (for example "Zobrazit vše") sit at the right end of the title row. A title can cover a group of boxes, such as the customer's stats and invoice list under "Faktury", or the "Co dál" cards.
  - **The box holds content only:** fields, rows, a chart. Field labels and a chart's legend and Table toggle are content.
  - **No bordered box inside a box.** A group inside a box uses a grey-filled panel (`rounded-lg bg-surface-2 p-4`), as in the exchange-rates panel.
  - **Spacing:** sections are 40 px apart (`space-y-10`); boxes in one group are 20 px apart (`gap-5`, `space-y-5`); side-by-side columns are 24 px apart (`gap-6`); a title sits 12 px above its box (`mb-3`).
  - **Padding:** content boxes use `p-5` (20 px); list boxes have no padding, and their rows use `px-5 py-3`. Only standalone centred dialogs (welcome, onboarding, the error screen) use `p-8`.
  - Boxes without a title are fine when their fields label themselves (the invoice editor).
- **No small caps or all-caps labels** in the UI. Use sentence case; a section title is a serif `h2`.
- Components live in `ui/primitives.tsx`: Button (primary, secondary, ghost, danger), Input, Select, Textarea, InputAffix, Labeled, Field, Checkbox, ErrorSummary, Card, Choice, SettingRow.
- **Forms** follow the design system's Forms section (2026-10-11):
  - **Field box:** the `.control` class in `index.css`, used by inputs, selects, text areas, InputAffix and the customer picker. It draws the "ledger line": `line` on the top and sides and the `input` edge at the bottom. On hover the border is `line-strong`; on focus it is a 2 px `accent` edge (border plus 1 px inset), which also wins over an error. An error shows a `danger` border; disabled fields use `surface-2`. Selects draw their own chevron in `fg-muted`.
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
- **Colors:** focus style. This year is blue (`#0000ff`; dark `#9a9aff`) and last year is pale blue (`#b3b8ff`; dark `#44449e`). Lightness, not hue, separates them, so it's colourblind-safe. The pale bars are deliberately faint (the owner's choice), and the Table view has exact values. Legend text is `fg`.
- **Incomplete periods** (the current month or year) use a 45° striped texture, and the tooltip says "zatím, k {date}" (so far, to {date}). Future months have no bar rather than a zero.
- Only revenue (issued plus paid) in CZK is counted. See [exchange-rates.md](exchange-rates.md) for foreign currencies.
