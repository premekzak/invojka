/** Where the data files live. The only implementation for now is a folder on disk (File System Access API). */
export interface StorageAdapter {
  /** Human-readable name of the data location (folder name). */
  readonly name: string
  /** Returns undefined when the file doesn't exist yet. */
  read(file: string): Promise<{ text: string; lastModified: number } | undefined>
  /** Writes atomically. Returns the new lastModified. */
  write(file: string, text: string): Promise<number>
  lastModified(file: string): Promise<number | undefined>
  writeBinary(path: string, data: Blob): Promise<void>
}

export class ConflictError extends Error {
  constructor(public file: string) {
    super(`${file} was changed outside the app since it was loaded`)
  }
}
