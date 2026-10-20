import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toMajor, toMinor } from '@/domain/money'
import type { Settings } from '@/domain/schema'
import { InputAffix, Labeled } from '@/ui/primitives'

type Opening = Settings['opening']

/** Whole crowns as typed ("120 000", "120000,50"); an empty field is 0, anything else unreadable is undefined. */
function parseKc(text: string): number | undefined {
  if (!text.trim()) return 0
  try {
    const m = toMinor(text)
    return m >= 0 ? m : undefined
  } catch {
    return undefined
  }
}

/** A field of whole crowns that reports the amount when it can be read and shows an error when it can't. */
function KcField({ label, hint, value, onChange }: { label: string; hint: string; value: number; onChange: (minor: number) => void }) {
  const { t } = useTranslation()
  const [text, setText] = useState(value ? String(toMajor(value)) : '')
  // Follow a value changed from outside (another tab, a reload), unless it's what the field already says.
  useEffect(() => { if (parseKc(text) !== value) setText(value ? String(toMajor(value)) : '') }, [value])
  const parsed = parseKc(text)
  return (
    <Labeled label={label} hint={hint} error={parsed === undefined ? t('opening.invalid') : undefined}>
      <InputAffix unit="Kč" inputMode="decimal" placeholder="0" value={text}
        onChange={(e) => { setText(e.target.value); const n = parseKc(e.target.value); if (n !== undefined) onChange(n) }} />
    </Labeled>
  )
}

/**
 * This year's income and turnover from before Invojka (settings.opening), for someone who invoiced elsewhere: Home adds
 * them to the tax estimate and the VAT limit. Used in onboarding and in Settings → Daně. Typing sets the current year.
 */
export function OpeningBalance({ value, year, onChange }: { value: Opening; year: number; onChange: (o: Opening) => void }) {
  const { t } = useTranslation()
  // Last year's figures no longer count; the fields start empty in a new year.
  const current = value.year === year ? value : { year, income: 0, turnover: 0 }
  const set = (patch: Partial<Opening>) => {
    const next = { ...current, ...patch }
    onChange(next.income || next.turnover ? next : { year: 0, income: 0, turnover: 0 })
  }
  return (
    <div className="grid max-w-2xl grid-cols-2 gap-4 mobile-stack">
      <KcField label={t('opening.turnover', { year })} hint={t('opening.turnoverHint')} value={current.turnover} onChange={(turnover) => set({ turnover })} />
      <KcField label={t('opening.income', { year })} hint={t('opening.incomeHint')} value={current.income} onChange={(income) => set({ income })} />
    </div>
  )
}
