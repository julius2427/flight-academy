import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import type { Session } from '../lib/types'
import { fmtDate } from '../lib/constants'
import { IconPlus } from '../components/Icons'
import { ErrorNote, PageHead, Spinner } from '../components/Ui'

type Row = Session & { session_athletes: { count: number }[]; session_items: { count: number }[] }

export default function Sessions() {
  const { canEdit } = useAuth()
  const [rows, setRows] = useState<Row[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    supabase.from('sessions').select('*, session_athletes(count), session_items(count)').order('session_date', { ascending: false })
      .then(({ data, error }) => { if (error) setError(error.message); setRows((data as Row[]) ?? []) })
  }, [])
  return (
    <>
      <PageHead title="Sessions" sub="Score sheets: conditioning and measured results"
        actions={canEdit ? <Link to="/app/sessions/new" className="btn btn-primary"><IconPlus /> New session</Link> : undefined} />
      <ErrorNote error={error} />
      {!rows ? <Spinner /> : rows.length === 0 ? <div className="card empty">No sessions yet.</div> : (
        <div className="list">
          {rows.map((s) => (
            <Link key={s.id} to={`/app/sessions/${s.id}`} className="card card-link spread">
              <div>
                <strong>{fmtDate(s.session_date)}</strong>
                <div className="muted small">{[s.coach_name && `Coach ${s.coach_name}`, s.location].filter(Boolean).join(' · ') || '—'}</div>
              </div>
              <div className="row" style={{ gap: '.35rem' }}>
                <span className="tag tag-gray">{s.session_athletes?.[0]?.count ?? 0} athletes</span>
                <span className="tag">{s.session_items?.[0]?.count ?? 0} drills/exercises</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  )
}
