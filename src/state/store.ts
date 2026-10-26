import { create } from 'zustand'
import { anonymize } from '@/domain/demo'
import type { Customer, Invoice, Settings } from '@/domain/schema'
import { ConflictError, type StorageAdapter } from '@/storage/adapter'
import { MemoryAdapter } from '@/storage/memory'
import { loadAll, saveFile, writeAgentGuide, type FileKey, type Stamps } from '@/storage/repo'

export type Phase =
  | { kind: 'boot' }
  | { kind: 'noFolder' } // first launch or folder forgotten
  | { kind: 'needsPermission'; folder: string } // remembered folder, one click to reconnect
  | { kind: 'missingFolder'; folder: string } // remembered folder moved, renamed or deleted: pick it at its new place
  | { kind: 'onboarding' } // folder chosen but no settings.json yet
  | { kind: 'ready' }
  | { kind: 'error'; message: string }

export type SaveState = 'saved' | 'pending' | 'saving' | 'conflict' | 'error'

interface State {
  phase: Phase
  adapter: StorageAdapter | undefined
  settings: Settings | undefined
  customers: Customer[]
  invoices: Invoice[]
  stamps: Stamps
  saveState: SaveState
  saveError: string | undefined
  /** When the last change reached the folder, for "Vše uloženo v 18:05". Unset until something is saved. */
  savedAt: number | undefined
  conflictFile: FileKey | undefined
  /** Demo mode: an anonymized in-memory copy is shown; the real folder is never written. */
  demo: boolean
  /** The business open before the current one, so a new business's onboarding can go back to it. */
  previous: StorageAdapter | undefined
  /** The name typed when adding a business, to start its onboarding with. */
  newBusinessName: string | undefined

  setPhase(p: Phase): void
  open(adapter: StorageAdapter, newBusinessName?: string): Promise<void>
  reload(): Promise<void>
  /** Save pending changes, then open another business's folder. Throws 'unsaved' if something couldn't be saved. */
  switchTo(adapter: StorageAdapter, newBusinessName?: string): Promise<void>
  saveSettings(s: Settings): void
  upsertCustomer(c: Customer): void
  removeCustomer(id: string): void
  upsertInvoice(i: Invoice): void
  removeInvoice(id: string): void
  /** Update several invoices in one save (e.g. filled exchange rates). */
  upsertInvoices(list: Invoice[]): void
  replaceAll(data: { customers: Customer[]; invoices: Invoice[] }): void
  /** Resolve a conflict by overwriting the file on disk with the app's version. */
  forceSave(): Promise<void>
  flush(): Promise<void>
  /** Save pending changes, then switch to an anonymized in-memory copy. `label` names it in the UI. */
  enterDemo(label: string): Promise<void>
  /** Drop the demo copy (and any changes made in it) and reload the real folder. */
  exitDemo(): Promise<void>
}

const SAVE_DELAY = 400
const dirty = new Set<FileKey>()
let timer: ReturnType<typeof setTimeout> | undefined
let realAdapter: StorageAdapter | undefined

const upsert = <T extends { id: string }>(list: T[], item: T) => {
  const i = list.findIndex((x) => x.id === item.id)
  return i === -1 ? [...list, item] : list.map((x, j) => (j === i ? item : x))
}

