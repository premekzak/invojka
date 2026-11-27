# Components and layout

Patterns built on the roles in [tokens.md](tokens.md) and the sizes in [typography.md](typography.md). Class names are Tailwind 4.

## Shapes

- **Small corners.** The radius scale is capped in `theme.css`: `rounded-sm` 2 px, `rounded` and `rounded-md` 3 px, `rounded-lg` 4 px, `rounded-xl` 5 px, `rounded-2xl` 6 px. Status labels use the control radius `rounded` (3 px), not a pill (the owner, 2026-11-11: too round); `rounded-full` only for dots and avatars.
- **Two levels of corner:** controls (`rounded-lg`) and large surfaces one level up (`rounded-2xl` for boxes and dialogs). This kit sits at the square end of the survey ([S2] in [typography.md](typography.md#sources): controls are mostly 6 px elsewhere, surfaces 8–12 px); a project may scale the whole scale up, but keeps the two levels. **Nested corners are concentric:** inner radius = outer radius − the padding between them, never larger than the outer one. So menu items in a `rounded-xl p-1` menu are `rounded-xs`, segments in a `rounded-2xl p-1` track `rounded-sm`.
- **No shadows.** Depth comes from the page being a step darker than the cards.
- **Few borders.** A card has a 1 px hairline drawn outside it (`ring-1 ring-rule`), so nothing inside moves. Borders stay where they do a job: fields, secondary buttons, choice cards, and things floating over content (menus, pickers, tooltips).
- **One gradient by default,** on the footer. Schemes may add dark-to-darker motifs ([schemes.md](schemes.md#motifs-optional)).

## Boxes

- **The title goes above the box, never inside it.** A `<section>` holds an `h2` (section title) and then the box. Actions for the whole box sit at the right end of the title row. One title may cover a group of boxes.
- **The box holds content only:** fields, rows, a chart. A chart's legend and table toggle are content.
- **No bordered box inside a box.** A group inside a card is a filled panel: `rounded-lg bg-surface-2 p-4`.
- A box without a title is fine when its fields label themselves.

## Spacing

| What | Value |
|---|---|
| Page | `px-8 pt-12 pb-8`, content `max-w-6xl` centred; 16 px sides on phones |
| Between sections | 40 px (`space-y-10`) |
| Between boxes in a group | 20 px (`gap-5`, `space-y-5`) |
| Between side-by-side columns | 24 px (`gap-6`) |
| Title to its box | 12 px (`mb-3`) |
| Inside a content box | `px-6 py-5` |
| List boxes | no padding; rows and edge cells use `px-6`, so text lines up with the box edge |
| Dialogs | header, body and footer at 24 px; standalone centred screens (welcome, errors) `p-8` |

## Header

- A full-width row the colour of the page (`header` = `page`), 44 px tall (`h-11`), no band, no line under it: logo and wordmark on the left at the size of the links (a 16 px logo, `font-display` 700 at 14 px), the pages right after them, account or context at the right end (`ml-auto`). All share one middle line.
- **Page links** are plain text, no tabs and no icons: `h-8 px-3 rounded-md text-sm`, 4 px apart, in `font-nav` 500 at the face's own spacing. Inactive: `header-muted`, hover `header-fg`. The current page is `header-fg` at 600 on a `track` rectangle, marked with `aria-current="page"`; fill and weight together, so it isn't told apart by colour alone.
- **Status in the header:** status colours rarely reach 4.5:1 on a tinted band, so show state as an icon in `header-fg` with a tooltip, and an error as a solid `danger` chip with words. Never an icon alone for an error.
- **Phones (below 768 px):** the header keeps one row with the logo, the context and a menu button; the button opens the pages as a list under the header (`surface`, current page `surface-2`); a page change or Escape closes it.

## Footer

`.scheme-footer` with `footer-fg` text, `mt-16`, as wide as the page, at the bottom of short pages too (the layout is a full-height column). Wrap it in `.on-inverse`, so the logo takes its inverse colours.

## Feature block

The one large call to action on a start screen: a solid `accent` block (`.scheme-feature`, hover `accent-deep`), `rounded-2xl px-6 py-5`, a large icon, the name at 18 px semibold and a one-line hint, text in `feature-fg`. One per screen. A scheme can paint it with a motif. **Its colour is light and quiet** (the owner, 2026-11-01: not a loud or very vivid colour of the scheme, and not black either, "je to hrozně výrazné"): a pale tint of the accent with accent text, or a paper shade a step lighter or darker than the page with ink text, flat, through the feature motif; in dark mode a dim step above the cards. Never the bright accent, a vivid second colour or a dark block: it already stands out by its size and shape.

## Buttons

| Variant | Classes |
|---|---|
| primary | `bg-accent text-accent-fg hover:bg-accent-deep` |
| secondary | `bg-surface-2 text-fg border border-line hover:bg-surface-3` |
| ghost | `text-fg-muted hover:bg-tint hover:text-fg` |
| danger | `bg-danger text-danger-fg hover:bg-danger/90` |

Sizes `h-8 px-3`, `h-9 px-4` (the default), `h-12 px-6` (only on a title screen), in line with the surveyed defaults (shadcn 36, Mantine 36, Material UI about 36, Bootstrap 38, Ant Design 32), all 14 px 500, `rounded-lg`, `whitespace-nowrap`, focus `outline-2 outline-offset-2 outline-link`. Flat, never a gradient.

**Order in a row:** the main action first, then secondary ones, then Delete or Archive, then a "more" menu; the group sits at the right of the title row and wraps as a whole (`flex-wrap`).

**Back button** on detail screens: a 36 px secondary icon button; from 1280 px up it hangs in the margin left of the title (`xl:absolute xl:right-full`), so the title lines up with the box below.

## Forms

- **Field box:** the `.control` class (inputs, selects, text areas, affix groups, pickers), in the GitHub manner: a faint `field` fill and a light 1 px `line` edge; hover darkens the edge to `input`; focus turns the field `surface` with a 2 px `link` edge (the border plus an inset ring, so nothing moves); error a 2 px `danger` edge; disabled `surface` with a `line` edge. **A recorded exception:** the resting edge is under the 3:1 non-text contrast (WCAG 1.4.11), and the fill (about 1.05:1 on a white card) is what marks the field; the owner chose it over a 3:1 edge for a lighter form (2026-11-01). A project that needs strict 3:1 uses the `input` edge at rest. Height 36 px (`h-9 px-3`), the same as a default button, so a field and a button in one row line up. Selects draw their own chevron (`.control-select`).
- **Labels** above the field in 14 px 400 `fg-muted`, so the value in the field is the darker text (also the labels of groups such as a row of toggle buttons); a hint or an error under it (error: 12 px 500 `danger` with an alert icon). Wire `id`, `aria-describedby` and `aria-invalid`.
- **Required** fields get `*` in `fg-muted`; optional ones are not marked.
- **Units** sit inside the field (an affix), not in the label.
- **Saving with mistakes:** save buttons stay enabled (disabled only when nothing changed). Pressing one shows the errors and focuses the first wrong field; with more than one error an error summary sits above the form, its items buttons that focus the field. An error appears after a save attempt or after leaving the field, and goes as soon as the value is right.
- **Choices** are cards with `role="radio"` in a `role="radiogroup"`: `border-line`, hover `line-strong`, selected `surface-2` with a 2 px `link` edge.
- **Setting rows:** title and a one-line hint on the left (`max-w-hint`), the control on the right (`sm:w-56`), rows in one card divided by `rule`.

## Steps

A longer task that has a natural order (who, what, how, check) is split into steps: a numbered row under the page title (`Steps`), one box per step, "Back" on the left and the primary "Continue" on the right under the box. The last step is a read-only review of everything, and only there is the button that finishes the task. When the task produces a document, the review shows the document itself, not a summary of it, beside a narrow column with what to fix and the ways back.

- The current step's number sits in an `accent` circle with its name in `fg` at 600; finished steps show a tick, later ones their number, both in `surface-2` with `fg-muted`; a short `line-strong` rule joins them. The row wraps on a phone.
- Every step is a button. A later step opens only when the earlier ones have no mistake; otherwise the step with the mistake opens, shows it and focuses the field.
- Don't repeat the finishing button in the page header; things that are not part of the order (save for later, preview, delete) stay there.
- Each part of the review has an "Edit" link to its step. What blocks finishing is listed in an `error-chip` box, what is only worth a look in a `surface-2` box, each with a link to where it is fixed.

## Tables and lists

- **A page's main table: a pale header band and hairlines.** The header row is 12 px `fg-muted` labels on a `surface-2` band (40 px tall, clipped by the box's corners), every row has a 1 px `rule` line above it, and hover is `tint`; no stripes (the owner's pick of eight looks, 2026-11-27: stripes in a card, a frameless table, row slips, a ledger with ink rules and an inset card all lost). The band is the lightest neutral step, not a colour: a dark or accent header bar would compete with the data.
- **Small tables inside a box** (a breakdown under a chart, a short ranking) keep soft stripes with no lines: even rows `stripe`, a plain header.
- Stripes or lines, never both in one table.
- Amounts, quantities and dates right-aligned with `tabular-nums`, their headers too; text and codes left-aligned.
- **Three levels of text, by weight and lightness, no more:** what the row is and its key figure (the name 500, the figure 600), supporting facts in plain ink (a number, a count), and the rest muted (dates, codes, places, second lines). When most columns are grey nothing leads; when most are dark nothing does either.
- **An amount is a figure with a quiet unit** (`Money`): the digits 600 in ink, the currency 400 muted, so a column of amounts reads as numbers.
- **Cells are top-aligned**, so every first line sits on one line; a second line (a description, an e-mail, 12 px muted, 2 px under) hangs below it instead of pushing the single-line cells to the middle of the row. A label or button in the last cell sits in a box as tall as the first line.
- **One column takes the room that is left** (the name; `w-full max-w-0` with `truncate` and the full text in `title`), so long text is cut where the table ends, not at a fixed width. Header labels never wrap. The first and last columns keep 24 px to the box's edge, the others 16 px each side; header and rows share the padding.
- No empty trailing column: a row action sits in the last cell, shown on hover and on keyboard focus.
- A summary (count, total) closes the table as its last row, under the column it sums.
- On phones tables keep a minimum width (36 rem) and scroll sideways inside their box; the page itself never scrolls sideways.

## Status labels

One style for every state: a soft label (`rounded px-2 py-0.5 text-xs font-medium`) with a 6 px dot and the word. Neutral states on `surface-2` (a hollow dot for a draft, a `line-strong` dot when active, struck through when cancelled), attention on `warning-chip` with `warning` text, done on `success-chip` with `success` text. Labels aren't clickable, so none uses the accent. The word always says it, so grayscale and colour blindness are fine.

## Segmented controls and filters

- A `track` with the chosen segment in `surface`, as wide as its segments; used for view switches (by month, quarter, year). Never stretched across the page: wide segments look empty.
- **Sub-navigation of a page with many sections** (settings categories): from 768 px folder tabs on the top edge of one card: flush with the card's left edge, 44 px tall, the chosen tab in the card's surface with the card's ring on three sides so it runs into the card, its name in `link` and 600 (joined to the card and heavier, not colour alone), the others muted text; the sections inside the card are parted by rules, not cards (no box in a box); a longer description goes in a tooltip. A plain band of tabs gets overlooked: it reads as a filter; a band of tabs alone is easy to overlook (testers, 2026-11-04). On phones, or for a few short views: a segmented control whose `track` runs the full width of the content, the segments at their own width from the left (not sharing the width evenly, which makes them too wide), the chosen one `surface`; 32 px tall, the same segments as the other segmented controls; 20 px under the page title, as a list's filter row. On a narrow screen the segments wrap inside the track.
- **Quiet filters** in a list: one row, 32 px tall, of a search, status tabs as text with counts (the chosen one `fg` with a 2 px `link` underline) and a select. Hide a status with nothing in it unless it is chosen; hide the whole row of tabs when only one status exists.
- **One row of controls on a list screen:** the title stands alone; under it the filters on the left and, at the right end, the main action (`size="sm"`, so the row stays 32 px) and a "more" menu with the rarer actions (`src/ui/MoreMenu.tsx`). Never a row of actions in the title row and a row of filters under it. When the row is too narrow, the action group wraps as a whole to the right.

## Links

Text links are underlined (`underline underline-offset-2 decoration-line-strong`, darker on hover), so colour alone doesn't mark them.

## Charts

- Hand-built SVG. Columns at most 24 px wide, a 2 px rounded top, square at the baseline, 2 px gaps; light 1 px gridlines in `line`, the baseline in `fg-subtle`.
- Two series: `series-1` (this period) and `series-2` (the one before), told apart by lightness. A legend only with two or more series.
- Selective value labels (the best and the current period), a tooltip per band with the whole band as the hover target, and a **table view** with the exact values.
- An incomplete period (this month) has a 45° striped texture and says "so far" in its tooltip; future periods have no bar, not a zero.
- Parts of a whole (a donut): `cat-1` … `cat-3` with 2 px gaps, the remainder as the bare `surface-3` track, each part also in a labelled row with its value.
- Chart text is 12 px.

## Motion

Short rise on page and section entry (`animate-rise`, 0.35 s). No page reloads.

## Modals and floating things

Menus and pickers float on `surface` with a `line` border and no shadow; Escape or a click outside closes them. Modals sit on the `scrim` at 50 %; in React render them through a portal to `document.body`, because an animated (transformed) ancestor traps `position: fixed`.

## Phones

Below 768 px: a grid marked `mobile-stack` becomes one column; column headers above form rows hide; pages use 16 px sides. Check every screen at 390 px for sideways scroll.
