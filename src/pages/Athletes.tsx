import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import type { Athlete } from '../lib/types'
import { ageFrom } from '../lib/constants'
import { IconPlus } from '../components/Icons'
import { ErrorNote, PageHead, Spinner } from '../components/Ui'

export default function Athletes() {
  const { canEdit } = useAuth()
  const [rows, setRows] = useState<Athlete[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [group, setGroup] = useState('')
  const [showInactive, setShowInactive] = useState(false)

  useEffect(() => {
    supabase.from('athletes').select('*').order('last_name').order('first_name')
      .then(({ data, error }) => { if (error) setError(error.message); setRows((data as Athlete[]) ?? []) })
  }, [])

  const groups = useMemo(() => [...new Set((rows ?? []).map((r) => r.team_group).filter(Boolean))].sort() as string[], [rows])
  const shown = (rows ?? []).filter((r) =>
    (showInactive || r.active) &&
    (!group || r.team_group === group) &&
    `${r.first_name} ${r.last_name} ${r.sport ?? ''} ${r.position ?? ''}`.toLowerCase().includes(q.toLowerCase()))

  return (
    <>
      <PageHead title="Athletes" sub={rows ? `${rows.filter((r) => r.active).length} active` : undefined}
        actions={canEdit ? <Link to="/app/athletes/new" className="btn btn-primary"><IconPlus /> Add athlete</Link> : undefined} />
      <ErrorNote error={error} />
      <div className="row" style={{ marginBottom: '1rem' }}>
        <input className="input" style={{ flex: '1 1 220px' }} placeholder="Search name, sport, position…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search athletes" />
        {groups.length > 0 && (
          <select className="select" style={{ flex: '0 1 180px' }} value={group} onChange={(e) => setGroup(e.target.value)} aria-label="Filter by group">
            <option value="">All groups</option>
            {groups.map((g) => <option key={g}>{g}</option>)}
          </select>
        )}
        <label className="check"><input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} /> Show inactive</label>
      </div>
      {!rows ? <Spinner /> : shown.length === 0 ? (
        <div className="card empty">{rows.length === 0 ? 'No athletes yet. Add your first athlete to start tracking.' : 'No athletes match.'}</div>
      ) : (
        <div className="list">
          {shown.map((a) => {
            const age = ageFrom(a.birth_date)
            return (
              <Link key={a.id} to={`/app/athletes/${a.id}`} className="card card-link spread">
                <div>
                  <strong style={{ fontSize: '1.05rem' }}>{a.last_name}, {a.first_name}</strong>
                  <div className="muted small">
                    {[age != null && `Age ${age}`, a.grade && `Grade ${a.grade}`, a.sport, a.position].filter(Boolean).join(' · ') || '—'}
                  </div>
                </div>
                <div className="row">
                  {a.team_group && <span className="tag">{a.team_group}</span>}
                  {!a.active && <span className="tag tag-gray">Inactive</span>}
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </>
  )
}
