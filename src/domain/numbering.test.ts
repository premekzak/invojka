import { expect, it } from 'vitest'
import { nextNumber } from './numbering'

it('continues the sequence within the year', () => {
  expect(nextNumber('{YYYY}{NNNN}', '2026-05-10', ['20260007', '20260008', '20250099'])).toBe('20260009')
})
it('starts a new year at 1', () => {
  expect(nextNumber('{YYYY}{NNNN}', '2027-01-02', ['20260008'])).toBe('20270001')
})
it('supports prefixes and short years', () => {
  expect(nextNumber('FV-{YY}-{NNN}', '2026-05-10', ['FV-26-041'])).toBe('FV-26-042')
})
it('with a month in the pattern, restarts the sequence every month', () => {
  const existing = ['2026091', '2026092', '2026101']
  expect(nextNumber('{YYYY}{MM}{N}', '2026-10-11', existing)).toBe('2026102')
  expect(nextNumber('{YY}{MM}{NN}', '2026-11-01', ['261003', '261004'])).toBe('261101')
  expect(nextNumber('{YY}{MM}{NN}', '2026-10-20', ['261003', '261004'])).toBe('261005')
})
