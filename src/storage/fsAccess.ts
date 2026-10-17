import type { StorageAdapter } from './adapter'

// Folder storage via the File System Access API. The directory handle is remembered in IndexedDB,
// so after a restart the user only has to confirm permission with one click.
// Each business is its own folder: `dataDir` is the one opened last, `folders` lists every business the user has opened.

const DB = 'invojka'
// The app was called Invoicer before 2026-10-17; a folder remembered under the old name is moved over once.
const LEGACY_DB = 'invoicer'
const STORE = 'handles'
const KEY = 'dataDir'
const FOLDERS = 'folders'

/** A business the user has opened. `label` is its supplier name from the last time it was open, for the switcher. */
interface FolderEntry { dir: FileSystemDirectoryHandle; label?: string }

function idb<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>, db = DB): Promise<T> {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open(db, 1)
    open.onupgradeneeded = () => open.result.createObjectStore(STORE)
    open.onerror = () => reject(open.error)
    open.onsuccess = () => {
      const tx = open.result.transaction(STORE, mode)
      // Close once done, or deleting the legacy database would stay blocked by an open connection.
      tx.oncomplete = tx.onabort = () => open.result.close()
      const req = fn(tx.objectStore(STORE))
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    }
  })
}

async function legacyDir(): Promise<FileSystemDirectoryHandle | undefined> {
  const dir = await idb<FileSystemDirectoryHandle | undefined>('readonly', (s) => s.get(KEY), LEGACY_DB)
  if (dir) await idb('readwrite', (s) => s.put(dir, KEY))
  indexedDB.deleteDatabase(LEGACY_DB)
  return dir
}

async function folders(): Promise<FolderEntry[]> {
  const list = await idb<FolderEntry[] | undefined>('readonly', (s) => s.get(FOLDERS))
  if (list) return list
  // Before 2026-10-17 only one folder was remembered: it becomes the first business.
  const dir = await idb<FileSystemDirectoryHandle | undefined>('readonly', (s) => s.get(KEY))
  return dir ? [{ dir }] : []
}

async function indexOf(list: FolderEntry[], dir: FileSystemDirectoryHandle) {
  for (let i = 0; i < list.length; i++) if (await list[i].dir.isSameEntry(dir)) return i
  return -1
}

/** Adds the folder to the list (once) and makes it the one opened next time. */
async function remember(dir: FileSystemDirectoryHandle) {
  const list = await folders()
  if ((await indexOf(list, dir)) === -1) list.push({ dir })
  await idb('readwrite', (s) => s.put(list, FOLDERS))
  await idb('readwrite', (s) => s.put(dir, KEY))
}

export interface RememberedFolder { adapter: FsAccessAdapter; label: string; current: boolean }

export const isSupported = () => typeof window !== 'undefined' && 'showDirectoryPicker' in window

export class FsAccessAdapter implements StorageAdapter {
  constructor(private dir: FileSystemDirectoryHandle) {}

  get name() {
    return this.dir.name
  }

  /** Ask the user to choose a folder (must be called from a click handler). */
  static async pick(): Promise<FsAccessAdapter> {
    const dir = await window.showDirectoryPicker({ id: 'invojka-data', mode: 'readwrite' })
    await remember(dir)
    return new FsAccessAdapter(dir)
  }

  /**
   * Ask the user where a new business should live, then create its folder there (must be called from a click handler).
   * Refuses a place that is itself a business folder, so businesses never end up nested.
   */
  static async createIn(folder: string): Promise<FsAccessAdapter | { insideBusiness: string }> {
    const parent = await window.showDirectoryPicker({ id: 'invojka-parent', mode: 'readwrite', startIn: 'documents' })
    if (await new FsAccessAdapter(parent).read('settings.json')) return { insideBusiness: parent.name }
    const dir = await parent.getDirectoryHandle(folder, { create: true })
    await remember(dir)
    return new FsAccessAdapter(dir)
  }

