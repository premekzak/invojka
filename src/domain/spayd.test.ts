import { expect, it } from 'vitest'
import { czechIban, spayd } from './spayd'

it('builds a Czech IBAN', () => {
  // Example from ČNB documentation: 19-2000145399/0800
  expect(czechIban('19-2000145399', '0800')).toBe('CZ6508000000192000145399')
})
it('builds a SPAYD string', () => {
  expect(spayd({ iban: 'CZ65 0800 0000 1920 0014 5399', amount: 1450000, currency: 'CZK', vs: '20260008', message: 'Faktura č. 20260008', dueDate: '2026-09-20' }))
    .toBe('SPD*1.0*ACC:CZ6508000000192000145399*AM:14500.00*CC:CZK*X-VS:20260008*DT:20260920*MSG:Faktura c. 20260008')
})
