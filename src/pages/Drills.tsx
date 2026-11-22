import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import type { Drill } from '../lib/types'
import { CATEGORIES, categoryName, scoringText } from '../lib/constants'
import { IconPlus } from '../components/Icons'
import { ErrorNote, PageHead, Spinner } from '../components/Ui'

export default function Drills() {
  const { canEdit } = useAuth()
  const [rows, setRows] = useState<Drill[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cat, setCat] = useState(0)
  const [q, setQ] = useState('')

  useEffect(() => {
    supabase.from('drills').select('*, drill_exercises(position, exercise_id, label), drill_categories(rank, category_id)').order('title')
      .then(({ data, error }) => { if (error) setError(error.message); setRows((data as Drill[]) ?? []) })
  }, [])

  const shown = (rows ?? []).filter((d) =>
    (!cat || d.drill_categories?.some((c) => c.category_id === cat)) && d.title.toLowerCase().includes(q.toLowerCase()))
  return (
    <>
      <PageHead title="Drills" sub="Sequences of exercises, up to three categories each"
        actions={canEdit ? <Link to="/app/drills/new" className="btn btn-primary"><IconPlus /> New drill</Link> : undefined} />
      <ErrorNote error={error} />
      <input className="input" placeholder="Search drills…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search drills" style={{ marginBottom: '.75rem' }} />
      <div className="chips" style={{ marginBottom: '1rem' }}>
        <button className="chip" aria-pressed={cat === 0} onClick={() => setCat(0)}>All</button>
        {CATEGORIES.map((c) => <button key={c.id} className="chip" aria-pressed={cat === c.id} onClick={() => setCat(c.id)}>{c.id}. {c.name}</button>)}
      </div>
      {!rows ? <Spinner /> : shown.length === 0 ? (
        <div className="card empty">{rows.length === 0 ? 'No drills yet. Build one from your exercise library.' : 'No drills match.'}</div>
      ) : (
        <div className="list">
          {shown.map((d) => {
            const cats = [...(d.drill_categories ?? [])].sort((a, b) => a.rank - b.rank)
            return (
              <Link key={d.id} to={`/app/drills/${d.id}`} className="card card-link">
                <div className="spread">
                  <strong>{d.title}</strong>
                  <span className="row" style={{ gap: '.3rem' }}>{cats.map((c) => <span key={c.rank} className={`tag ${c.rank > 1 ? 'tag-gray' : ''}`}>{categoryName(c.category_id)}</span>)}</span>
                </div>
                <div className="muted small">{[d.score_unit && scoringText(d.score_unit, d.better), `${d.drill_exercises?.length ?? 0} exercises`, `${d.steps.length} steps`].filter(Boolean).join(' · ')}</div>
              </Link>
            )
          })}
        </div>
      )}
    </>
  )
}
