import { FileUp, Landmark, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { decodeStatement, matchPayments, parseStatement, sortMatches, StatementError, type MatchResult, type StatementFormat } from '@/domain/bank'
import { today } from '@/domain/id'
import { amountDue } from '@/domain/invoice'
import { useStore } from '@/state/store'
import { StatusBadge, useFormat } from '@/ui/format'
import { Button, Card, cn } from '@/ui/primitives'

type Read = { file: string; format: StatementFormat; credits: number; result: MatchResult }

/**
 * Reads a bank statement chosen by the user and offers to mark the invoices it pays. The file is read in the browser
 * and forgotten when the dialog closes; nothing is sent or stored (docs/bank-import.md).
 */
export function BankImport({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()
  const f = useFormat()
  const { invoices, upsertInvoices } = useStore()
  const on = today()
  const input = useRef<HTMLInputElement>(null)
  const [read, setRead] = useState<Read>()
  const [error, setError] = useState<string>()
  const [done, setDone] = useState<number>()
  // Ticked: payments to apply, by index in `matches`. A different amount stays unticked until the user decides.
  const [ticked, setTicked] = useState<Set<number>>(new Set())

  const matches = useMemo(() => (read ? sortMatches(read.result.matches, on) : []), [read, on])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function choose(file: File | undefined) {
    if (!file) return
    setError(undefined)
    setDone(undefined)
    try {
      const { format, payments } = parseStatement(decodeStatement(new Uint8Array(await file.arrayBuffer())))
      const result = matchPayments(payments, invoices)
      setRead({ file: file.name, format, credits: payments.length, result })
      const sorted = sortMatches(result.matches, on)
      setTicked(new Set(sorted.flatMap((m, i) => (m.kind === 'amountDiffers' ? [] : [i]))))
    } catch (e) {
      setRead(undefined)
      setError(t(`bank.error.${e instanceof StatementError ? e.reason : 'unknown'}`))
    } finally {
      if (input.current) input.current.value = ''
    }
  }

  function apply() {
    const chosen = matches.filter((_, i) => ticked.has(i))
    upsertInvoices(chosen.map(({ invoice, payment }) => ({ ...invoice, status: 'paid', paidDate: payment.date || on, paidAmount: payment.amount })))
    setDone(chosen.length)
    setRead(undefined)
  }

  const toggle = (i: number) => setTicked((s) => { const n = new Set(s); if (n.has(i)) n.delete(i); else n.add(i); return n })
  const money = (m: number, c: string) => f.money(m, c)

  // Portal: the animated page container would otherwise trap this fixed overlay.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-scrim/50 p-6 backdrop-blur-sm" onClick={onClose}>
      <Card className="animate-rise flex max-h-full w-full max-w-4xl flex-col overflow-hidden">
        <div className="flex items-center gap-2 border-b border-line px-5 py-3" onClick={(e) => e.stopPropagation()}>
          <Landmark aria-hidden="true" className="size-4 text-fg-muted" />
          <h2 className="font-medium">{t('bank.title')}</h2>
          <Button size="sm" variant="ghost" className="ml-auto" aria-label={t('common.close')} onClick={onClose}><X className="size-4" /></Button>
        </div>

        <div className="flex-1 space-y-5 overflow-auto p-5" onClick={(e) => e.stopPropagation()}>
          {!read && (
            <div className="space-y-3">
              <p className="max-w-prose text-sm">{t('bank.intro')}</p>
              <p className="max-w-prose text-xs text-fg-muted">{t('bank.privacy')}</p>
              <input ref={input} type="file" accept=".gpc,.abo,.txt,.csv,.xml" className="hidden" onChange={(e) => void choose(e.target.files?.[0])} />
              <Button onClick={() => input.current?.click()}><FileUp className="size-4" /> {t('bank.choose')}</Button>
              {error && <p role="alert" className="max-w-prose text-sm font-medium text-danger">{error}</p>}
              {done !== undefined && <p role="status" className="text-sm font-medium text-success">{t('bank.done', { count: done })}</p>}
            </div>
          )}

          {read && (
            <>
              <p className="text-sm">
                {t('bank.summary', { file: read.file, format: t(`bank.format.${read.format}`), count: read.credits })}{' '}
                <strong className="font-semibold">{t('bank.matched', { count: matches.length })}</strong>
              </p>

              {matches.length > 0 && (
                <table className="w-full text-sm">
                  <thead className="text-left text-xs text-fg-muted">
                    <tr>
                      <th className="w-8 py-2" />
                      <th className="py-2 pr-3 font-medium">{t('bank.payment')}</th>
                      <th className="py-2 pr-3 font-medium">{t('bank.invoice')}</th>
                      <th className="py-2 text-right font-medium">{t('bank.amount')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {matches.map((m, i) => (
                      <tr key={i} className="border-t border-line align-top">
                        <td className="py-2.5">
                          <input type="checkbox" aria-label={t('bank.apply', { number: m.invoice.number })} checked={ticked.has(i)} onChange={() => toggle(i)}
                            className="size-4 cursor-pointer accent-link" />
                        </td>
                        <td className="py-2.5 pr-3">
                          <div className="font-medium">{m.payment.name || t('bank.noName')}</div>
                          <div className="text-xs text-fg-muted tabular-nums">{m.payment.date && f.date(m.payment.date)}{m.payment.vs && ` · VS ${m.payment.vs}`}</div>
                        </td>
                        <td className="py-2.5 pr-3">
                          <div className="flex items-center gap-2"><span className="tabular-nums">{m.invoice.number}</span><StatusBadge status={m.invoice.status === 'issued' && m.invoice.dueDate < on ? 'overdue' : 'issued'} /></div>
                          <div className="text-xs text-fg-muted">{m.invoice.customerSnapshot.name}</div>
                          {m.kind === 'amountDiffers' && <div className="text-xs font-medium text-warning">{t('bank.amountDiffers', { due: money(amountDue(m.invoice), m.invoice.currency) })}</div>}
                          {m.kind === 'byAmount' && <div className="text-xs text-fg-muted">{t('bank.byAmount')}</div>}
                        </td>
                        <td className={cn('py-2.5 text-right tabular-nums', m.kind === 'amountDiffers' && 'text-warning')}>{money(m.payment.amount, m.payment.currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {read.result.alreadyPaid.length > 0 && (
                <p className="text-xs text-fg-muted">{t('bank.alreadyPaid', { count: read.result.alreadyPaid.length, numbers: read.result.alreadyPaid.map((p) => p.invoice.number).join(', ') })}</p>
              )}
              {read.result.unmatched.length > 0 && (
                <details className="text-sm">
                  <summary className="cursor-pointer text-fg-muted">{t('bank.unmatched', { count: read.result.unmatched.length })}</summary>
                  <ul className="mt-2 space-y-1 text-xs text-fg-muted">
                    {read.result.unmatched.map((p, i) => (
                      <li key={i} className="tabular-nums">{p.date && f.date(p.date)} · {money(p.amount, p.currency)} · {p.name || t('bank.noName')}{p.vs && ` · VS ${p.vs}`}{p.message && ` · ${p.message}`}</li>
                    ))}
                  </ul>
                  <p className="mt-2 max-w-prose text-xs text-fg-muted">{t('bank.unmatchedHint')}</p>
                </details>
              )}
            </>
          )}
        </div>

        {read && (
          <div className="flex items-center justify-end gap-2 border-t border-line px-5 py-3" onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" onClick={() => setRead(undefined)}>{t('bank.another')}</Button>
            <Button disabled={ticked.size === 0} onClick={apply}>{t('bank.markPaid', { count: ticked.size })}</Button>
          </div>
        )}
      </Card>
    </div>,
    document.body,
  )
}
