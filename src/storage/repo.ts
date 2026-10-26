import type { z } from 'zod'
import { AGENT_GUIDE, AGENT_GUIDE_FILE } from '@/domain/agentGuide'
import { CustomersFile, FILES, InvoicesFile, SCHEMA_VERSION, Settings, type Customer, type Invoice } from '@/domain/schema'
import { ConflictError, type StorageAdapter } from './adapter'

export type FileKey = keyof typeof FILES
/** lastModified of each file as last seen by the app; used to detect changes made elsewhere. */
export type Stamps = Partial<Record<FileKey, number>>

export class DataFileError extends Error {
  constructor(public file: string, detail: string) {
    super(`${file}: ${detail}`)
  }
}

export interface LoadedData {
  settings: Settings | undefined
  customers: Customer[]
  invoices: Invoice[]
  stamps: Stamps
}

async function readJson<S extends z.ZodType>(adapter: StorageAdapter, key: FileKey, schema: S) {
  const file = FILES[key]
  const res = await adapter.read(file)
  // A 0-byte file is what an interrupted first save leaves behind (the file is created before
  // its content is committed). It never holds data, so treat it as "not created yet".
  if (!res) return undefined
  if (res.text.trim() === '') return { data: undefined, lastModified: res.lastModified }
  let json: unknown
  try {
    json = JSON.parse(res.text)
  } catch (e) {
    throw new DataFileError(file, `not valid JSON (${(e as Error).message})`)
  }
  const version = (json as { schemaVersion?: unknown })?.schemaVersion
  if (typeof version === 'number' && version > SCHEMA_VERSION) {
    throw new DataFileError(file, `was saved by a newer version of Invojka (schema ${version}); please update the app`)
  }
  const parsed = schema.safeParse(json)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    throw new DataFileError(file, `${issue.path.join('.') || '(root)'}: ${issue.message}`)
  }
  return { data: parsed.data as z.infer<S>, lastModified: res.lastModified }
}

export async function loadAll(adapter: StorageAdapter): Promise<LoadedData> {
  const [settings, customers, invoices] = await Promise.all([
    readJson(adapter, 'settings', Settings),
    readJson(adapter, 'customers', CustomersFile),
    readJson(adapter, 'invoices', InvoicesFile),
  ])
  return {
    settings: settings?.data,
    customers: customers?.data?.customers ?? [],
    invoices: invoices?.data?.invoices ?? [],
    stamps: { settings: settings?.lastModified, customers: customers?.lastModified, invoices: invoices?.lastModified },
  }
}

export function serialize(key: FileKey, data: Settings | Customer[] | Invoice[]): string {
  const body =
    key === 'settings' ? data
    : key === 'customers' ? { schemaVersion: SCHEMA_VERSION, customers: data }
    : { schemaVersion: SCHEMA_VERSION, invoices: data }
  return JSON.stringify(body, null, 2) + '\n'
}

/**
 * Save one file. Refuses with ConflictError if the file on disk changed since `expected`
 * (another device via Google Drive sync, or a hand edit). Pass `force` to overwrite anyway.
 */
export async function saveFile(
  adapter: StorageAdapter, key: FileKey, data: Settings | Customer[] | Invoice[], expected: number | undefined, force = false,
): Promise<number> {
  const file = FILES[key]
  if (!force) {
    const current = await adapter.lastModified(file)
    if (current !== expected) throw new ConflictError(file)
  }
  return adapter.write(file, serialize(key, data))
}

/** Keep AGENTS.md in the folder current for AI agents. Written only when it differs, so syncing services see no churn. */
export async function writeAgentGuide(adapter: StorageAdapter) {
  if ((await adapter.read(AGENT_GUIDE_FILE))?.text !== AGENT_GUIDE) await adapter.write(AGENT_GUIDE_FILE, AGENT_GUIDE)
}
