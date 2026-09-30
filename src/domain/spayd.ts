import { toMajor, type Minor } from './money'

/** QR Platba (Short Payment Descriptor) string, see qr-platba.cz. */
export function spayd(p: { iban: string; amount: Minor; currency: string; vs?: string; message?: string; dueDate?: string }): string {
  const clean = (s: string) => s.replace(/\*/g, '').normalize('NFD').replace(/[̀-ͯ]/g, '')
  const parts = [
    'SPD*1.0',
    `ACC:${p.iban.replace(/\s/g, '').toUpperCase()}`,
    `AM:${toMajor(p.amount).toFixed(2)}`,
    `CC:${p.currency}`,
  ]
  if (p.vs) parts.push(`X-VS:${p.vs.replace(/\D/g, '').slice(0, 10)}`)
  if (p.dueDate) parts.push(`DT:${p.dueDate.replace(/-/g, '')}`)
  if (p.message) parts.push(`MSG:${clean(p.message).slice(0, 60)}`)
  return parts.join('*')
}

/** Build a Czech IBAN from a domestic account number "prefix-number" and a bank code. */
export function czechIban(account: string, bankCode: string): string {
  const [prefix, number] = account.includes('-') ? account.split('-') : ['0', account]
  const bban = bankCode.padStart(4, '0') + prefix.padStart(6, '0') + number.padStart(10, '0')
  const numeric = bban + '123500' // "CZ" = 12 35, plus "00" check placeholder
  let rem = 0
  for (const ch of numeric) rem = (rem * 10 + Number(ch)) % 97
  return `CZ${String(98 - rem).padStart(2, '0')}${bban}`
}
