import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { cn } from './primitives'

export interface BarSeries {
  key: string
  label: string
  /** CSS color, normally a var(--color-series-N) token. */
  color: string
  /** One value per category; null = no bar (e.g. a month that hasn't happened yet). */
  values: (number | null)[]
}

interface Props {
  categories: string[]
  series: BarSeries[]
  /** Short axis/cap labels. */
  formatAxis: (v: number) => string
  /** Full values for the tooltip and table. */
  formatValue: (v: number) => string
  /** Category indexes drawn with a striped texture (e.g. the year in progress), with a note in the tooltip. */
  partial?: { indexes: number[]; note: string }
  /** Category indexes whose value is written on the bar cap (selective direct labels). */
  labelIndexes?: number[]
  /** Extra lines per category for the tooltip. */
  tooltipExtra?: (i: number) => string | undefined
  tableLabel: string
  chartLabel: string
  /** Shorter category text for the x axis (the tooltip and table keep the full text). */
  tickFormat?: (category: string) => string
  height?: number
}

const M = { top: 16, right: 4, bottom: 24, left: 52 }
const BAR_MAX = 24
const GAP = 2
const RADIUS = 2

function niceTicks(max: number, count = 4): number[] {
  if (max <= 0) return [0]
  const raw = max / count
  const pow = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= raw)!
  const ticks: number[] = []
  for (let v = 0; v <= max + step * 0.001; v += step) ticks.push(v)
  if (ticks.at(-1)! < max) ticks.push(ticks.at(-1)! + step)
  return ticks
}

