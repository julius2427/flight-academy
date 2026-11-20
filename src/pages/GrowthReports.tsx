import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { Athlete, ResultRow } from '../lib/types'
import { PERIODS, cutoffFor } from '../lib/growth'
import AthleteReport from '../components/AthleteReport'
import { ErrorNote, PageHead, Spinner } from '../components/Ui'

interface Data {
  athletes: Athlete[]
  rows: ResultRow[]
  sessions: { id: string; session_date: string }[]
  attendance: { session_id: string; athlete_id: string }[]
}

/** Loads everything a growth report needs; narrowed to one athlete when `athleteId` is given. */
function useReportData(athleteId?: string) {
  const [data, setData] = useState<Data | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    let ath = supabase.from('athletes').select('*').order('last_name').order('first_name')
    let res = supabase.from('athlete_results').select('*').order('session_date')
    let att = supabase.from('session_athletes').select('session_id, athlete_id')
    if (athleteId) { ath = ath.eq('id', athleteId); res = res.eq('athlete_id', athleteId); att = att.eq('athlete_id', athleteId) }
    Promise.all([ath, res, supabase.from('sessions').select('id, session_date'), att]).then(([a, r, s, sa]) => {
      const err = a.error || r.error || s.error || sa.error
      if (err) setError(err.message)
      setData({ athletes: (a.data as Athlete[]) ?? [], rows: (r.data as ResultRow[]) ?? [], sessions: s.data ?? [], attendance: sa.data ?? [] })
    })
  }, [athleteId])
  return { data, error }
}

function Controls({ period, setPeriod, children }: { period: number; setPeriod: (n: number) => void; children?: React.ReactNode }) {
  return (
    <div className="row no-print" style={{ marginBottom: '1rem' }}>
      {children}
      <div className="chips" role="group" aria-label="Time period">
        {PERIODS.map((p) => <button key={p.value} className="chip" aria-pressed={period === p.value} onClick={() => setPeriod(p.value)}>{p.label}</button>)}
      </div>
    </div>
  )
}

function useSlice(data: Data | null, period: number) {
  return useMemo(() => {
    if (!data) return null
    const cutoff = cutoffFor(period)
    const sessIds = new Set(data.sessions.filter((s) => s.session_date >= cutoff).map((s) => s.id))
    return {
      sessionsHeld: sessIds.size,
      rowsFor: (id: string) => data.rows.filter((r) => r.athlete_id === id && r.session_date >= cutoff),
      attendedBy: (id: string) => data.attendance.filter((x) => x.athlete_id === id && sessIds.has(x.session_id)).length,
      label: PERIODS.find((p) => p.value === period)?.label ?? '',
    }
  }, [data, period])
}

/** /app/athletes/:id/report — one athlete. */
export function AthleteGrowthReport() {
  const { id } = useParams()
  const { data, error } = useReportData(id)
  const [period, setPeriod] = useState(0)
  const slice = useSlice(data, period)
  if (!data || !slice) return error ? <ErrorNote error={error} /> : <Spinner />
  const a = data.athletes[0]
  if (!a) return <ErrorNote error="Athlete not found." />
  return (
    <>
      <div className="no-print">
        <PageHead title="Growth report" back={{ to: `/app/athletes/${a.id}`, label: `${a.first_name} ${a.last_name}` }}
          actions={<button className="btn btn-primary" onClick={() => window.print()}>Print / save PDF</button>} />
      </div>
      <Controls period={period} setPeriod={setPeriod} />
      <ErrorNote error={error} />
      <AthleteReport athlete={a} rows={slice.rowsFor(a.id)} attended={slice.attendedBy(a.id)} sessionsHeld={slice.sessionsHeld} periodLabel={slice.label} />
    </>
  )
}

/** /app/reports/athletes — every athlete, one report per printed page. */
export function AllGrowthReports() {
  const { data, error } = useReportData()
  const [period, setPeriod] = useState(0)
  const [group, setGroup] = useState('')
  const [includeEmpty, setIncludeEmpty] = useState(false)
  const slice = useSlice(data, period)
  if (!data || !slice) return error ? <ErrorNote error={error} /> : <Spinner />

  const groups = [...new Set(data.athletes.map((a) => a.team_group).filter(Boolean))].sort() as string[]
  const list = data.athletes
    .filter((a) => a.active && (!group || a.team_group === group))
    .map((a) => ({ a, rows: slice.rowsFor(a.id) }))
    .filter((x) => includeEmpty || x.rows.length > 0)

  return (
    <>
      <div className="no-print">
        <PageHead title="Individual growth reports" back={{ to: '/app/reports', label: 'Program report' }}
          sub={`${list.length} athlete${list.length === 1 ? '' : 's'} · prints one per page`}
          actions={<button className="btn btn-primary" onClick={() => window.print()} disabled={!list.length}>Print / save PDF</button>} />
      </div>
      <Controls period={period} setPeriod={setPeriod}>
        <select className="select" style={{ width: 'auto' }} value={group} onChange={(e) => setGroup(e.target.value)} aria-label="Group">
          <option value="">All groups</option>
          {groups.map((g) => <option key={g}>{g}</option>)}
        </select>
        <label className="check"><input type="checkbox" checked={includeEmpty} onChange={(e) => setIncludeEmpty(e.target.checked)} /> Include athletes with no results</label>
      </Controls>
      <ErrorNote error={error} />
      {list.length === 0 ? <div className="card empty">No athletes with results in this view.</div> : (
        <div className="report-stack">
          {list.map(({ a, rows }) => (
            <AthleteReport key={a.id} athlete={a} rows={rows} attended={slice.attendedBy(a.id)} sessionsHeld={slice.sessionsHeld} periodLabel={slice.label} />
          ))}
        </div>
      )}
    </>
  )
}