export const useStore = create<State>()((set, get) => {
  function schedule(...keys: FileKey[]) {
    keys.forEach((k) => dirty.add(k))
    set({ saveState: 'pending' })
    clearTimeout(timer)
    timer = setTimeout(() => void get().flush(), SAVE_DELAY)
  }

  const dataFor = (key: FileKey) => {
    const s = get()
    return key === 'settings' ? s.settings! : key === 'customers' ? s.customers : s.invoices
  }

  async function write(force: boolean) {
    const { adapter } = get()
    if (!adapter || dirty.size === 0) return
    set({ saveState: 'saving' })
    for (const key of [...dirty]) {
      try {
        const stamp = await saveFile(adapter, key, dataFor(key), get().stamps[key], force)
        dirty.delete(key)
        set((s) => ({ stamps: { ...s.stamps, [key]: stamp } }))
      } catch (e) {
        if (e instanceof ConflictError) return set({ saveState: 'conflict', conflictFile: key })
        return set({ saveState: 'error', saveError: (e as Error).message })
      }
    }
    set({ saveState: dirty.size ? 'pending' : 'saved', saveError: undefined, conflictFile: undefined, ...(dirty.size ? {} : { savedAt: Date.now() }) })
  }

  return {
    phase: { kind: 'boot' },
    adapter: undefined,
    settings: undefined,
    customers: [],
    invoices: [],
    stamps: {},
    saveState: 'saved',
    saveError: undefined,
    savedAt: undefined,
    conflictFile: undefined,
    demo: false,
    previous: undefined,
    newBusinessName: undefined,

    setPhase: (phase) => set({ phase }),

    async open(adapter, newBusinessName) {
      const { adapter: before, demo } = get()
      set({ adapter, demo: false, previous: demo ? realAdapter : before, newBusinessName })
      realAdapter = undefined
      await get().reload()
    },

    async switchTo(adapter, newBusinessName) {
      if (get().demo) throw new Error('demo')
      await get().flush()
      if (dirty.size || get().saveState !== 'saved') throw new Error('unsaved')
      await get().open(adapter, newBusinessName)
    },

    async reload() {
      const { adapter, demo } = get()
      if (!adapter || demo) return
      clearTimeout(timer)
      dirty.clear()
      try {
        // A moved folder reads as empty, so without this it would start onboarding instead of asking where it went.
        if (adapter.exists && !(await adapter.exists())) {
          if (get().adapter === adapter) set({ phase: { kind: 'missingFolder', folder: adapter.name } })
          return
        }
        const data = await loadAll(adapter)
        // Another folder was opened while this one loaded (e.g. the remembered folder at start-up racing a newer open):
        // its data must not land on top of the newer folder, or edits would be saved into the wrong one.
        if (get().adapter !== adapter) return
        set({ ...data, saveState: 'saved', savedAt: undefined, conflictFile: undefined, phase: data.settings ? { kind: 'ready' } : { kind: 'onboarding' } })
        // Not vital: a folder that refuses it still works, so a failure is only logged.
        if (data.settings) writeAgentGuide(adapter).catch((e) => console.warn('AGENTS.md', e))
      } catch (e) {
        set({ phase: { kind: 'error', message: (e as Error).message } })
      }
    },

    saveSettings(settings) {
      set({ settings })
      schedule('settings')
    },
    upsertCustomer(c) {
      set((s) => ({ customers: upsert(s.customers, c) }))
      schedule('customers')
    },
    removeCustomer(id) {
      set((s) => ({ customers: s.customers.filter((c) => c.id !== id) }))
      schedule('customers')
    },
    upsertInvoice(i) {
      set((s) => ({ invoices: upsert(s.invoices, i) }))
      schedule('invoices')
    },
    upsertInvoices(list) {
      if (!list.length) return
      const byId = new Map(list.map((i) => [i.id, i]))
      set((s) => ({ invoices: s.invoices.map((i) => byId.get(i.id) ?? i) }))
      schedule('invoices')
    },
    removeInvoice(id) {
      set((s) => ({ invoices: s.invoices.filter((i) => i.id !== id) }))
      schedule('invoices')
    },
    replaceAll({ customers, invoices }) {
      set({ customers, invoices })
      schedule('customers', 'invoices')
    },

    forceSave: () => write(true),
    async flush() {
      clearTimeout(timer)
      if (get().saveState !== 'conflict') await write(false)
    },

    async enterDemo(label) {
      if (get().demo) return
      await get().flush()
      const { adapter, settings, customers, invoices, saveState } = get()
      if (!adapter || !settings) return
      if (dirty.size || saveState !== 'saved') throw new Error('unsaved')
      realAdapter = adapter
      const data = anonymize({ settings, customers, invoices })
      set({ ...data, adapter: new MemoryAdapter(label), stamps: {}, demo: true })
    },
    async exitDemo() {
      if (!get().demo || !realAdapter) return
      clearTimeout(timer)
      dirty.clear()
      set({ adapter: realAdapter, demo: false })
      realAdapter = undefined
      await get().reload()
    },
  }
})

// Don't lose the last keystrokes when the tab closes while a save is pending.
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', (e) => {
    if (dirty.size && !useStore.getState().demo) {
      void useStore.getState().flush()
      e.preventDefault()
    }
  })
}
