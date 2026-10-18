import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { ErrorBoundary } from './ui/ErrorBoundary'
import './i18n'
import './index.css'
import { loadUiFonts } from './pdf/fonts'

loadUiFonts()

// The public showcase build opens on made-up data in memory (src/showcase/boot.ts).
if (import.meta.env.MODE === 'showcase') void import('./showcase/boot').then((m) => m.bootShowcase())

// Dev-only hooks so browser automation can run the app against in-memory storage (no folder dialog).
if (import.meta.env.DEV) {
  void Promise.all([import('./state/store'), import('./storage/memory'), import('./import/csv'), import('./domain/schema'), import('./domain/check')]).then(
    ([{ useStore }, { MemoryAdapter }, { importCsv }, { Settings, SCHEMA_VERSION }, { checkData }]) => {
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
      /** List what's wrong with the data that's open now (errors, then warnings) in a console table. */
      const check = () => {
        const { settings, customers, invoices } = useStore.getState()
        if (!settings) return console.warn('No data open.')
        const issues = checkData({ settings, customers, invoices }).sort((a, b) => a.level.localeCompare(b.level))
        console.table(issues)
        return issues
      }
      Object.assign(window, { __invojka: { useStore, openMemory, seedFromCsv, check } })
    },
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* The last line of defence; each screen also has its own boundary (App.tsx), so the header stays usable. */}
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
