import type { Better, ResultRow } from './types'
import { isBetter, todayISO } from './constants'

/** One athlete's history on one drill/exercise (+unit). */
export interface Track {
  key: string; label: string; unit: string; better: Better; categoryId: number | null
  points: { date: string; value: number }[]
  first: number; firstDate: string; latest: number; latestDate: string
  best: number; bestDate: string
  /** Improvement first → latest, in %, positive = better (null if only one result). */
  pct: number | null
}

export function pctChange(first: number, latest: number, better: Better) {
  if (!first) return null
  return ((better === 'lower' ? first - latest : latest - first) / Math.abs(first)) * 100
}

export const fmtPct = (p: number) => `${p > 0 ? '+' : ''}${p.toFixed(1)}%`
export const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)

/** Rows must be sorted by session_date ascending. */
export function buildTracks(rows: ResultRow[]): Track[] {
  const m = new Map<string, Track>()
  for (const r of rows) {
    const v = Number(r.value)
    let t = m.get(r.measure_key)
    if (!t) {
      t = { key: r.measure_key, label: r.label, unit: r.unit, better: r.better, categoryId: r.category_id, points: [],
            first: v, firstDate: r.session_date, latest: v, latestDate: r.session_date, best: v, bestDate: r.session_date, pct: null }
      m.set(r.measure_key, t)
    }
    t.points.push({ date: r.session_date, value: v })
    t.latest = v; t.latestDate = r.session_date; t.label = r.label
    if (isBetter(v, t.best, t.better)) { t.best = v; t.bestDate = r.session_date }
  }
  const out = [...m.values()]
  out.forEach((t) => { t.pct = t.points.length > 1 ? pctChange(t.first, t.latest, t.better) : null })
  return out.sort((a, b) => a.label.localeCompare(b.label))
}

export const PERIODS = [
  { value: 0, label: 'All time' },
  { value: 30, label: 'Last 30 days' },
  { value: 90, label: 'Last 90 days' },
]

/** ISO date `days` ago, or '' for all time. */
export function cutoffFor(days: number) {
  if (!days) return ''
  const d = new Date(todayISO() + 'T00:00:00')
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}

/** Plain-language description of a change, e.g. "4.2% faster" or "6 more reps". */
export function describeChange(t: Track) {
  if (t.pct == null) return ''
  const diff = Math.abs(t.latest - t.first)
  const pct = Math.abs(t.pct).toFixed(1)
  if (t.pct === 0) return 'no change'
  const up = t.pct > 0
  if (t.unit === 'seconds' && t.better === 'lower') return `${pct}% ${up ? 'faster' : 'slower'}`
  if (t.unit === 'seconds') return `${pct}% ${up ? 'longer' : 'shorter'}`
  const word = t.unit === 'reps' ? 'reps' : t.unit
  return `${up ? '+' : '−'}${+diff.toFixed(2)} ${word} (${pct}% ${up ? 'better' : 'lower'})`
}
