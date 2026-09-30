import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import './i18n'
import './index.css'
import { loadUiFonts } from './pdf/fonts'

loadUiFonts()

// Dev-only hooks so browser automation can run the app against in-memory storage (no folder dialog).
if (import.meta.env.DEV) {
  void Promise.all([import('./state/store'), import('./storage/memory'), import('./import/csv'), import('./domain/schema')]).then(
    ([{ useStore }, { MemoryAdapter }, { importCsv }, { Settings, SCHEMA_VERSION }]) => {
      const openMemory = () => useStore.getState().open(new MemoryAdapter())
      /** Load the repo's sample CSVs (served by the dev server) into a fresh in-memory folder. */
      const seedFromCsv = async (vatMode: 'payer' | 'nonPayer' = 'nonPayer') => {
        // The real export is git-ignored; without it (or when the dev server answers with index.html) use the made-up fixture.
        const [real, fixture] = await Promise.all([
          Promise.all(['/customers.csv', '/invoices.csv'].map((u) => fetch(u).then((r) => (r.ok ? r.text() : '')))),
          import('./import/fixture'),
        ])
        const hasReal = real.every((t) => t && !t.trimStart().startsWith('<'))
        const [c, i] = hasReal ? real : [fixture.fixtureCustomersCsv, fixture.fixtureInvoicesCsv]
        await openMemory()
        const s = useStore.getState()
        s.saveSettings(Settings.parse({ schemaVersion: SCHEMA_VERSION, supplier: { name: 'Test Dodavatel' }, vatMode }))
        s.replaceAll(importCsv(c, i, vatMode))
        await s.flush()
        s.setPhase({ kind: 'ready' })
      }
      Object.assign(window, { __invoicer: { useStore, openMemory, seedFromCsv } })
    },
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
