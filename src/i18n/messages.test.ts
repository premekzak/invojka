import { describe, expect, it } from 'vitest'
import cs from './cs'
import en from './en'

/** Every text as [dotted key, text]. TypeScript already makes sure both languages have the same keys. */
function flatten(obj: object, prefix = ''): [string, string][] {
  return Object.entries(obj).flatMap(([k, v]) =>
    typeof v === 'string' ? [[prefix + k, v] as [string, string]] : Array.isArray(v) ? [] : flatten(v, `${prefix}${k}.`))
}
const placeholders = (s: string) => [...s.matchAll(/\{\{(\w+)\}\}|<(\w+)>/g)].map((m) => m[1] ?? `<${m[2]}>`).sort()
const csTexts = new Map(flatten(cs))
const enTexts = flatten(en)

describe('app texts', () => {
  it('use the same placeholders and markup in Czech and English', () => {
    const differ = enTexts.filter(([k, v]) => placeholders(v).join() !== placeholders(csTexts.get(k)!).join()).map(([k]) => k)
    expect(differ).toEqual([])
  })

  // Czech needs three forms (1 faktura, 2 faktury, 5 faktur); a text with a count but no forms reads "1 faktur".
  it('have one, few and other forms wherever they show a count', () => {
    const bases = new Set([...csTexts.keys()].filter((k) => /_(one|few|other)$/.test(k)).map((k) => k.replace(/_(one|few|other)$/, '')))
    const incomplete = [...bases].filter((b) => !['one', 'few', 'other'].every((f) => csTexts.has(`${b}_${f}`)))
    const unpluralized = [...csTexts].filter(([k, v]) => v.includes('{{count}}') && !/_(one|few|other)$/.test(k)).map(([k]) => k)
    expect(incomplete).toEqual([])
    expect(unpluralized).toEqual([])
  })
})
