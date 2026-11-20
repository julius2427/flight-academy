import type { Athlete, ResultRow } from '../lib/types'
import { CATEGORIES, ageFrom, fmtDate, fmtNum, unitShort } from '../lib/constants'
import { avg, buildTracks, describeChange, fmtPct, type Track } from '../lib/growth'

/** Tiny single-series trend line; the personal best is ringed. */
function Spark({ t }: { t: Track }) {
  const w = 110, h = 28, p = 4
  const vs = t.points.map((x) => x.value)
  if (vs.length < 2) return <span className="muted small">—</span>
  const lo = Math.min(...vs), hi = Math.max(...vs), span = hi - lo || 1
  const x = (i: number) => p + (i / (vs.length - 1)) * (w - 2 * p)
  const y = (v: number) => p + (1 - (v - lo) / span) * (h - 2 * p)
  const bi = vs.findIndex((v) => v === t.best)
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="spark" aria-hidden="true">
      <path d={vs.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('')} fill="none" stroke="var(--chart-line)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(bi)} cy={y(vs[bi])} r={3.5} fill="var(--surface)" stroke="var(--chart-line)" strokeWidth={2} />
      <circle cx={x(vs.length - 1)} cy={y(vs[vs.length - 1])} r={2.5} fill="var(--chart-line)" />
    </svg>
  )
}

/**
 * One athlete's growth report. Rendered on screen and printed one per page.
 * `rows` = this athlete's results in the period (sorted by date).
 */
export default function AthleteReport({ athlete: a, rows, attended, sessionsHeld, periodLabel }: {
  athlete: Athlete; rows: ResultRow[]; attended: number; sessionsHeld: number; periodLabel: string
}) {
  const tracks = buildTracks(rows)
  const compared = tracks.filter((t) => t.pct != null)
  const improved = compared.filter((t) => t.pct! > 0)
  const highlights = [...improved].sort((p, q) => q.pct! - p.pct!).slice(0, 3)
  const cats = CATEGORIES.map((c) => {
    const ts = compared.filter((t) => t.categoryId === c.id)
    return { ...c, n: ts.length, avg: avg(ts.map((t) => t.pct!)), up: ts.filter((t) => t.pct! > 0).length }
  }).filter((c) => c.n > 0)
  const maxCat = Math.max(1, ...cats.map((c) => Math.abs(c.avg)))
  const age = ageFrom(a.birth_date)
  const range = rows.length ? `${fmtDate(rows[0].session_date)} – ${fmtDate(rows[rows.length - 1].session_date)}` : periodLabel

  return (
    <article className="report-page card">
      <header className="report-head">
        <img src="./logo.png" alt="" className="report-logo" />
        <div className="report-title">
          <div className="eyebrow" style={{ margin: 0 }}>Flight Academy · Athlete growth report</div>
          <h2 style={{ margin: '.1rem 0' }}>{a.first_name} {a.last_name}</h2>
          <div className="muted small">
            {[age != null && `Age ${age}`, a.grade && `Grade ${a.grade}`, a.team_group, a.sport, a.position].filter(Boolean).join(' · ')}
          </div>
        </div>
        <div className="report-meta muted small">
          <div>{range}</div>
          <div>Generated {fmtDate(new Date().toISOString())}</div>
        </div>
      </header>

      {rows.length === 0 ? <p className="muted" style={{ marginTop: '1rem' }}>No results recorded in this period.</p> : <>
        <div className="report-tiles">
          <div><b>{attended}<small>/{sessionsHeld}</small></b><span>Sessions attended</span></div>
          <div><b>{tracks.length}</b><span>Drills tracked</span></div>
          <div><b>{improved.length}<small>/{compared.length}</small></b><span>Improved</span></div>
          <div className="tile-hero"><b>{compared.length ? fmtPct(avg(compared.map((t) => t.pct!))) : '—'}</b><span>Avg improvement</span></div>
        </div>

        {highlights.length > 0 && (
          <div className="report-highlights">
            <strong>Highlights</strong>
            <ul>
              {highlights.map((t) => (
                <li key={t.key}><b>{t.label}:</b> {fmtNum(t.first)} → {fmtNum(t.latest)} {unitShort(t.unit)} ({describeChange(t)})</li>
              ))}
            </ul>
          </div>
        )}

        {cats.length > 0 && (
          <section className="report-section">
            <h3>Growth by development category</h3>
            <div className="bars">
              {cats.map((c) => (
                <div className="bar-row" key={c.id}>
                  <div className="bar-label"><span className="cat-num">{c.id}</span>{c.name}</div>
                  <div className="bar-track"><div className={`bar-fill ${c.avg < 0 ? 'neg' : ''}`} style={{ width: `${(Math.abs(c.avg) / maxCat) * 100}%` }} /></div>
                  <div className="bar-value">{fmtPct(c.avg)}<span className="muted"> · {c.up}/{c.n}</span></div>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="report-section">
          <h3>Results &amp; personal bests</h3>
          <div className="table-wrap">
            <table className="report-table">
              <thead><tr>
                <th>Drill / exercise</th><th className="num hide-sm">First</th><th className="num">Latest</th>
                <th className="num">Best</th><th className="num">Change</th><th className="hide-sm">Trend</th>
              </tr></thead>
              <tbody>
                {tracks.map((t) => (
                  <tr key={t.key}>
                    <td><strong>{t.label}</strong><div className="muted small">{t.better === 'lower' ? '↓' : '↑'} better · {t.points.length}×</div></td>
                    <td className="num hide-sm">{fmtNum(t.first)}<div className="muted small">{t.firstDate.slice(5).replace('-', '/')}</div></td>
                    <td className="num">{fmtNum(t.latest)}<div className="muted small">{t.latestDate.slice(5).replace('-', '/')}</div></td>
                    <td className="num"><b>{fmtNum(t.best)}</b> <span className="muted small">{unitShort(t.unit)}</span></td>
                    <td className="num">{t.pct == null ? <span className="muted">—</span> :
                      <span className={`tag ${t.pct > 0 ? 'tag-good' : t.pct < 0 ? 'tag-bad' : 'tag-gray'}`}>{t.pct > 0 ? '▲' : t.pct < 0 ? '▼' : '='} {fmtPct(t.pct)}</span>}</td>
                    <td className="hide-sm"><Spark t={t} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="muted small report-note" style={{ marginTop: '.4rem' }}>
            Change compares first and latest results in this period; ▲ = improved. Timed drills improve when the time goes down.
          </p>
        </section>
      </>}

      <section className="report-comments">
        <strong>Coach comments</strong>
        <div className="line" /><div className="line" />
      </section>
    </article>
  )
}
