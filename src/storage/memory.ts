import type { StorageAdapter } from './adapter'

/** In-memory storage for tests and the demo mode. */
export class MemoryAdapter implements StorageAdapter {
  constructor(readonly name = 'memory') {}
  files = new Map<string, { text: string; lastModified: number }>()
  private clock = 1

  async read(file: string) {
    return this.files.get(file)
  }
  async lastModified(file: string) {
    return this.files.get(file)?.lastModified
  }
  async write(file: string, text: string) {
    const lastModified = this.clock++
    this.files.set(file, { text, lastModified })
    return lastModified
  }
  binaries = new Map<string, Blob>()
  async writeBinary(path: string, data: Blob) {
    this.binaries.set(path, data)
  }
  /** Simulates another device (or Google Drive sync) changing a file. */
  touch(file: string, text: string) {
    this.files.set(file, { text, lastModified: this.clock++ })
  }
}
