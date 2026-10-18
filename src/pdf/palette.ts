import type { INVOICE_COLORS } from '@/domain/schema'

// Every colour the PDFs use, in one place, with no PDF library imported, so Settings can show the same swatches.
// The PDF stays neutral by the owner's choice: warm ink greys like the app, an accent only when one is chosen.
// Grayscale phase (2026-10-01): the cancelled and paid stamps are ink too; they were #a8322b and #37703a.

export const PDF_COLORS = {
  ink: '#1f1c18',
  muted: '#5c554c',
  line: '#e4e0d7',
  box: '#f5f3ee',
  paper: '#ffffff',
  danger: '#1f1c18',
  success: '#1f1c18',
  /**
   * Optional accent for the title and the "to pay" box (Settings → Vzhled faktury), dark enough for white text on it
   * (each at least 4.5:1 on white); 'neutral' keeps the ink, the owner's original choice.
   */
  accents: {
    neutral: '#1f1c18',
    blue: '#1d4ed8',
    teal: '#0f766e',
    green: '#15803d',
    wine: '#9f1239',
    orange: '#c2410c',
  } satisfies Record<(typeof INVOICE_COLORS)[number], string>,
}
