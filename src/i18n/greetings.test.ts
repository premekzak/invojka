import { describe, expect, it } from 'vitest'
import cs from './cs'
import en from './en'

// The Home h1 greeting always ends with punctuation (the owner, 2026-10-18): a full stop, or a question mark for a question.
describe.each([['cs', cs], ['en', en]] as const)('%s greetings', (_, texts) => {
  it('end with a full stop or a question mark', () => {
    for (const list of Object.values(texts.home.greetings)) for (const g of list) expect(g, g).toMatch(/[.?]$/)
  })
})