  /** Every business folder the user has opened, in the order they were added. Labels fall back to the folder name. */
  static async list(current?: StorageAdapter): Promise<RememberedFolder[]> {
    const list = await folders()
    const cur = current instanceof FsAccessAdapter ? current.dir : undefined
    return Promise.all(list.map(async (f) => ({
      adapter: new FsAccessAdapter(f.dir),
      label: f.label || f.dir.name,
      current: cur ? await f.dir.isSameEntry(cur) : false,
    })))
  }

  /** Make this folder the one opened next time. Asks for permission if needed (must be called from a click handler). */
  async activate(): Promise<boolean> {
    const ok = (await this.dir.queryPermission({ mode: 'readwrite' })) === 'granted' || (await this.reconnect())
    if (ok) await remember(this.dir)
    return ok
  }

  /** Remember the business name shown in the switcher. */
  async setLabel(label: string) {
    const list = await folders()
    const i = await indexOf(list, this.dir)
    if (i === -1 || list[i].label === label) return
    list[i] = { ...list[i], label }
    await idb('readwrite', (s) => s.put(list, FOLDERS))
  }

  /** Drop the folder from the list. Its files stay where they are. */
  async forgetFolder() {
    const list = await folders()
    const i = await indexOf(list, this.dir)
    if (i !== -1) list.splice(i, 1)
    await idb('readwrite', (s) => s.put(list, FOLDERS))
    const last = await idb<FileSystemDirectoryHandle | undefined>('readonly', (s) => s.get(KEY))
    if (last && (await last.isSameEntry(this.dir))) {
      if (list[0]) await idb('readwrite', (s) => s.put(list[0].dir, KEY))
      else await idb('readwrite', (s) => s.delete(KEY))
    }
  }

  /** The same folder as another adapter (e.g. the user picked a business that is already in the list). */
  async isSame(other: StorageAdapter | undefined) {
    return other instanceof FsAccessAdapter && this.dir.isSameEntry(other.dir)
  }

  /** The folder chosen last time, if any. Permission may still need to be granted via `reconnect`. */
  static async remembered(): Promise<{ adapter: FsAccessAdapter; granted: boolean } | undefined> {
    const dir = (await idb<FileSystemDirectoryHandle | undefined>('readonly', (s) => s.get(KEY))) ?? (await legacyDir())
    if (!dir) return undefined
    const granted = (await dir.queryPermission({ mode: 'readwrite' })) === 'granted'
    return { adapter: new FsAccessAdapter(dir), granted }
  }

  /** Re-request permission for the remembered folder (must be called from a click handler). */
  async reconnect(): Promise<boolean> {
    return (await this.dir.requestPermission({ mode: 'readwrite' })) === 'granted'
  }

  static forget() {
    return idb('readwrite', (s) => s.delete(KEY))
  }

  private async fileHandle(path: string, create: boolean): Promise<FileSystemFileHandle | undefined> {
    const parts = path.split('/')
    let dir = this.dir
    try {
      for (const p of parts.slice(0, -1)) dir = await dir.getDirectoryHandle(p, { create })
      return await dir.getFileHandle(parts[parts.length - 1], { create })
    } catch (e) {
      if (!create && e instanceof DOMException && e.name === 'NotFoundError') return undefined
      throw e
    }
  }

  async read(file: string) {
    const h = await this.fileHandle(file, false)
    if (!h) return undefined
    const f = await h.getFile()
    return { text: await f.text(), lastModified: f.lastModified }
  }

  async lastModified(file: string) {
    const h = await this.fileHandle(file, false)
    return h ? (await h.getFile()).lastModified : undefined
  }

  async write(file: string, text: string) {
    const h = (await this.fileHandle(file, true))!
    // createWritable writes to a temporary file and swaps it in on close(), so a crash never leaves a half-written file.
    const w = await h.createWritable()
    await w.write(text)
    await w.close()
    return (await h.getFile()).lastModified
  }

  async writeBinary(path: string, data: Blob) {
    const h = (await this.fileHandle(path, true))!
    const w = await h.createWritable()
    await w.write(data)
    await w.close()
  }
}
