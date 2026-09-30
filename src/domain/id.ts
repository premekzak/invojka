export const newId = (): string => crypto.randomUUID()

export const today = (): string => new Date().toISOString().slice(0, 10)

/** Normalized company name for matching: case, punctuation, whitespace and legal form don't matter. */
export function nameKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/[.,]/g, ' ')
    .replace(/\b(s ?r ?o|spol s r ?o|a ?s|ltd|limited|ag|gmbh|inc|se|v ?o ?s|k ?s)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export const normalizeIc = (ic: string) => ic.replace(/\s/g, '')
