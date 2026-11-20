import { Fragment, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { Athlete, ResultRow } from '../lib/types'
import { CATEGORIES, ageFrom, categoryName, fmtDate, fmtNum, isBetter, unitShort } from '../lib/constants'
import { downloadCsv } from '../lib/csv'
import LineChart from '../components/LineChart'
import { IconDownload, IconTrophy } from '../components/Icons'
import { ErrorNote, PageHead, Spinner } from '../components/Ui'

interface Measure {
  key: string; label: string; unit: string; better: 'higher' | 'lower'; category_id: number | null
  points: { date: string; value: number }[]; first: number; latest: number; best: number; bestDate: string
}

export default function AthleteDetail() {
  const { id } = useParams()
  const [a, setA] = useState<Athlete | null>(null)
  const [rows, setRows] = useState<ResultRow[] | null>(null)
  const [attended, setAttended] = useState<number | null>(null)
  const [open, setOpen] = useState<string | null>(null)
  const [cat, setCat] = useState<number | 0>(0)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    supabase.from('athletes').select('*').eq('id', id).single().then(({ data, error }) => { if (error) setError(error.message); setA(data as Athlete) })
    supabase.from('athlete_results').select('*').eq('athlete_id', id).order('session_date')
      .then(({ data, error }) => { if (error) setError(error.message); setRows((data as ResultRow[]) ?? []) })
    supabase.from('session_athletes').select('*', { count: 'exact', head: true }).eq('athlete_id', id).then(({ count }) => setAttended(count))
  }, [id])

  const measures = useMemo<Measure[]>(() => {
    const m = new Map<string, Measure>()
    for (const r of rows ?? []) {
      let x = m.get(r.measure_key)
      if (!x) {
        x = { key: r.measure_key, label: r.label, unit: r.unit, better: r.better, category_id: r.category_id, points: [], first: r.value, latest: r.value, best: r.value, bestDate: r.session_date }
        m.set(r.measure_key, x)
      }
      x.points.push({ date: r.session_date, value: Number(r.value) })
      x.latest = Number(r.value); x.label = r.label
      if (isBetter(Number(r.value), x.best, x.better)) { x.best = Number(r.value); x.bestDate = r.session_date }
    }
    return [...m.values()].sort((p, q) => p.label.localeCompare(q.label))
  }, [rows])

  if (error && !a) return <ErrorNote error={error} />
  if (!a || !rows) return <Spinner />

  const age = ageFrom(a.birth_date)
  const shown = cat ? measures.filter((x) => x.category_id === cat) : measures
  const catSummary = CATEGORIES.map((c) => {
    const ms = measures.filter((x) => x.category_id === c.id)
    const improving = ms.filter((x) => x.points.length > 1 && isBetter(x.latest, x.first, x.better)).length
    return { ...c, n: ms.length, improving }
  }).filter((c) => c.n > 0)

  function exportCsv() {
    downloadCsv(`${a!.last_name}-${a!.first_name}-results.csv`, [
      ['date', 'drill_or_exercise', 'section', 'value', 'unit', 'better', 'category'],
      ...rows!.map((r) => [r.session_date, r.label, r.section, r.value, r.unit, r.better, categoryName(r.category_id)]),
    ])
  }

  return (
    <>
      <PageHead
        back={{ to: '/app/athletes', label: 'Athletes' }}
        title={`${a.first_name} ${a.last_name}`}
        sub={[age != null && `Age ${age}`, a.grade && `Grade ${a.grade}`, a.school, a.sport, a.position, a.team_group].filter(Boolean).join(' · ')}
        actions={<>
          {rows.length > 0 && <button className="btn" onClick={exportCsv}><IconDownload /> CSV</button>}
          <Link to={`/app/athletes/${a.id}/edit`} className="btn">Edit</Link>
        </>}
      />
      {!a.active && <div className="alert" style={{ marginBottom: '1rem' }}>This athlete is marked inactive.</div>}

      <div className="stats">
        <div className="stat"><b>{attended ?? '–'}</b><span>Sessions attended</span></div>
        <div className="stat"><b>{rows.length}</b><span>Results recorded</span></div>
        <div className="stat"><b>{measures.length}</b><span>Drills/exercises tracked</span></div>
        <div className="stat"><b>{measures.filter((x) => x.points.length > 1 && isBetter(x.latest, x.first, x.better)).length}</b><span>Improving since first test</span></div>
      </div>

      {catSummary.length > 0 && (
        <div className="card" style={{ marginTop: '1.25rem' }}>
          <h2>Development by category</h2>
          <div className="table-wrap" style={{ border: 0 }}>
            <table>
              <thead><tr><th>Category</th><th className="num">Tracked</th><th className="num">Improving</th></tr></thead>
              <tbody>
                {catSummary.map((c) => (
                  <tr key={c.id}>
                    <td><span className="row" style={{ flexWrap: 'nowrap' }}><span className="cat-num">{c.id}</span>{c.name}</span></td>
                    <td className="num">{c.n}</td>
                    <td className="num">{c.improving} of {c.n}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="card" style={{ marginTop: '1.25rem' }}>
        <div className="spread" style={{ marginBottom: '.75rem' }}>
          <h2 style={{ margin: 0 }}>Results &amp; personal bests</h2>
        </div>
        {measures.length === 0 ? <p className="muted">No results yet. Results appear here once this athlete is scored in a session.</p> : <>
          <div className="chips" style={{ marginBottom: '.75rem' }}>
            <button className="chip" aria-pressed={cat === 0} onClick={() => setCat(0)}>All</button>
            {catSummary.map((c) => <button key={c.id} className="chip" aria-pressed={cat === c.id} onClick={() => setCat(c.id)}>{c.name}</button>)}
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Drill / exercise</th><th className="num">Latest</th><th className="num">Best</th><th className="num">Change</th></tr></thead>
              <tbody>
                {shown.map((x) => {
                  const diff = x.latest - x.first
                  const improved = x.points.length > 1 && isBetter(x.latest, x.first, x.better)
                  const worse = x.points.length > 1 && isBetter(x.first, x.latest, x.better)
                  const isOpen = open === x.key
                  return (
                    <Fragment key={x.key}>
                      <tr className="measure-row" onClick={() => setOpen(isOpen ? null : x.key)} aria-expanded={isOpen}>
                        <td>
                          <strong>{x.label}</strong>
                          <div className="muted small">{categoryName(x.category_id)} · {x.better === 'lower' ? 'lower' : 'higher'} is better · {x.points.length} result{x.points.length > 1 ? 's' : ''}</div>
                        </td>
                        <td className="num">{fmtNum(x.latest)} {unitShort(x.unit)}</td>
                        <td className="num"><span className="tag tag-good"><IconTrophy />{fmtNum(x.best)}</span></td>
                        <td className="num">
                          {x.points.length < 2 ? <span className="muted">—</span> :
                            <span className={`tag ${improved ? 'tag-good' : worse ? 'tag-bad' : 'tag-gray'}`}>
                              {improved ? '▲' : worse ? '▼' : '='} {diff > 0 ? '+' : ''}{fmtNum(diff)}
                            </span>}
                        </td>
                      </tr>
                      {isOpen && (
                        <tr><td colSpan={4} style={{ background: 'var(--bg)' }}>
                          <div className="muted small" style={{ marginBottom: '.25rem' }}>
                            Personal best {fmtNum(x.best)} {x.unit} on {fmtDate(x.bestDate)}. Hollow dot = PB.
                          </div>
                          <LineChart points={x.points} unit={unitShort(x.unit)} better={x.better} label={x.label} />
                        </td></tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p className="muted small" style={{ marginTop: '.5rem' }}>Tap a row to see the trend.</p>
        </>}
      </div>

      {(a.guardian_name || a.guardian_email || a.guardian_phone || a.notes) && (
        <div className="card" style={{ marginTop: '1.25rem' }}>
          <h2>Guardian &amp; notes</h2>
          {a.guardian_name && <p style={{ margin: 0 }}><strong>{a.guardian_name}</strong></p>}
          <p className="row" style={{ gap: '1rem' }}>
            {a.guardian_email && <a href={`mailto:${a.guardian_email}`}>{a.guardian_email}</a>}
            {a.guardian_phone && <a href={`tel:${a.guardian_phone}`}>{a.guardian_phone}</a>}
          </p>
          {a.notes && <p className="muted" style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{a.notes}</p>}
        </div>
      )}
    </>
  )
}
