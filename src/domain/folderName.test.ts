import { describe, expect, it } from 'vitest'
import { folderName } from './folderName'

describe('folderName', () => {
  it('keeps Czech letters, spaces and dots inside the name', () => {
    expect(folderName('Kavárna U Lípy s.r.o.')).toBe('Kavárna U Lípy s.r.o')
    expect(folderName('Jana Nováková')).toBe('Jana Nováková')
  })

  it('replaces characters Windows forbids and tidies spaces', () => {
    expect(folderName('  A/B: "test"?  ')).toBe('A B test')
  })

  it('never returns an empty or reserved name', () => {
    expect(folderName('  ')).toBe('Invojka')
    expect(folderName('???')).toBe('Invojka')
    expect(folderName('CON')).toBe('CON (Invojka)')
  })
})
