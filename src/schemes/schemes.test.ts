import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { SCHEMES } from '@/domain/schema'
import cs from '@/i18n/cs'
import en from '@/i18n/en'

const read = (f: string) => readFileSync(new URL(f, import.meta.url), 'utf8')
// Every palette slot Warm paper defines in :root, which a scheme must redefine in light and dark.
const slots = [...read('../index.css').match(/:root \{([^}]*)\}/)![1]!.matchAll(/--([a-z0-9-]+):/g)].map((m) => m[1])

describe.each(SCHEMES.filter((s) => s !== 'warm'))('colour scheme %s', (id) => {
  it('has a file that is imported, and a name in both languages', () => {
    expect(existsSync(new URL(`./${id}.css`, import.meta.url))).toBe(true)
    expect(read('../index.css')).toContain(`@import "./schemes/${id}.css";`)
    expect(cs.settings.schemes[id]).toBeTruthy()
    expect(en.settings.schemes[id]).toBeTruthy()
  })

  it('redefines every palette slot, the header pill and the footer, in light and dark', () => {
    const css = read(`./${id}.css`)
    for (const selector of [`:root[data-scheme="${id}"]`, `:root.dark[data-scheme="${id}"]`]) {
      const body = css.slice(css.indexOf(`${selector} {`)).split('}')[0]!
      const missing = [...slots, 'color-header-active', 'color-footer', 'color-footer-fg', 'color-footer-muted'].filter((s) => !body.includes(`--${s}:`))
      expect(missing, selector).toEqual([])
    }
  })
})
