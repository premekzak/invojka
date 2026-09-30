import type { StorageAdapter } from './adapter'

// Folder storage via the File System Access API. The directory handle is remembered in IndexedDB,
// so after a restart the user only has to confirm permission with one click.

const DB = 'invoicer'
const STORE = 'handles'
const KEY = 'dataDir'

function idb<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open(DB, 1)
    open.onupgradeneeded = () => open.result.createObjectStore(STORE)
    open.onerror = () => reject(open.error)
    open.onsuccess = () => {
      const req = fn(open.result.transaction(STORE, mode).objectStore(STORE))
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    }
  })
}

export const isSupported = () => typeof window !== 'undefined' && 'showDirectoryPicker' in window

export class FsAccessAdapter implements StorageAdapter {
  constructor(private dir: FileSystemDirectoryHandle) {}

  get name() {
    return this.dir.name
  }

  /** Ask the user to choose a folder (must be called from a click handler). */
  static async pick(): Promise<FsAccessAdapter> {
    const dir = await window.showDirectoryPicker({ id: 'invoicer-data', mode: 'readwrite' })
    await idb('readwrite', (s) => s.put(dir, KEY))
    return new FsAccessAdapter(dir)
  }

  /** The folder chosen last time, if any. Permission may still need to be granted via `reconnect`. */
  static async remembered(): Promise<{ adapter: FsAccessAdapter; granted: boolean } | undefined> {
    const dir = await idb<FileSystemDirectoryHandle | undefined>('readonly', (s) => s.get(KEY))
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
