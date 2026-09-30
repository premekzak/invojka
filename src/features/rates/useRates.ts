import { useState } from 'react'
import { fillRates, mergeTables, missingRateRequests, needsRate, parseCnbYear, type RateTable } from '@/domain/fx'
import { fetchEcbYear } from '@/fx/ecb'
import { useStore } from '@/state/store'

export interface RateRun {
  busy: boolean
  /** Progress of downloads, e.g. 3 of 11. */
  progress?: { done: number; total: number }
  filled?: number
  errors: string[]
}

/** Actions that fill missing exchange rates; manual rates are never touched. */
export function useRates() {
  const invoices = useStore((s) => s.invoices)
  const [run, setRun] = useState<RateRun>({ busy: false, errors: [] })
  const missing = invoices.filter((i) => needsRate(i) && i.status !== 'draft')

  const apply = (table: RateTable, source: 'cnb' | 'ecb') => {
    const updated = fillRates(useStore.getState().invoices, table, source)
    useStore.getState().upsertInvoices(updated)
    return updated.length
  }

  async function fillFromEcb() {
    const requests = missingRateRequests(useStore.getState().invoices)
    const errors: string[] = []
    const tables: RateTable[] = []
    setRun({ busy: true, progress: { done: 0, total: requests.length }, errors })
    // A few at a time: fast enough, and polite to a free service.
    for (let i = 0; i < requests.length; i += 4) {
      const batch = requests.slice(i, i + 4)
      const results = await Promise.allSettled(batch.map((r) => fetchEcbYear(r.currency, r.year)))
      results.forEach((r, j) => (r.status === 'fulfilled' ? tables.push(r.value) : errors.push(`${batch[j].currency} ${batch[j].year}: ${(r.reason as Error).message}`)))
      setRun((s) => ({ ...s, progress: { done: Math.min(i + 4, requests.length), total: requests.length } }))
    }
    const filled = apply(mergeTables(...tables), 'ecb')
    setRun({ busy: false, filled, errors })
  }

  async function importCnb(files: FileList | File[]) {
    setRun({ busy: true, errors: [] })
    const errors: string[] = []
    const tables: RateTable[] = []
    for (const f of files) {
      const t = parseCnbYear(await f.text())
      if (t.size) tables.push(t)
      else errors.push(`${f.name}: not a ČNB rate file`)
    }
    const filled = apply(mergeTables(...tables), 'cnb')
    setRun({ busy: false, filled, errors })
  }

  return { missing, run, fillFromEcb, importCnb }
}
