import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import type { Exercise } from '../lib/types'
import { CATEGORIES, categoryName, fmtNum, scoringText } from '../lib/constants'
import { IconPlus } from '../components/Icons'
import { ErrorNote, PageHead, Spinner } from '../components/Ui'

export const measureSummary = (e: Exercise) => [
  e.distance_value != null && `${fmtNum(e.distance_value)} ${e.distance_unit ?? ''}`,
  e.time_value != null && `${fmtNum(e.time_value)} ${e.time_unit ?? ''}`,
  e.reps_value != null && `${fmtNum(e.reps_value)} ${e.reps_unit ?? 'reps'}`,
].filter(Boolean).join(' · ')

export default function Exercises() {
  const { canEdit } = useAuth()
  const [rows, setRows] = useState<Exercise[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cat, setCat] = useState(0)
  const [q, setQ] = useState('')

  useEffect(() => {
    supabase.from('exercises').select('*').order('title')
      .then(({ data, error }) => { if (error) setError(error.message); setRows((data as Exercise[]) ?? []) })
  }, [])

  const shown = (rows ?? []).filter((e) => (!cat || e.category_id === cat) && e.title.toLowerCase().includes(q.toLowerCase()))
  return (
    <>
      <PageHead title="Exercises" sub="Single movements, each tied to one development category"
        actions={canEdit ? <Link to="/app/exercises/new" className="btn btn-primary"><IconPlus /> New exercise</Link> : undefined} />
      <ErrorNote error={error} />
      <input className="input" placeholder="Search exercises…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search exercises" style={{ marginBottom: '.75rem' }} />
      <div className="chips" style={{ marginBottom: '1rem' }}>
        <button className="chip" aria-pressed={cat === 0} onClick={() => setCat(0)}>All</button>
        {CATEGORIES.map((c) => <button key={c.id} className="chip" aria-pressed={cat === c.id} onClick={() => setCat(c.id)}>{c.id}. {c.name}</button>)}
      </div>
      {!rows ? <Spinner /> : shown.length === 0 ? <div className="card empty">No exercises found.</div> : (
        <div className="list">
          {shown.map((e) => (
            <Link key={e.id} to={`/app/exercises/${e.id}`} className="card card-link">
              <div className="spread">
                <strong>{e.title}</strong>
                <span className="tag">{e.category_id ? `${e.category_id}. ` : ''}{categoryName(e.category_id)}</span>
              </div>
              <div className="muted small">{[e.score_unit && scoringText(e.score_unit, e.better), measureSummary(e), e.steps.length && `${e.steps.length} steps`].filter(Boolean).join(' · ')}</div>
            </Link>
          ))}
        </div>
      )}
    </>
  )
}
