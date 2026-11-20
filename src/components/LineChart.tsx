import { useEffect, useMemo, useRef, useState } from 'react'
import type { Better } from '../lib/types'
import { fmtDate, fmtNum } from '../lib/constants'

export interface Point { date: string; value: number }

/** Single-series progress line. Brand-blue 2px line, ≥8px markers, recessive grid,
 *  crosshair + tooltip on hover/touch, personal best ringed. */
export default function LineChart({ points, unit, better, label }: { points: Point[]; unit: string; better: Better; label: string }) {
  const wrap = useRef<HTMLDivElement>(null)
  const [w, setW] = useState(600)
  const [hover, setHover] = useState<number | null>(null)

  useEffect(() => {
    const el = wrap.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setW(Math.max(260, e.contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const h = 220
  const m = { t: 16, r: 16, b: 28, l: 44 }
  const geo = useMemo(() => {
    const ts = points.map((p) => new Date(p.date + 'T00:00:00').getTime())
    const vs = points.map((p) => p.value)
    let t0 = Math.min(...ts), t1 = Math.max(...ts)
    if (t0 === t1) { t0 -= 864e5 * 3; t1 += 864e5 * 3 }
    let v0 = Math.min(...vs), v1 = Math.max(...vs)
    const pad = (v1 - v0) * 0.15 || Math.abs(v1) * 0.1 || 1
    v0 -= pad; v1 += pad
    if (Math.min(...vs) >= 0 && v0 < 0) v0 = 0
    const step = niceStep((v1 - v0) / 4)
    const ticks: number[] = []
    for (let v = Math.ceil(v0 / step) * step; v <= v1 + 1e-9; v += step) ticks.push(+v.toFixed(6))
    const x = (t: number) => m.l + ((t - t0) / (t1 - t0)) * (w - m.l - m.r)
    const y = (v: number) => m.t + (1 - (v - v0) / (v1 - v0)) * (h - m.t - m.b)
    const xs = ts.map(x), ys = vs.map(y)
    let best = 0
    vs.forEach((v, i) => { if (better === 'lower' ? v < vs[best] : v > vs[best]) best = i })
    return { xs, ys, ticks, y, best }
  }, [points, w, better])

  if (points.length === 0) return null
  const d = geo.xs.map((x, i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${geo.ys[i].toFixed(1)}`).join('')

  function onMove(clientX: number) {
    const rect = wrap.current!.getBoundingClientRect()
    const px = clientX - rect.left
    let k = 0
    geo.xs.forEach((x, i) => { if (Math.abs(x - px) < Math.abs(geo.xs[k] - px)) k = i })
    setHover(k)
  }

  const firstLabel = fmtDate(points[0].date), lastLabel = fmtDate(points[points.length - 1].date)
  return (
    <div ref={wrap} style={{ position: 'relative' }}
      onMouseMove={(e) => onMove(e.clientX)} onMouseLeave={() => setHover(null)}
      onTouchStart={(e) => onMove(e.touches[0].clientX)} onTouchMove={(e) => onMove(e.touches[0].clientX)}>
      <svg className="chart" viewBox={`0 0 ${w} ${h}`} width={w} height={h} role="img"
        aria-label={`${label} over time, ${points.length} results from ${firstLabel} to ${lastLabel}. ${better === 'lower' ? 'Lower' : 'Higher'} is better.`}>
        {geo.ticks.map((t) => (
          <g key={t}>
            <line x1={m.l} x2={w - m.r} y1={geo.y(t)} y2={geo.y(t)} stroke="var(--chart-grid)" strokeWidth={1} />
            <text x={m.l - 8} y={geo.y(t)} dy="0.32em" textAnchor="end" fontSize="11" fill="var(--ink-3)">{fmtNum(t)}</text>
          </g>
        ))}
        <text x={m.l} y={h - 8} fontSize="11" fill="var(--ink-3)">{firstLabel}</text>
        {points.length > 1 && <text x={w - m.r} y={h - 8} fontSize="11" fill="var(--ink-3)" textAnchor="end">{lastLabel}</text>}
        {hover != null && <line x1={geo.xs[hover]} x2={geo.xs[hover]} y1={m.t} y2={h - m.b} stroke="var(--line-strong)" strokeDasharray="3 3" />}
        <path d={d} fill="none" stroke="var(--chart-line)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {geo.xs.map((x, i) => (
          <circle key={i} cx={x} cy={geo.ys[i]} r={i === geo.best ? 6 : 4.5}
            fill={i === geo.best ? 'var(--surface)' : 'var(--chart-line)'}
            stroke={i === geo.best ? 'var(--chart-line)' : 'var(--surface)'} strokeWidth={2} />
        ))}
      </svg>
      {hover != null && (
        <div className="chart-tip" style={{ left: geo.xs[hover], top: geo.ys[hover] - 6 }}>
          <strong>{fmtNum(points[hover].value)} {unit}</strong> · {fmtDate(points[hover].date)}{hover === geo.best && ' · PB'}
        </div>
      )}
    </div>
  )
}

function niceStep(raw: number) {
  const p = Math.pow(10, Math.floor(Math.log10(raw || 1)))
  const f = raw / p
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p
}
