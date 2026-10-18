import { anonymize } from '@/domain/demo'
import { SCHEMA_VERSION, Settings } from '@/domain/schema'
import { useStore } from '@/state/store'
import { MemoryAdapter } from '@/storage/memory'
import { showcaseHistory } from './history'

/**
 * The showcase build (`npm run build:showcase`, docs/development.md): the app opens straight on made-up data in memory,
 * with no folder to pick. Every change stays in the tab and is gone after a reload.
 */
export async function bootShowcase() {
  const placeholder = Settings.parse({
    schemaVersion: SCHEMA_VERSION, vatMode: 'nonPayer',
    supplier: {
      name: 'x', ic: '12345678', email: 'x@example.com', phone: '1', registration: 'x',
      bank: { account: '1', bankCode: '1', swift: 'x' },
    },
  })
  const data = anonymize({ settings: placeholder, ...showcaseHistory(new Date()) })
  const s = useStore.getState()
  await s.open(new MemoryAdapter('faktury'))
  s.saveSettings(data.settings)
  s.replaceAll(data)
  await useStore.getState().flush()
  useStore.getState().setPhase({ kind: 'ready' })
}
