import { describe, expect, it } from 'vitest'
import { composeEmail, DEFAULT_TEMPLATES, fillTemplate, mailtoLink, PLACEHOLDER_NAMES, templateFor } from './email'
import { newInvoice } from './invoice'
import { SCHEMA_VERSION, Settings } from './schema'

const settings = Settings.parse({
  schemaVersion: SCHEMA_VERSION, vatMode: 'nonPayer',
  supplier: { name: 'Jan Testovací', bank: { account: '19-2000145399', bankCode: '0800' } },
})
const inv = {
  ...newInvoice(settings, [], undefined, '2026-09-01'), number: '20260008', variableSymbol: '20260008', dueDate: '2026-09-15', status: 'issued' as const,
  customerSnapshot: { name: 'Acme s.r.o.', ic: '', dic: '', address: { street: '', zip: '', city: '', country: '' } },
  lines: [{ description: 'x', quantity: 1, unit: '', unitPrice: 1450000, vatRate: 0 }],
}

describe('e-mails', () => {
  it('fill the reminder with the amount due, the due date, the days overdue and the account', () => {
    const { subject, body } = composeEmail(inv, settings, 'reminder', '2026-10-18')
    expect(subject).toBe('Upomínka: faktura 20260008')
    // The amount keeps its no-break spaces, so it never splits across lines in the e-mail.
    expect(body.replace(/ /g, ' ')).toContain('na 14 500,00 Kč byla splatná 15. 9. 2026, tedy před 33 dny')
    expect(body).toContain('na účet 19-2000145399/0800 s variabilním symbolem 20260008')
    expect(body).toContain('Jan Testovací')
    expect(composeEmail({ ...inv, language: 'en' }, settings, 'invoice', '2026-10-18').subject).toBe('Invoice 20260008')
  })

  it('leave out the payment sentence for cash or without an account, with no gaps left behind', () => {
    const cash = composeEmail({ ...inv, paymentMethod: 'cash' }, settings, 'reminder', '2026-10-18').body
    expect(cash).not.toContain('účet')
    expect(cash).toContain('přehlédněte.\n\nFakturu přikládám znovu.')
    const noAccount = Settings.parse({ ...settings, supplier: { ...settings.supplier, bank: {} } })
    expect(composeEmail(inv, noAccount, 'invoice', '2026-10-18').body).toMatch(/splatností 15\. 9\. 2026\.\n\nDěkuji/)
  })

  it('use the user’s own text when there is one, and keep unknown placeholders visible', () => {
    const own = Settings.parse({ ...settings, emailTemplates: { invoice: { cs: { subject: 'Fa {cislo} od {dodavatel}', body: '' } } } })
    expect(templateFor(own, 'invoice', 'cs')).toEqual({ subject: 'Fa {cislo} od {dodavatel}', body: DEFAULT_TEMPLATES.invoice.cs.body })
    expect(composeEmail(inv, own, 'invoice', '2026-10-18').subject).toBe('Fa 20260008 od Jan Testovací')
    expect(fillTemplate('{cislo} {preklep}', { cislo: '1' })).toBe('1 {preklep}')
  })

  it('use only their own language’s placeholder names in the built-in texts', () => {
    for (const kind of Object.values(DEFAULT_TEMPLATES)) for (const [lang, t] of Object.entries(kind))
      for (const [, key] of `${t.subject} ${t.body}`.matchAll(/\{(\w+)\}/g)) expect(Object.values(PLACEHOLDER_NAMES[lang as 'cs'])).toContain(key)
  })

  it('fill any language’s names in any template, so older texts keep working', () => {
    const own = Settings.parse({ ...settings, emailTemplates: { invoice: { en: { subject: '{number} / {castka} / {betrag} / {supplier}', body: 'x' } } } })
    expect(composeEmail({ ...inv, language: 'en' }, own, 'invoice', '2026-10-18').subject.replace(/\u00a0/g, ' '))
      .toBe('20260008 / CZK 14,500.00 / CZK 14,500.00 / Jan Testovací')
  })

  it('build a mailto link with encoded text and CRLF line breaks', () => {
    expect(mailtoLink(['a@b.cz'], ['c@d.cz', 'e@f.cz'], 'Faktura 1', 'Dobrý den,\nděkuji'))
      .toBe('mailto:a%40b.cz?cc=c%40d.cz,e%40f.cz&subject=Faktura%201&body=Dobr%C3%BD%20den%2C%0D%0Ad%C4%9Bkuji')
    expect(mailtoLink([], [], 'S', 'B')).toBe('mailto:?subject=S&body=B')
  })
})

describe('invoice languages', () => {
  it('write dates and e-mails in German and Slovak', async () => {
    const { formatDocDate } = await import('./language')
    expect(formatDocDate('2026-09-05', 'de')).toBe('05.09.2026')
    expect(formatDocDate('2026-09-05', 'sk')).toBe('5. 9. 2026')
    expect(formatDocDate('2026-09-05', 'en')).toBe('5 Sep 2026')
    const de = composeEmail({ ...inv, language: 'de' }, settings, 'reminder', '2026-10-18')
    expect(de.subject).toBe('Zahlungserinnerung: Rechnung 20260008')
    expect(de.body).toContain('war am 15.09.2026 fällig, vor 33 Tagen')
    expect(de.body).toContain('auf das Konto 19-2000145399/0800 mit der Zahlungsreferenz 20260008')
    const sk = composeEmail({ ...inv, language: 'sk' }, settings, 'invoice', '2026-10-18')
    expect(sk.subject).toBe('Faktúra 20260008')
    expect(sk.body).toContain('so splatnosťou 15. 9. 2026')
  })
})
