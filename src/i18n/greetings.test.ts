import { describe, expect, it } from 'vitest'
import cs from './cs'
import en from './en'

// The Home h1 greeting always ends with punctuation (the owner, 2026-10-18): a full stop, or a question mark for a question.
describe.each([['cs', cs], ['en', en]] as const)('%s greetings', (_, texts) => {
  it('end with a full stop or a question mark', () => {
    for (const list of Object.values(texts.home.greetings)) for (const g of list) expect(g, g).toMatch(/[.?]$/)
  })
  // The user may be a woman, a man or a firm, and the app doesn't ask which: no greeting addresses a gender
  // (the owner, 2026-11-27). Mock titles that fit anyone ("Vaše Excelence") are fine.
  it('address nobody as a man or a woman', () => {
    for (const list of Object.values(texts.home.greetings)) for (const g of list) expect(g, g).not.toMatch(/(?<!\p{L})(pane|paní|pán|slečn\p{L}*|Mr|Mrs|Ms|sir|madam)(?!\p{L})/iu)
  })
})
