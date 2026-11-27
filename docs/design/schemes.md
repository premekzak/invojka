# Colour schemes

A scheme is one CSS file in `src/design/schemes/` that gives every slot of the contract a value, in light and dark. Components never change; the roles in [tokens.md](tokens.md) read the slots.

```css
@layer base {
  :root[data-scheme="zl-uredni"] { --scheme-page: #f6efd6; --scheme-card: #ffffff; … }
  :root.dark[data-scheme="zl-uredni"] { … }
}
```

The default scheme (`nv-terakota.css`) uses `:root:where(:not([data-scheme]), [data-scheme="nv-terakota"])`, so it applies with no attribute at all and never competes with another scheme's selectors.

## The contract

Every slot is required in both modes (`SLOTS` in `src/design/contrast.ts`; the test lists any that are missing). The contrast column is what the test checks (`PAIRS`); 4.5 is text, 3 is a field edge or a chart mark.

| Slot | Role | Must reach |
|---|---|---|
| `page` | `bg` | |
| `card` | `surface` | |
| `stripe` | `stripe` | |
| `fill` | `surface-2` | |
| `rule` | `rule` | |
| `line` | `line`, `surface-3` | |
| `field` | `field` | |
| `edge` | `input` | 3 on field |
| `muted` | `fg-muted`, `fg-subtle`, `fg-faint`, `line-strong` | 4.5 on page, card, fill, stripe, tint, track, line |
| `ink` | `fg`, `title`, `scrim` | 4.5 on page, card, fill, stripe, tint, track |
| `tint` | `tint` | 1.1 on card and 1.05 on stripe (not text: a hovered row must show) |
| `track` | `track` | |
| `action`, `on-action`, `action-deep` | `accent`, `accent-fg`, `accent-deep` | on-action 4.5 on action and action-deep |
| `link` | `link` | 4.5 on page, card, fill |
| `on-feature` | `feature-fg` | 4.5 on every colour of the feature motif, or on `action` without one |
| `danger`, `on-danger` | `danger`, `danger-fg` | danger 4.5 on page and card; on-danger 4.5 on danger |
| `warning`, `warning-chip` | `warning`, `warning-chip`, `warning-chip-fg` | warning 4.5 on page, card, fill, warning-chip |
| `success`, `success-chip` | `success`, `success-chip` | success 4.5 on card and success-chip |
| `series-1`, `series-2` | `series-1`, `series-2` | series-1 3 on card; series-2 is a pale companion, exempt |
| `cat-1` … `cat-3` | `cat-1` … `cat-3` | none: every part also has a labelled row |
| `brand`, `on-brand`, `brand-dot` | `brand`, `brand-fg`, `brand-dot` | brand 3 on header |
| `brand-inverse`, `on-brand-inverse`, `brand-dot-inverse` | the brand roles inside `.on-inverse` | brand-inverse 3 on footer |
| `header`, `on-header`, `on-header-muted` | `header`, `header-fg`, `header-muted` | both 4.5 on header, and on every colour of the header motif |
| `header-active`, `header-hover` | `header-active`, `header-hover` | |
| `footer`, `footer-deep`, `on-footer`, `on-footer-muted` | the footer roles | both texts 4.5 on footer and footer-deep |

### Motifs (optional)

| Variable | Effect |
|---|---|
| `--scheme-header-image` (+ `-repeat`, `-position`, `-size`) | paints the header (`.scheme-header`); unused while the header is the page colour |
| `--scheme-header-pad` | a strip under the header row, so a motif along the bottom edge isn't hidden |
| `--scheme-feature-image`, `--scheme-feature-image-hover` | paints the feature block (`.scheme-feature`) |
| `--scheme-footer-image` | replaces the footer's default `footer` → `footer-deep` gradient |
| `--scheme-series-1-end`, `--scheme-series-2-end` | where a chart series' bars fade to: the bar chart fills each bar from this colour at the top to the series colour at the baseline (a slight diagonal); the legend swatch follows. Without them the bars are flat. Keep it a lighter step of the same hue (or a few degrees off) so series still differ in lightness. About 0.04 L is enough for depth; a fade into another colour (0.15 L and a hue shift) was "moc výrazné" (the owner, 2026-11-27) |
| `--scheme-error`, `--scheme-error-chip` | the text and pale fill of the box that lists a form's mistakes (`error`, `error-chip`); without them it uses `warning` on `warning-chip`. Error text 4.5 on the chip and on card |

Text on a motif must reach 4.5:1 at every point. The test checks every hex colour of a gradient; a motif with transparent parts (a line) isn't checked.

## Making a scheme

