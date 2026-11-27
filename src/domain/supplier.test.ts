import { describe, expect, it } from 'vitest'
import { SCHEMA_VERSION, Settings } from './schema'
import { missingSupplierDetails } from './supplier'

const bare = Settings.parse({ schemaVersion: SCHEMA_VERSION, supplier: { name: 'Me' }, vatMode: 'nonPayer' })
const full = Settings.parse({
  schemaVersion: SCHEMA_VERSION, vatMode: 'nonPayer',
  supplier: { name: 'Me', ic: '12345678', address: { street: 'Dlouhá 1', city: 'Praha' }, bank: { iban: 'CZ6508000000192000145399' } },
})

describe('missingSupplierDetails', () => {
  it('lists what is missing; the account only for a bank transfer', () => {
    expect(missingSupplierDetails(bare)).toEqual(['ic', 'street', 'city'])
    expect(missingSupplierDetails(bare, 'bank')).toEqual(['ic', 'street', 'city', 'account'])
    expect(missingSupplierDetails(bare, 'cash')).toEqual(['ic', 'street', 'city'])
  })
  it('is empty for complete details; an IBAN alone is an account', () => {
    expect(missingSupplierDetails(full, 'bank')).toEqual([])
  })
})
