import { beforeEach, describe, expect, it } from 'vitest'
import { SCHEMA_VERSION, Settings } from '@/domain/schema'
import { MemoryAdapter } from '@/storage/memory'
import { useStore } from './store'

const settings = Settings.parse({ schemaVersion: SCHEMA_VERSION, supplier: { name: 'Test' }, vatMode: 'nonPayer' })
const customer = {
  id: 'c1', name: 'Acme', ic: '', dic: '', address: { street: '', zip: '', city: '', country: '' },
  email: '', cc: [], phone: '', web: '', contactName: '', reverseCharge: false, note: '', archived: false,
}

describe('store', () => {
  let a: MemoryAdapter
  beforeEach(async () => {
    a = new MemoryAdapter()
    await useStore.getState().open(a)
  })

  it('goes to onboarding for an empty folder, then saves', async () => {
    expect(useStore.getState().phase.kind).toBe('onboarding')
    useStore.getState().saveSettings(settings)
    useStore.getState().upsertCustomer(customer)
    expect(useStore.getState().saveState).toBe('pending')
    await useStore.getState().flush()
    expect(useStore.getState().saveState).toBe('saved')
    expect(JSON.parse(a.files.get('customers.json')!.text).customers[0].name).toBe('Acme')
    await useStore.getState().reload()
    expect(useStore.getState().phase.kind).toBe('ready')
  })

  it('detects a conflict and can overwrite on request', async () => {
    useStore.getState().upsertCustomer(customer)
    await useStore.getState().flush()
    a.touch('customers.json', '{"schemaVersion":1,"customers":[]}')
    useStore.getState().upsertCustomer({ ...customer, name: 'Acme 2' })
    await useStore.getState().flush()
    expect(useStore.getState()).toMatchObject({ saveState: 'conflict', conflictFile: 'customers' })
    await useStore.getState().forceSave()
    expect(useStore.getState().saveState).toBe('saved')
    expect(a.files.get('customers.json')!.text).toContain('Acme 2')
  })

  it('demo mode shows anonymized data, never writes the real folder, and restores it on exit', async () => {
    const st = () => useStore.getState()
    st().saveSettings(settings)
    st().upsertCustomer(customer)
    await st().flush()
    const before = JSON.stringify([...a.files])

    await st().enterDemo('Demo')
    expect(st().demo).toBe(true)
    expect(st().adapter).not.toBe(a)
    expect(st().customers[0]!.name).not.toBe('Acme')
    st().upsertCustomer({ ...st().customers[0]!, note: 'changed in demo' })
    await st().flush()
    expect(JSON.stringify([...a.files])).toBe(before)

    await st().exitDemo()
    expect(st()).toMatchObject({ demo: false, adapter: a })
    expect(st().customers[0]!.name).toBe('Acme')
    expect(st().customers[0]!.note).toBe('')
  })

  it('saves pending changes to the old business before switching to another', async () => {
    useStore.getState().saveSettings(settings)
    useStore.getState().upsertCustomer(customer)
    const b = new MemoryAdapter('second')
    await useStore.getState().switchTo(b)
    // The first business got its last edit; the second starts empty, with its own onboarding.
    expect(JSON.parse(a.files.get('customers.json')!.text).customers[0].name).toBe('Acme')
    expect(useStore.getState()).toMatchObject({ adapter: b, previous: a, customers: [], phase: { kind: 'onboarding' } })
    expect(b.files.size).toBe(0)
  })

  it('does not switch businesses in demo mode', async () => {
    useStore.getState().saveSettings(settings)
    await useStore.getState().flush()
    await useStore.getState().reload()
    await useStore.getState().enterDemo('demo')
    await expect(useStore.getState().switchTo(new MemoryAdapter('second'))).rejects.toThrow('demo')
    await useStore.getState().exitDemo()
    expect(useStore.getState().adapter).toBe(a)
  })
})
