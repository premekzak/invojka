import { describe, expect, it } from 'vitest'
import { newInvoice } from './invoice'
import { firstSteps } from './firstSteps'
import { Customer, SCHEMA_VERSION, Settings } from './schema'

const settings = (ui: Partial<Settings['ui']>, invoice: Partial<Settings['invoice']> = {}) =>
  Settings.parse({ schemaVersion: SCHEMA_VERSION, supplier: { name: 'Zkušební dílna' }, vatMode: 'nonPayer', ui, invoice })
const done = (list: ReturnType<typeof firstSteps>) => list?.filter((s) => s.done).map((s) => s.step)

describe('first steps on Home', () => {
  it('is hidden for someone who never started it or closed it', () => {
    expect(firstSteps(settings({}), [], [])).toBeUndefined()
  })

  it('sees a customer, an issued invoice and the look in the data; the bookmark only when ticked', () => {
    const s = settings({ firstSteps: [] })
    expect(done(firstSteps(s, [], []))).toEqual([])
    const customer = Customer.parse({ id: 'c', name: 'Pekárna Kvásek' })
    const draft = newInvoice(s, [], customer, '2026-10-20')
    expect(done(firstSteps(s, [customer], [draft]))).toEqual(['customer'])
    expect(done(firstSteps(settings({ firstSteps: ['bookmark'] }, { color: 'teal' }), [customer], [{ ...draft, status: 'issued' }])))
      .toBeUndefined()
    expect(done(firstSteps(settings({ firstSteps: ['bookmark'] }), [], []))).toEqual(['bookmark'])
  })
})
