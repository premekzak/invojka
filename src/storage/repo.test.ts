import { describe, expect, it } from 'vitest'
import { SCHEMA_VERSION, Settings } from '@/domain/schema'
import { ConflictError } from './adapter'
import { MemoryAdapter } from './memory'
import { DataFileError, loadAll, saveFile } from './repo'

const settings = Settings.parse({
  schemaVersion: SCHEMA_VERSION,
  supplier: { name: 'Test s.r.o.', ic: '01234567' },
  vatMode: 'nonPayer',
})

describe('repo', () => {
  it('loads an empty folder', async () => {
    expect(await loadAll(new MemoryAdapter())).toEqual({ settings: undefined, customers: [], invoices: [], stamps: {} })
  })

  it('round-trips settings and keeps IČ leading zeros', async () => {
    const a = new MemoryAdapter()
    await saveFile(a, 'settings', settings, undefined)
    const loaded = await loadAll(a)
    expect(loaded.settings?.supplier.ic).toBe('01234567')
    expect(loaded.settings?.defaults.dueDays).toBe(14)
  })

  it('refuses to overwrite a file changed elsewhere', async () => {
    const a = new MemoryAdapter()
    const stamp = await saveFile(a, 'customers', [], undefined)
    a.touch('customers.json', '{"schemaVersion":1,"customers":[]}')
    await expect(saveFile(a, 'customers', [], stamp)).rejects.toBeInstanceOf(ConflictError)
    await expect(saveFile(a, 'customers', [], stamp, true)).resolves.toBeTypeOf('number')
  })

  it('reports broken files with the file name and path', async () => {
    const a = new MemoryAdapter()
    a.touch('invoices.json', '{"schemaVersion":1,"invoices":[{"id":1}]}')
    await expect(loadAll(a)).rejects.toThrow(DataFileError)
    await expect(loadAll(a)).rejects.toThrow(/invoices\.json: invoices\.0\.id/)
  })

  it('treats an empty file left by an interrupted save as missing', async () => {
    const a = new MemoryAdapter()
    a.touch('settings.json', '')
    const loaded = await loadAll(a)
    expect(loaded.settings).toBeUndefined()
    // The next save must not be mistaken for a conflict with the empty file.
    await expect(saveFile(a, 'settings', settings, loaded.stamps.settings)).resolves.toBeTypeOf('number')
  })

  it('rejects files from a newer app version', async () => {
    const a = new MemoryAdapter()
    a.touch('settings.json', '{"schemaVersion":99}')
    await expect(loadAll(a)).rejects.toThrow(/newer version/)
  })
})
