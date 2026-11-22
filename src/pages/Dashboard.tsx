import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import type { Session } from '../lib/types'
import { fmtDate } from '../lib/constants'
import { downloadCsv } from '../lib/csv'
import { IconDownload, IconPlus } from '../components/Icons'
import { ErrorNote, PageHead } from '../components/Ui'

export default function Dashboard() {
  const { profile, canEdit } = useAuth()
  const [counts, setCounts] = useState<Record<string, number | null>>({})
  const [recent, setRecent] = useState<(Session & { session_athletes: { count: number }[] })[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const count = (t: string, f?: (q: any) => any) => {
      let q = supabase.from(t).select('*', { count: 'exact', head: true })
      if (f) q = f(q)
      return q.then(({ count }: { count: number | null }) => count)
    }
    Promise.all([
      count('athletes', (q) => q.eq('active', true)), count('sessions'), count('exercises'), count('drills'),
    ]).then(([a, s, e, d]) => setCounts({ a, s, e, d }))
    supabase.from('sessions').select('*, session_athletes(count)').order('session_date', { ascending: false }).limit(5)
      .then(({ data, error }) => { if (error) setError(error.message); setRecent((data as any) ?? []) })
  }, [])

  async function exportAll() {
    const { data: athletes } = await supabase.from('athletes').select('id, first_name, last_name, team_group')
    const { data, error } = await supabase.from('athlete_results').select('*').order('session_date')
    if (error) return setError(error.message)
    const byId = new Map((athletes ?? []).map((a) => [a.id, a]))
    downloadCsv(`flight-academy-results-${new Date().toISOString().slice(0, 10)}.csv`, [
      ['date', 'last_name', 'first_name', 'group', 'section', 'type', 'drill_or_exercise', 'value', 'unit', 'better', 'category_id'],
      ...(data ?? []).map((r) => {
        const a = byId.get(r.athlete_id)
        return [r.session_date, a?.last_name, a?.first_name, a?.team_group, r.section, r.item_type, r.label, r.value, r.unit, r.better, r.category_id]
      }),
    ])
  }

  const first = profile?.full_name?.split(' ')[0]
  return (
    <>
      <PageHead title={first ? `Welcome, ${first}` : 'Dashboard'} sub="Forward…Fast"
        actions={canEdit ? <Link to="/app/sessions/new" className="btn btn-primary"><IconPlus /> New session</Link> : undefined} />
      <ErrorNote error={error} />

      <div className="stats">
        <Link to="/app/athletes" className="stat card-link"><b>{counts.a ?? '–'}</b><span>Active athletes</span></Link>
        <Link to="/app/sessions" className="stat card-link"><b>{counts.s ?? '–'}</b><span>Sessions logged</span></Link>
        <Link to="/app/exercises" className="stat card-link"><b>{counts.e ?? '–'}</b><span>Exercises</span></Link>
        <Link to="/app/drills" className="stat card-link"><b>{counts.d ?? '–'}</b><span>Drills</span></Link>
      </div>

      <div className="grid-2" style={{ marginTop: '1.25rem' }}>
        <div className="card">
          <div className="spread" style={{ marginBottom: '.75rem' }}>
            <h2 style={{ margin: 0 }}>Recent sessions</h2>
            <Link to="/app/sessions" className="small">View all</Link>
          </div>
          {recent.length === 0 ? <p className="muted">No sessions yet. Start one to record results.</p> : (
            <div className="list">
              {recent.map((s) => (
                <Link key={s.id} to={`/app/sessions/${s.id}`} className="card-link spread" style={{ padding: '.5rem 0', borderBottom: '1px solid var(--line)' }}>
                  <span><strong>{fmtDate(s.session_date)}</strong> <span className="muted">· {s.coach_name || 'Coach'}</span></span>
                  <span className="tag tag-gray">{s.session_athletes?.[0]?.count ?? 0} athletes</span>
                </Link>
              ))}
            </div>
          )}
        </div>
        <div className="card">
          <h2>Quick actions</h2>
          <div className="list">
            <Link to="/app/reports" className="btn btn-block btn-primary">View program report</Link>
            {canEdit ? <>
              <Link to="/app/sessions/new" className="btn btn-block">Score a session</Link>
              <Link to="/app/athletes/new" className="btn btn-block">Add an athlete</Link>
              <Link to="/app/exercises/new" className="btn btn-block">Create an exercise</Link>
              <Link to="/app/drills/new" className="btn btn-block">Build a drill</Link>
            </> : <>
              <Link to="/app/reports/athletes" className="btn btn-block">Individual growth reports</Link>
              <Link to="/app/athletes" className="btn btn-block">Browse athletes</Link>
              <Link to="/app/sessions" className="btn btn-block">Browse sessions</Link>
            </>}
            <button className="btn btn-block" onClick={exportAll}><IconDownload /> Export all results (CSV)</button>
          </div>
        </div>
      </div>
    </>
  )
}
