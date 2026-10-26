import { describe, expect, it } from 'vitest'
import { AGENT_GUIDE } from './agentGuide'
import { Customer, Invoice, Settings } from './schema'

// A field added to the schema without a word in the guide would leave agents guessing what it means.
describe('agent guide', () => {
  it.each([
    ['Invoice', Object.keys(Invoice.shape)],
    ['Customer', Object.keys(Customer.shape)],
    ['Settings', Object.keys(Settings.shape).filter((k) => k !== 'schemaVersion')],
  ])('names every %s field', (_, keys) => {
    expect(keys.filter((k) => !AGENT_GUIDE.includes(`\`${k}\``))).toEqual([])
  })
})
