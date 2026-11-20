import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { Athlete, Better, ResultRow } from '../lib/types'
import { CATEGORIES, fmtDate, fmtNum, isBetter, todayISO, unitShort } from '../lib/constants'
import { ErrorNote, PageHead, Spinner } from '../components/Ui'

/** One athlete's history on one drill/exercise+unit. */
interface Track {
  athleteId: string; key: string; label: string; unit: string; better: Better; categoryId: number | null
  first: number; latest: number; best: number; n: number; pct: number | null
}

const PERIODS = [
  { value: 0, label: 'All time' },
  { value: 30, label: 'Last 30 days' },
  { value: 90, label: 'Last 90 days' },
]

/** % improvement from first to latest, positive = better regardless of direction. */
function pctChange(first: number, latest: number, better: Better) {
  if (!first) return null
  return ((better === 'lower' ? first - latest : latest - first) / Math.abs(first)) * 100
}
const fmtPct = (p: number) => `${p > 0 ? '+' : ''}${p.toFixed(1)}%`
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)

export default function Reports() {
  const [rows, setRows] = useState<ResultRow[] | null>(null)
  const [athletes, setAthletes] = useState<Athlete[]>([])
  const [sessions, setSessions] = useState<{ id: string; session_date: string }[]>([])
  const [attendance, setAttendance] = useState<{ session_id: string; athlete_id: string }[]>([])
  const [group, setGroup] = useState('')
  const [period, setPeriod] = useState(0)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      supabase.from('athlete_results').select('*').order('session_date'),
      supabase.from('athletes').select('*'),
      supabase.from('sessions').select('id, session_date').order('session_date'),
      supabase.from('session_athletes').select('session_id, athlete_id'),
    ]).then(([r, a, s, sa]) => {
      const err = r.error || a.error || s.error || sa.error
      if (err) setError(err.message)
      setRows((r.data as ResultRow[]) ?? [])
      setAthletes((a.data as Athlete[]) ?? [])
      setSessions(s.data ?? [])
      setAttendance(sa.data ?? [])
    })
  }, [])

  const groups = useMemo(() => [...new Set(athletes.map((a) => a.team_group).filter(Boolean))].sort() as string[], [athletes])

  const r = useMemo(() => {
    if (!rows) return null
    const cutoff = period ? (() => { const d = new Date(todayISO() + 'T00:00:00'); d.setDate(d.getDate() - period); return d.toISOString().slice(0, 10) })() : ''
    const inGroup = new Set(athletes.filter((a) => !group || a.team_group === group).map((a) => a.id))
    const byId = new Map(athletes.map((a) => [a.id, a]))
    const res = rows.filter((x) => inGroup.has(x.athlete_id) && x.session_date >= cutoff)
    const sess = sessions.filter((s) => s.session_date >= cutoff)
    const sessIds = new Set(sess.map((s) => s.id))
    const att = attendance.filter((x) => sessIds.has(x.session_id) && inGroup.has(x.athlete_id))

    // Build tracks (athlete × measure)
    const tm = new Map<string, Track>()
    for (const x of res) {
      const k = `${x.athlete_id}|${x.measure_key}`
      const v = Number(x.value)
      let t = tm.get(k)
      if (!t) {
        t = { athleteId: x.athlete_id, key: x.measure_key, label: x.label, unit: x.unit, better: x.better, categoryId: x.category_id, first: v, latest: v, best: v, n: 0, pct: null }
        tm.set(k, t)
      }
      t.n++; t.latest = v; t.label = x.label
      if (isBetter(v, t.best, t.better)) t.best = v
    }
    const tracks = [...tm.values()]
    tracks.forEach((t) => { t.pct = t.n > 1 ? pctChange(t.first, t.latest, t.better) : null })
    const compared = tracks.filter((t) => t.pct != null)
    const improved = compared.filter((t) => t.pct! > 0)

    // By category
    const cats = CATEGORIES.map((c) => {
      const ts = compared.filter((t) => t.categoryId === c.id)
      return { ...c, n: ts.length, avg: avg(ts.map((t) => t.pct!)), improving: ts.filter((t) => t.pct! > 0).length }
    }).filter((c) => c.n > 0)

    // By measure (drill/exercise + unit)
    const mm = new Map<string, Track[]>()
    tracks.forEach((t) => mm.set(t.key, [...(mm.get(t.key) ?? []), t]))
    const measures = [...mm.entries()].map(([key, ts]) => {
      const leader = ts.reduce((a, b) => (isBetter(b.best, a.best, b.better) ? b : a))
      const cmp = ts.filter((t) => t.pct != null)
      return {
        key, label: ts[0].label, unit: ts[0].unit, better: ts[0].better,
        athletes: ts.length, results: ts.reduce((s, t) => s + t.n, 0),
        avgFirst: avg(cmp.map((t) => t.first)), avgLatest: avg(cmp.map((t) => t.latest)),
        avgPct: cmp.length ? avg(cmp.map((t) => t.pct!)) : null,
        leader: { name: byId.get(leader.athleteId), value: leader.best },
      }
    }).sort((a, b) => b.results - a.results)

    // Most improved athletes (need 2+ compared measures)
    const am = new Map<string, number[]>()
    compared.forEach((t) => am.set(t.athleteId, [...(am.get(t.athleteId) ?? []), t.pct!]))
    const mostImproved = [...am.entries()].filter(([, ps]) => ps.length >= 2)
      .map(([id, ps]) => ({ athlete: byId.get(id)!, avg: avg(ps), up: ps.filter((p) => p > 0).length, of: ps.length }))
      .filter((x) => x.athlete).sort((a, b) => b.avg - a.avg).slice(0, 5)

    // Attendance by session
    const perSession = sess.map((s) => ({ ...s, count: att.filter((x) => x.session_id === s.id).length })).filter((s) => s.count > 0)

    return {
      activeAthletes: athletes.filter((a) => a.active && inGroup.has(a.id)).length,
      sessions: perSession.length, results: res.length,
      avgAttendance: avg(perSession.map((s) => s.count)),
      improvedShare: compared.length ? (improved.length / compared.length) * 100 : null,
      avgPct: compared.length ? avg(compared.map((t) => t.pct!)) : null,
      cats, measures, mostImproved, perSession,
      range: res.length ? [res[0].session_date, res[res.length - 1].session_date] : null,
    }
  }, [rows, athletes, sessions, attendance, group, period])

  if (!r) return error ? <ErrorNote error={error} /> : <Spinner />

  const maxCat = Math.max(1, ...r.cats.map((c) => Math.abs(c.avg)))
  const maxAtt = Math.max(1, ...r.perSession.map((s) => s.count))

  return (
    <>
      <PageHead title="Program report"
        sub={r.range ? `${fmtDate(r.range[0])} – ${fmtDate(r.range[1])}${group ? ` · ${group}` : ''}` : 'Development summary'}
        actions={<button className="btn" onClick={() => window.print()}>Print</button>} />
      <ErrorNote error={error} />

      <div className="row" style={{ marginBottom: '1rem' }}>
        <select className="select" style={{ width: 'auto' }} value={group} onChange={(e) => setGroup(e.target.value)} aria-label="Group">
          <option value="">All groups</option>
          {groups.map((g) => <option key={g}>{g}</option>)}
        </select>
        <div className="chips" role="group" aria-label="Time period">
          {PERIODS.map((p) => <button key={p.value} className="chip" aria-pressed={period === p.value} onClick={() => setPeriod(p.value)}>{p.label}</button>)}
        </div>
      </div>

      {r.results === 0 ? <div className="card empty">No results in this view yet. Score a session to see the report.</div> : <>
        <div className="stats report-stats">
          <div className="stat"><b>{r.activeAthletes}</b><span>Active athletes</span></div>
          <div className="stat"><b>{r.sessions}</b><span>Sessions</span></div>
          <div className="stat"><b>{fmtNum(Math.round(r.avgAttendance * 10) / 10)}</b><span>Avg athletes / session</span></div>
          <div className="stat"><b>{r.results}</b><span>Results recorded</span></div>
          <div className="stat stat-hero"><b>{r.improvedShare == null ? '—' : `${Math.round(r.improvedShare)}%`}</b><span>of tracked results improved</span></div>
          <div className="stat stat-hero"><b>{r.avgPct == null ? '—' : fmtPct(r.avgPct)}</b><span>Avg improvement, first → latest</span></div>
        </div>

        <div className="grid-2" style={{ marginTop: '1rem' }}>
          <div className="card">
            <h2>Improvement by category</h2>
            <p className="muted small">Average change from each athlete’s first to latest result, in the improving direction.</p>
            {r.cats.length === 0 ? <p className="muted">Needs at least two results per athlete.</p> : (
              <div className="bars">
                {r.cats.map((c) => (
                  <div className="bar-row" key={c.id} title={`${c.name}: ${fmtPct(c.avg)} avg across ${c.n} athlete results; ${c.improving} improved`}>
                    <div className="bar-label"><span className="cat-num">{c.id}</span>{c.name}</div>
                    <div className="bar-track">
                      <div className={`bar-fill ${c.avg < 0 ? 'neg' : ''}`} style={{ width: `${(Math.abs(c.avg) / maxCat) * 100}%` }} />
                    </div>
                    <div className="bar-value">{fmtPct(c.avg)}<span className="muted"> · {c.improving}/{c.n}</span></div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card">
            <h2>Most improved athletes</h2>
            <p className="muted small">Average improvement across every drill/exercise they were tested on twice or more.</p>
            {r.mostImproved.length === 0 ? <p className="muted">Not enough repeat results yet.</p> : (
              <ol className="leaders">
                {r.mostImproved.map((m) => (
                  <li key={m.athlete.id}>
                    <Link to={`/app/athletes/${m.athlete.id}`}><strong>{m.athlete.first_name} {m.athlete.last_name}</strong></Link>
                    {m.athlete.team_group && <span className="tag tag-gray">{m.athlete.team_group}</span>}
                    <span className="leader-val"><span className="tag tag-good">{fmtPct(m.avg)}</span> <span className="muted small">{m.up}/{m.of} up</span></span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>

        <div className="card" style={{ marginTop: '1rem' }}>
          <h2>Results by drill / exercise</h2>
          <div className="measure-cards">
            {r.measures.map((m) => (
              <div className="measure-card" key={m.key}>
                <div className="spread">
                  <strong>{m.label}</strong>
                  {m.avgPct != null && <span className={`tag ${m.avgPct > 0 ? 'tag-good' : m.avgPct < 0 ? 'tag-bad' : 'tag-gray'}`}>{m.avgPct > 0 ? '▲' : m.avgPct < 0 ? '▼' : '='} {fmtPct(m.avgPct)}</span>}
                </div>
                <div className="muted small">{m.unit} · {m.better} is better · {m.athletes} athletes</div>
                <div className="measure-card-stats">
                  {m.avgPct != null && <span>Avg <b>{fmtNum(+m.avgFirst.toFixed(2))}</b> → <b>{fmtNum(+m.avgLatest.toFixed(2))}</b> {unitShort(m.unit)}</span>}
                  <span>Top <b>{fmtNum(m.leader.value)} {unitShort(m.unit)}</b>{m.leader.name ? ` · ${m.leader.name.first_name} ${m.leader.name.last_name[0]}.` : ''}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="table-wrap measure-table">
            <table>
              <thead><tr>
                <th>Drill / exercise</th><th className="num">Athletes</th><th className="num">Group avg first</th>
                <th className="num">Group avg latest</th><th className="num">Avg change</th><th>Top result</th>
              </tr></thead>
              <tbody>
                {r.measures.map((m) => (
                  <tr key={m.key}>
                    <td><strong>{m.label}</strong><div className="muted small">{m.unit} · {m.better} is better</div></td>
                    <td className="num">{m.athletes}</td>
                    <td className="num">{m.avgPct == null ? '—' : `${fmtNum(+m.avgFirst.toFixed(2))} ${unitShort(m.unit)}`}</td>
                    <td className="num">{m.avgPct == null ? '—' : `${fmtNum(+m.avgLatest.toFixed(2))} ${unitShort(m.unit)}`}</td>
                    <td className="num">{m.avgPct == null ? <span className="muted">—</span> :
                      <span className={`tag ${m.avgPct > 0 ? 'tag-good' : m.avgPct < 0 ? 'tag-bad' : 'tag-gray'}`}>{m.avgPct > 0 ? '▲' : m.avgPct < 0 ? '▼' : '='} {fmtPct(m.avgPct)}</span>}</td>
                    <td>{fmtNum(m.leader.value)} {unitShort(m.unit)} <span className="muted small">· {m.leader.name ? `${m.leader.name.first_name} ${m.leader.name.last_name[0]}.` : ''}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {r.perSession.length > 1 && (
          <div className="card" style={{ marginTop: '1rem' }}>
            <h2>Attendance by session</h2>
            <div className="cols" role="img" aria-label={`Athletes per session, from ${r.perSession[0].count} to ${r.perSession[r.perSession.length - 1].count}`}>
              {r.perSession.map((s) => (
                <div className="col" key={s.id} title={`${fmtDate(s.session_date)}: ${s.count} athletes`}>
                  <span className="col-val">{s.count}</span>
                  <div className="col-bar" style={{ height: `${(s.count / maxAtt) * 100}%` }} />
                  <span className="col-lbl">{s.session_date.slice(5).replace('-', '/')}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        <p className="muted small" style={{ marginTop: '1rem' }}>
          “Improved” compares each athlete’s first and latest result on the same drill/exercise in this view.
          Timed drills improve when the number goes down; reps, distance, and holds improve when it goes up.
        </p>
      </>}
    </>
  )
}