1. **Brief.** Put a brief in `schemes/<name>/zadani.md` and any reference images next to it. Only the brief is committed: images may be under copyright.
2. **Structure first.** Decide the shares before the hues: how much of the page is white, grey, dark and accent; where the dark sits (header, feature block, footer, buttons); how the greys step (even, deep, none, cool). Two schemes that differ only in hue look alike. Build variants that differ in structure, the shares of colour and the greys. The owner, 2026-10-22: "liší se vlastně jen základní barvou" ("they really differ only in the base colour").
3. **Build the ramp in OKLCH:** neutrals in one hue at low chroma (C ≤ 0.035, or 0 for pure greys), the hue moving at most about 5° from ink to white and always the same way, chroma lowest at both ends, lightness steps for page, card, stripe, fill, rule, line at least about 0.02 L apart, and page and card a step apart so a box isn't held up by its ring alone (Radix, IBM Carbon, Matthew Ström, read 2026-10-31; the `ui` skill's colour page has the sources); `tint` at L ≈ 0.97 C ≈ 0.02 in the neutrals' hue; `track` at L ≈ 0.90 in the header's hue.
4. **One accent.** If it is too light for text (neon, cyan, amber), give it a dark label (`on-action`) and a darker `link`. Keep status hues apart from the accent (move success or warning away from it) and status chips pale (C ≤ 0.04). **Status colours take the scheme's temperature:** in a warm scheme the red leans to brick and the green to olive, in a cool one to crimson and teal, at a lower chroma than a picker's red and green, so they read as part of the palette (the owner, 2026-11-27).
5. **Gradients diagonal and barely visible:** 135° (top left to bottom right), falling about 0.025 L in the same hue, on dark areas only: header, feature block, footer. Light areas, light tiles and buttons stay flat. The owner, 2026-10-26: "jen z tmavé do ještě tmavší. Světlé gradienty nejsou hezké" (0.09 L was too strong); 2026-11-01: "gradienty spíše přes uhlopříčku než zhora dolů, ale velmi jemné, aby skoro nebyly poznat". Also:
   - **Headers are the safest place** for a gradient ([Designmodo](https://designmodo.com/gradients/), read 2026-10-28). That source also shows gradients on whole pages, sections and nav hovers, but as trends for marketing sites, not for an app.
   - **Keep the flat colour underneath** (`background-color` set to the gradient's first step), so the area still has its colour and contrast if the image doesn't paint ([Designmodo]).
   - **No gradient text, and no moving or scroll-following gradients.** Designmodo calls gradient text imperfect and leaves motion to agencies and portfolios: "design aesthetics should never come before the user experience."
6. **Never a rule under the header** (the owner, 2026-11-04: "bottom border pod navigací nevypadá nikdy dobře"). **Header = page by default:** set `header` to the page, `on-header` to the ink, `on-header-muted` to the muted grey, `header-hover` to the fill and `header-active` (the fill of the current page link) to `track`; check that it stands out from the page. **A coloured bar** is allowed when the scheme is built around it: then `header-active` is a step of the bar's own hue (lighter on a light bar, lighter on a dark one too), and `on-header` must reach 4.5 on `header`, `header-active` and `header-hover`.
7. **Dark mode** is designed, not inverted: near-black neutrals with lighter cards, softer accents so they don't vibrate.
8. **Check.** `npx vitest run src/design` (every slot, every pair). Then look at it in the app on real content, light and dark, before wiring it in.
9. **Wire it in** (app side): import the file in the app's CSS and add it to the app's list of schemes with a name in every language (Invojka: [../ui.md](../ui.md#schemes-in-the-app)).

**Never rename or remove a scheme id without a fallback:** the id is saved in the user's data. The app should turn an unknown saved id into the default rather than fail.

### Recorded exceptions

So nobody "fixes" them:
- A light accent (neon, cyan, amber, mandarin) has no 3:1 edge on white; its dark label carries it, as for any light-fill action.
- A white scheme's page may equal its cards; the cards' `rule` ring parts them.
- `cat-1` … `cat-3` and `series-2` may be below 3:1; the values are always labelled, and charts have a table view.
- **A scheme may break a rule on purpose** (the owner, 2026-10-31: "občas můžeš nějaké pravidlo porušit, když k tomu budeš mít důvod"). Its file then says, under "RULE BROKEN", which rule and why, and contrast still passes. None of the current schemes does.

## The schemes

**Terakota (`nv-terakota`) is the default since 2026-11-20;** Jasný oblak (`jasny-oblak`) was from 2026-11-04, Protokol from 2026-11-01. On a blue bar the logo is a white square with blue letters; the tests check `brand` against `header` and `brand-inverse` against `footer` at 3:1. **On 2026-11-01 the owner kept only Warm paper and Úřední** and the rest are its variations: a CSS blue `#0000ff` bar with white text over a paper page and white cards, blue buttons and links, a pale blue row hover (the owner: "hover u tabulek může být modrý"). They differ in the paper (tone, lightness, chroma, ruling), the footer (paper or blue) and the tile. The "Nová faktura" tile is light and quiet, flat: a pale blue with blue text or a paper shade with ink text, never black or vivid (the owner: black "je to hrozně výrazné"). `#0000ff` is used exactly in light mode (white text 8.6:1); in dark mode text, buttons and charts take a lighter step of its hue (L 0.70) and the tile a dim blue a step above the cards. The blue bar and footer carry a 135° gradient falling 0.025 L, barely visible (rule 5).

| Id | Name | Structure | Light | Dark |
|---|---|---|---|---|
| `warm` | Teplý papír | one hue family | a white page and header, white cards, warm greys, espresso ink; burnt-orange buttons with white text, a darker orange `link`; charts orange and pale peach; ochre warnings, crimson errors; an espresso footer and a pale apricot "new" tile with espresso text | a warm near-black, an espresso header |
| `zl-uredni` | Úřední | the base | a #0000ff bar with white text over a yellowed paper (C 0.034, h 90); a pale blue tile with blue text, a darker yellowed footer | warm near-black greys, a deep blue bar, lighter blue actions |
| `ur-formular` | Formulář | framed in blue | a paler ivory paper; a tile a step darker than the paper with ink text; a #0000ff footer | warm near-black greys, a deep blue bar, lighter blue actions |
| `ur-kolek` | Kolek | grey paper, a blue footer | a grey-beige recycled paper; a pale blue tile, a #0000ff footer | warm near-black greys, a deep blue bar, lighter blue actions |
| `ur-spis` | Spis | a deep folder paper, a light sheet | a manila-folder paper (L 0.93, C 0.05); a tile lighter than the page (a cream sheet) with ink text | warm near-black greys, a deep blue bar, lighter blue actions |
| `ur-obalka` | Obálka | paper in the blue's hue | a blue-grey envelope paper (h 250); a pale blue tile, a #0000ff footer | warm near-black greys, a deep blue bar, lighter blue actions |
| `ur-protokol` | Protokol | blue ruling | the yellowed paper with pale blue box rules and lines as on a printed form; a pale blue tile | warm near-black greys, a deep blue bar, lighter blue actions |
| `ur-archiv` | Archiv | a deeper yellow, a blue footer | an older yellow paper (L 0.935, C 0.045); a pale yellow tile lighter than the page; a #0000ff footer | warm near-black greys, a deep blue bar, lighter blue actions |
| `ur-svetla` | Světlá lišta | the quietest bar | a pale blue bar with #0000ff text instead of a solid one; a tile a step darker than the paper | warm near-black greys, a deep blue bar, lighter blue actions |
| `ob-seda` | Jasný oblak, šedá lišta | white, a light grey bar | neutral greys, a light grey bar a step off the white page (no rule), the current page a white tab; a vivid blue #075ffe for actions, the logo and charts, a vivid orange second series; a pale blue tile | neutral near-black, lighter blue |
| `ob-g-lista` | … gradient v liště | the same, gradient bar | a faint 135° grey gradient in the bar only | the same |
| `ob-g-dlazdice` | … gradient v dlaždici | the same, gradient tile | a faint 135° blue gradient in the "new" tile only | the same |
| `ob-g-ramec` | … gradient v liště a patičce | the same, framed | one faint 135° grey gradient in the bar and the footer | the same |
| `ob-g-nadech` | … modrý nádech | the same, blue tinge | the bar drifts from grey into a breath of blue (135°) | the same |
| `ob-g-oba` | … lišta a dlaždice | the same, bar and tile | a faint grey gradient in the bar, a faint blue one in the tile | the same |
| `ob-g-grafy` | … gradient v grafech | the same, gradient charts | the chart bars fade from a lighter step of their hue at the top | the same |
| `jasny-oblak` | Jasný oblak | Bright cloud with hue-shift charts (the default 2026-11-04 to 2026-11-20) | cool greys in many steps (one hue, very low chroma): a faint grey page under white cards, a blue-grey bar, a deeper footer; one colour, blue, split into shades by role (buttons, links, logo, tile, every chart; no second hue); bars fade to a lighter blue; red errors and warnings | the same |
| `ob-gs-more` | … moře | hue-shift charts, further | bars drift to a clear cyan (blue) and a warm yellow (orange); a faint grey gradient in the bar | the same |
| `ob-gs-soumrak` | … soumrak | hue-shift charts, the other way | bars drift to a soft violet (blue) and coral pink (orange); a faint grey gradient in the bar | the same |
| `ob-gs-dlazdice` | … grafy a dlaždice | hue-shift charts + tile | cyan and yellow tops, a faint blue gradient in the tile, a grey one in the bar | the same |
| `ob-gs-nadech` | … grafy a modrý nádech | hue-shift charts + blue tinge | cyan and yellow tops, the bar drifting into a breath of blue | the same |
| `ob-gs-ramec` | … grafy a rámeček | hue-shift charts + frame | cyan and yellow tops, one faint grey gradient in the bar and footer, a gradient tile | the same |
| `nv-fialka` | Fialka | a world: violet | a white page, lilac-tinted greys, electric violet actions and logo, a pink companion; bars violet → magenta, pink → peach | near-black lilac greys |
| `nv-les` | Les | a world: forest | a green-white page, moss greys, fir green actions and logo, a moss companion, a dark forest footer; bars green → teal, moss → lime | near-black moss greys |
| `nv-terakota` | Terakota | the default; a light accent | light vivid apricot buttons with a dark brown label (hover more saturated), rust links and main chart series, a dark brown logo with an apricot letter; a white page, warm greys, a warm grey bar; a pale apricot tile; bars rust and apricot, each only a small step lighter at the top (since 2026-11-27; a fade into the next hue before); brick-red warnings and an olive-green "paid", both in the warm family (apricot since 2026-11-20; cream, brown terracotta and olive before) | apricot buttons, warm near-black |
| `nv-led` | Led | a world: ice | a blue-white page, icy greys, glacier teal actions and logo, a periwinkle companion, a dark glacier footer; bars teal → mint, periwinkle → lilac | near-black ice greys |
| `ze-salvej` | Šalvěj a meruňka | trial 2026-11-26: green + one companion; the quietest | a white page, faintly green greys, a grey-green bar; muted sage buttons with a white label, sage logo; apricot only in the pale "new" tile, the second chart series and the logo dot; bars sage → teal, apricot → pale yellow; red warnings, a teal success | near-black green greys, a lighter sage |
| `ze-mata` | Máta a švestka | trial: the bright pair | light vivid mint buttons with a dark green label (hover more saturated), deeper green links and main series; the bar is the page; a plum logo, a dark plum footer, mauve second series; a pale mint tile | mint buttons, a plum-black footer |
| `ze-eukalyptus` | Eukalyptus a okr | trial: a tinted page | a pale eucalyptus page (L 0.966, C 0.012) under white cards, bar and footer the colour of the page; deep eucalyptus buttons and logo; a pale ochre tile, ochre second series | near-black eucalyptus greys |
| `ze-mech` | Mech a levandule | trial: green in the frame | a pale moss-green bar (current page a lighter step of it) and footer round a white page with near-neutral greys; moss buttons and logo; a lavender tile, row hover and second series | a bar with a breath of green, a dim lavender tile |
| `ze-jedle` | Jedle a nebe | trial: a near-black accent | fir buttons and logo at L 0.33 on white with cool green-grey steps and a light grey bar; fir green links; a sky blue tile and second series, bars fir → teal | near-black cool greys, a lighter fir |
| `ze-louka` | Louka | trial, round 2 (green takes more of the screen): one hue in many shades | a faint grey-green page under white cards, a green-grey bar, a deeper footer; emerald buttons, deeper green links, a dark green logo, a pale green "new" tile; both chart series green, told apart by lightness; no second hue | near-black green greys |
| `ze-hvozd` | Hvozd a zlato | trial: a coloured bar | a solid forest-green bar with white text (current page a lighter step, the logo a white square with a green letter) over a green-tinted paper (C 0.02) under white cards; green buttons, a pale green tile, a footer of darker paper; gold only in the second chart series | a dim green bar, lighter green actions |
| `ze-pistacie` | Pistácie a kakao | trial: a clearly green page | a pistachio page (L 0.955, C 0.032) under white cards, the bar the colour of the page, a deeper pistachio tile; leaf-green buttons; a cocoa logo, a dark cocoa footer, tan second series | near-black green greys, a cocoa-black footer |
| `ze-limetka` | Limetka | trial: the bright pair, green only | light vivid lime buttons with a forest label (hover more saturated); forest-green ink, logo and dark footer; green-tinted greys, a pale green bar, a pale lime tile; bars green → lime, the second series a pale lime | lime buttons, a forest-black footer |
| `ze-oliva` | Oliva a terakota | trial: the warm side of green | olive-tinted greys, an olive-grey bar, a light footer; olive green buttons and logo; bars olive → yellow-green; a pale terracotta tile and second series | near-black olive greys |
