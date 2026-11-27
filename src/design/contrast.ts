// The scheme contract and its contrast pairs, read straight from a scheme's CSS. Used by schemes.test.ts; not part of the app bundle.

/** Every slot a scheme defines, in light and in dark. The roles that read them are in theme.css. */
export const SLOTS = [
  'page', 'card', 'stripe', 'fill', 'rule', 'line', 'field', 'edge', 'muted', 'ink', 'tint', 'track',
  'action', 'on-action', 'action-deep', 'link', 'on-feature',
  'danger', 'on-danger', 'success', 'success-chip', 'warning', 'warning-chip',
  'series-1', 'series-2', 'cat-1', 'cat-2', 'cat-3',
  'brand', 'on-brand', 'brand-dot', 'brand-inverse', 'on-brand-inverse', 'brand-dot-inverse',
  'header', 'on-header', 'on-header-muted', 'header-active', 'header-hover',
  'footer', 'footer-deep', 'on-footer', 'on-footer-muted',
] as const
export type Slot = (typeof SLOTS)[number]

/** Optional motif hooks (see theme.css). A gradient here is checked at each of its colours against the text on it. */
export const MOTIFS = ['header-image', 'feature-image', 'feature-image-hover', 'footer-image', 'tab-edge', 'header-pad', 'series-1-end', 'series-2-end', 'error', 'error-chip'] as const

/** [text or mark, background, minimum ratio]. 4.5 for text, 3 for field edges and chart marks (WCAG 1.4.3 and 1.4.11). */
type Colour = Slot | (typeof MOTIFS)[number]
export const PAIRS: readonly (readonly [Colour, Colour, number])[] = [
  ...(['page', 'card', 'fill', 'stripe', 'tint', 'track'] as const).flatMap((bg) => [['ink', bg, 4.5], ['muted', bg, 4.5]] as const),
  ['muted', 'line', 4.5],
  ['link', 'page', 4.5], ['link', 'card', 4.5], ['link', 'fill', 4.5],
  ['on-action', 'action', 4.5], ['on-action', 'action-deep', 4.5],
  ['on-header', 'header', 4.5], ['on-header-muted', 'header', 4.5], ['on-header', 'header-active', 4.5],
  ['on-footer', 'footer', 4.5], ['on-footer-muted', 'footer', 4.5], ['on-footer', 'footer-deep', 4.5], ['on-footer-muted', 'footer-deep', 4.5],
  ['danger', 'page', 4.5], ['danger', 'card', 4.5], ['on-danger', 'danger', 4.5],
  ['warning', 'page', 4.5], ['warning', 'card', 4.5], ['warning', 'fill', 4.5], ['warning', 'warning-chip', 4.5],
  ['success', 'card', 4.5], ['success', 'success-chip', 4.5],
  // Optional: the error box (checked only when a scheme sets them; otherwise it uses the warning pair).
  ['error', 'error-chip', 4.5], ['error', 'card', 4.5],
  ['edge', 'field', 3], ['series-1', 'card', 3],
  // Not text: a hovered row must visibly differ from a plain and a striped one.
  ['tint', 'card', 1.1], ['tint', 'stripe', 1.05],
  // The logo square against the bar and the footer it sits on, as any graphic element.
  ['brand', 'header', 3], ['brand-inverse', 'footer', 3],
]

/** Motif → the slot of the text on it. */
export const MOTIF_TEXT = { 'header-image': 'on-header', 'feature-image': 'on-feature', 'feature-image-hover': 'on-feature', 'footer-image': 'on-footer' } as const

export type Mode = 'light' | 'dark'
/** A scheme file's declarations per mode, as written (`#rrggbb`, a gradient, a color-mix…). */
export type SchemeVars = Record<Mode, Record<string, string>>

export function parseScheme(css: string): SchemeVars {
  const out: SchemeVars = { light: {}, dark: {} }
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, '')
  for (const [, selector, body] of clean.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const mode: Mode = selector!.includes('.dark') ? 'dark' : 'light'
    for (const [, name, value] of body!.matchAll(/--scheme-([a-z0-9-]+):\s*([^;]+);/g)) out[mode][name!] = value!.trim()
  }
  return out
}

/** The hex colours in a value: one for a plain colour, several for a gradient; none when it has transparent parts or no hex. */
export function colours(value: string | undefined): string[] {
  if (!value || /transparent|var\(/.test(value)) return []
  return value.match(/#[0-9a-f]{6}\b/gi) ?? []
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!
}

export function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p)
  return (x! + 0.05) / (y! + 0.05)
}

/** Every pair below its minimum, as readable lines ("light: muted on track 4.21 < 4.5"). */
export function failures(vars: SchemeVars, pairs = PAIRS): string[] {
  const out: string[] = []
  for (const mode of ['light', 'dark'] as const) {
    const v = vars[mode]
    const check = (fg: string, bg: string, min: number, label: string) => {
      const ratio = contrast(fg, bg)
      if (ratio < min - 0.005) out.push(`${mode}: ${label} ${ratio.toFixed(2)} < ${min}`)
    }
    for (const [fg, bg, min] of pairs) {
      const [f] = colours(v[fg]), [b] = colours(v[bg])
      if (f && b) check(f, b, min, `${fg} on ${bg}`)
    }
    for (const [motif, text] of Object.entries(MOTIF_TEXT)) {
      const [f] = colours(v[text])
      if (f) for (const b of colours(v[motif])) check(f, b, 4.5, `${text} on ${motif} ${b}`)
    }
  }
  return out
}
