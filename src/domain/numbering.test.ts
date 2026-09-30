import { expect, it } from 'vitest'
import { nextNumber } from './numbering'

it('continues the sequence within the year', () => {
  expect(nextNumber('{YYYY}{NNNN}', 2026, ['20260007', '20260008', '20250099'])).toBe('20260009')
})
it('starts a new year at 1', () => {
  expect(nextNumber('{YYYY}{NNNN}', 2027, ['20260008'])).toBe('20270001')
})
it('supports prefixes and short years', () => {
  expect(nextNumber('FV-{YY}-{NNN}', 2026, ['FV-26-041'])).toBe('FV-26-042')
})
