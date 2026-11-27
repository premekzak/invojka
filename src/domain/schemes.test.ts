import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { SCHEMES } from '@/domain/schema'
import cs from '@/i18n/cs'
import en from '@/i18n/en'

// The schemes themselves (slots, contrast) are checked by src/design/schemes.test.ts; this checks that Invojka wires them in.
const indexCss = readFileSync(new URL('../index.css', import.meta.url), 'utf8')

describe.each(SCHEMES)('colour scheme %s', (id) => {
  it('has a file in the design kit that index.css imports, and a name in both languages', () => {
    expect(existsSync(new URL(`../design/schemes/${id}.css`, import.meta.url))).toBe(true)
    expect(indexCss).toContain(`@import "./design/schemes/${id}.css";`)
    expect(cs.settings.schemes[id]).toBeTruthy()
    expect(en.settings.schemes[id]).toBeTruthy()
  })
})

describe('a saved scheme that no longer exists', () => {
  it('falls back to the default, Terakota, instead of failing to load the settings', async () => {
    const { Settings } = await import('@/domain/schema')
    const ui = (s: unknown) => Settings.shape.ui.parse(s)
    expect(ui({ scheme: 'removed-scheme' }).scheme).toBe('nv-terakota')
    expect(ui({}).scheme).toBe('nv-terakota')
    expect(ui({ scheme: 'ur-protokol' }).scheme).toBe('ur-protokol')
    expect(ui({ scheme: 'warm' }).scheme).toBe('warm')
    expect(ui({ scheme: 'jasny-oblak' }).scheme).toBe('jasny-oblak')
  })
})
