import { describe, expect, it } from 'vitest'
import { normalizeIc, toParty } from './ares'

// Shapes as ARES returns them (checked 2026-10-18); the businesses are public bodies or made up.
describe('ARES', () => {
  it('reads an IČ with spaces and missing leading zeros', () => {
    expect(normalizeIc('000 06 947')).toBe('00006947')
    expect(normalizeIc('6947')).toBeUndefined()
    expect(normalizeIc('6947xx')).toBeUndefined()
    expect(normalizeIc('123456')).toBe('00123456')
  })

  it('writes a Prague address with the district, house and orientation number', () => {
    expect(toParty({
      ico: '00006947', obchodniJmeno: 'Ministerstvo  financí ', dic: 'CZ00006947',
      sidlo: { nazevStatu: 'Česká republika', nazevObce: 'Praha', nazevMestskehoObvodu: 'Praha 1', nazevCastiObce: 'Malá Strana',
        nazevUlice: 'Letenská', cisloDomovni: 525, typCisloDomovni: 1, cisloOrientacni: 15, psc: 11800 },
    })).toEqual({
      ic: '00006947', name: 'Ministerstvo financí', dic: 'CZ00006947',
      address: { street: 'Letenská 525/15', zip: '118 00', city: 'Praha 1', country: 'Česká republika' },
    })
  })

  it('uses the village name without streets, a letter in the orientation number and an evidence number', () => {
    const p = (sidlo: object) => toParty({ ico: '12345678', obchodniJmeno: 'Truhlářství Novák', sidlo }).address
    expect(p({ nazevStatu: 'Česká republika', nazevObce: 'Lhota', nazevCastiObce: 'Lhota', cisloDomovni: 12, psc: 25001 }))
      .toEqual({ street: 'Lhota 12', zip: '250 01', city: 'Lhota', country: 'Česká republika' })
    expect(p({ nazevObce: 'Brno', nazevMestskehoObvodu: 'Brno-střed', nazevUlice: 'Údolní', cisloDomovni: 53, cisloOrientacni: 3, cisloOrientacniPismeno: 'a', psc: 60200 }).street)
      .toBe('Údolní 53/3a')
    expect(p({ nazevObce: 'Doksy', nazevCastiObce: 'Staré Splavy', cisloDomovni: 7, typCisloDomovni: 2 }).street).toBe('Staré Splavy č. ev. 7')
  })

  it('keeps a foreign seat as text, and marks a business that no longer exists', () => {
    const p = toParty({ ico: '87654321', obchodniJmeno: 'Foreign Ltd', datumZaniku: '2020-05-31',
      sidlo: { nazevStatu: 'Slovenská republika', textovaAdresa: 'Hlavná 1, 811 01 Bratislava' } })
    expect(p.address).toEqual({ street: 'Hlavná 1, 811 01 Bratislava', zip: '', city: '', country: 'Slovenská republika' })
    expect(p.ceased).toBe('2020-05-31')
    expect(p.dic).toBe('')
  })

  it('tells a sole trader (legal form 101) from a company (112)', () => {
    expect(toParty({ ico: '12345678', obchodniJmeno: 'Jan Novák', pravniForma: '101' }).selfEmployed).toBe(true)
    expect(toParty({ ico: '12345678', obchodniJmeno: 'Novák s.r.o.', pravniForma: '112' }).selfEmployed).toBe(false)
    expect(toParty({ ico: '12345678', obchodniJmeno: 'Novák' }).selfEmployed).toBeUndefined()
  })
})
