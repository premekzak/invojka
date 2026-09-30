// Inter, embedded as data URLs so the single-file build works offline. Full TTFs (not web subsets),
// because the PDF engine needs one file that covers both Latin and Czech characters.
import interRegular from '@expo-google-fonts/inter/400Regular/Inter_400Regular.ttf?inline'
import interSemiBold from '@expo-google-fonts/inter/600SemiBold/Inter_600SemiBold.ttf?inline'
// UI-only faces use small woff2 web subsets (latin + latin-ext covers Czech):
// Inter 500 for labels and names (without it `font-medium` falls back to 400),
// Newsreader 600 for all headlines (one serif weight keeps the file small).
import interMediumLatin from '@fontsource/inter/files/inter-latin-500-normal.woff2?inline'
import interMediumLatinExt from '@fontsource/inter/files/inter-latin-ext-500-normal.woff2?inline'
import serifLatin from '@fontsource/newsreader/files/newsreader-latin-600-normal.woff2?inline'
import serifLatinExt from '@fontsource/newsreader/files/newsreader-latin-ext-600-normal.woff2?inline'

export const fonts = { regular: interRegular, semiBold: interSemiBold }

const LATIN = 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD'
const LATIN_EXT = 'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF'

/** Use the same embedded fonts in the app UI (no second copy in CSS), plus the UI-only faces. */
export function loadUiFonts() {
  const subset = (family: string, weight: string, latin: string, latinExt: string) => [
    new FontFace(family, `url(${latin})`, { weight, unicodeRange: LATIN }),
    new FontFace(family, `url(${latinExt})`, { weight, unicodeRange: LATIN_EXT }),
  ]
  const faces = [
    new FontFace('Inter', `url(${fonts.regular})`, { weight: '400' }),
    new FontFace('Inter', `url(${fonts.semiBold})`, { weight: '600' }),
    ...subset('Inter', '500', interMediumLatin, interMediumLatinExt),
    ...subset('Newsreader', '600', serifLatin, serifLatinExt),
  ]
  for (const face of faces) void face.load().then((f) => document.fonts.add(f)).catch(() => {})
}