/** A column with a 2px rounded data-end and a square baseline. */
function columnPath(x: number, y: number, w: number, h: number) {
  const r = Math.min(RADIUS, w / 2, h)
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`
}

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, width] as const
}

export function BarChart({ categories, series, formatAxis, formatValue, partial, labelIndexes = [], tooltipExtra, tableLabel, chartLabel, tickFormat = (c) => c, height = 220 }: Props) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const [hover, setHover] = useState<number>()
  const [table, setTable] = useState(false)
  const patternId = useId().replace(/:/g, '')

  const max = useMemo(() => Math.max(0, ...series.flatMap((s) => s.values.map((v) => v ?? 0))), [series])
  const ticks = niceTicks(max)
  const top = ticks.at(-1) || 1
  const plotW = Math.max(0, width - M.left - M.right)
  const plotH = height - M.top - M.bottom
  const band = categories.length ? plotW / categories.length : 0
  const barW = Math.max(2, Math.min(BAR_MAX, (band * 0.75 - GAP * (series.length - 1)) / series.length))
  const groupW = barW * series.length + GAP * (series.length - 1)
  const y = (v: number) => M.top + plotH - (v / top) * plotH
  const isPartial = (i: number) => partial?.indexes.includes(i) ?? false
  // Thin out x labels when the bands get narrow.
  const labelEvery = band < 28 ? Math.ceil(28 / Math.max(band, 1)) : 1

  return (
    <div>
      <div className="mb-2 flex min-h-5 items-center justify-end gap-4 text-xs text-fg-muted">
        {series.length > 1 && series.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm" style={{ background: s.color }} /> {s.label}
          </span>
        ))}
        <button onClick={() => setTable((t) => !t)} className="rounded px-1.5 py-0.5 text-fg-subtle transition-colors hover:bg-surface-2 hover:text-fg">
          {table ? chartLabel : tableLabel}
        </button>
      </div>

      {table ? (
        <div className="max-h-60 overflow-auto text-sm">
          <table className="w-full">
            <thead className="text-left text-xs text-fg-muted">
              <tr><th className="py-1 font-medium" />{series.map((s) => <th key={s.key} className="py-1 text-right font-medium">{s.label}</th>)}</tr>
            </thead>
            <tbody className="[&>tr:nth-child(even)]:bg-row-hover">
              {categories.map((c, i) => (
                <tr key={c}>
                  <td className="py-1 text-fg-muted">{c}{isPartial(i) ? ` (${partial!.note})` : ''}</td>
                  {series.map((s) => <td key={s.key} className="py-1 text-right tabular-nums">{s.values[i] == null ? '–' : formatValue(s.values[i]!)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div ref={ref} className="relative" style={{ height }} onMouseLeave={() => setHover(undefined)}>
          {width > 0 && (
            <svg width={width} height={height} className="block overflow-visible">
              <defs>
                {series.map((s) => (
                  <pattern key={s.key} id={`${patternId}-${s.key}`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                    <rect width="6" height="6" fill={s.color} opacity="0.25" />
                    <rect width="2.5" height="6" fill={s.color} />
                  </pattern>
                ))}
              </defs>

              {ticks.map((t) => (
                <g key={t}>
                  <line x1={M.left} x2={width - M.right} y1={y(t)} y2={y(t)} className="stroke-line" strokeWidth={1} />
                  <text x={M.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="fill-fg-subtle text-xs tabular-nums">{formatAxis(t)}</text>
                </g>
              ))}

              {categories.map((c, i) => {
                const x0 = M.left + band * i
                return (
                  <g key={c}>
                    {hover === i && <rect x={x0} y={M.top} width={band} height={plotH} className="fill-surface-2" />}
                    {series.map((s, j) => {
                      const v = s.values[i]
                      if (v == null || v <= 0) return null
                      const bx = x0 + (band - groupW) / 2 + j * (barW + GAP)
                      const by = y(v)
                      return (
                        <path key={s.key} d={columnPath(bx, by, barW, y(0) - by)}
                          fill={isPartial(i) ? `url(#${patternId}-${s.key})` : s.color}
                          className="transition-opacity" opacity={hover === undefined || hover === i ? 1 : 0.55} />
                      )
                    })}
                    {labelIndexes.includes(i) && series.length === 1 && series[0].values[i] ? (
                      <text x={x0 + band / 2} y={y(series[0].values[i]!) - 5} textAnchor="middle" className="fill-fg-muted text-xs font-medium tabular-nums">
                        {formatAxis(series[0].values[i]!)}
                      </text>
                    ) : null}
                    {i % labelEvery === 0 && (
                      <text x={x0 + band / 2} y={height - 6} textAnchor="middle" className={cn('text-xs', hover === i ? 'fill-fg' : 'fill-fg-subtle')}>{tickFormat(c)}</text>
                    )}
                    {/* Hit target: the whole band, bigger than the bars. */}
                    <rect x={x0} y={M.top} width={band} height={plotH + M.bottom} fill="transparent" onMouseEnter={() => setHover(i)} />
                  </g>
                )
              })}
              <line x1={M.left} x2={width - M.right} y1={y(0)} y2={y(0)} className="stroke-fg-subtle" strokeWidth={1} />
            </svg>
          )}

          {hover !== undefined && (
            <div
              className="pointer-events-none absolute z-10 w-52 rounded-lg border border-line bg-surface px-3 py-2 text-xs whitespace-nowrap"
              style={{
                // Keep the 208px-wide tooltip inside the chart.
                left: Math.min(Math.max(M.left + band * hover + band / 2, 104), width - 104),
                top: 0,
                transform: 'translate(-50%, -100%)',
              }}
            >
              <div className="mb-1 font-medium text-fg">
                {categories[hover]}{isPartial(hover) ? <span className="font-normal text-fg-muted"> · {partial!.note}</span> : null}
              </div>
              {series.length === 1 ? (
                <div className="text-sm font-semibold tabular-nums text-fg">{series[0].values[hover] == null ? '–' : formatValue(series[0].values[hover]!)}</div>
              ) : series.map((s) => (
                <div key={s.key} className="flex items-center justify-between gap-4">
                  <span className="inline-flex items-center gap-1.5 text-fg-muted">
                    <span className="size-2 rounded-sm" style={{ background: s.color }} /> {s.label}
                  </span>
                  <span className="font-medium tabular-nums text-fg">{s.values[hover] == null ? '–' : formatValue(s.values[hover]!)}</span>
                </div>
              ))}
              {tooltipExtra?.(hover) && <div className="mt-1 border-t border-line pt-1 text-fg-muted">{tooltipExtra(hover)}</div>}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
