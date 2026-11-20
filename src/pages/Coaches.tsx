import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import type { Profile, Role } from '../lib/types'
import { ErrorNote, PageHead, Spinner } from '../components/Ui'
import { fmtDate } from '../lib/constants'

const ROLES: { value: Role; label: string }[] = [
  { value: 'pending', label: 'Pending (no access)' },
  { value: 'coach', label: 'Coach' },
  { value: 'admin', label: 'Admin' },
]

export default function Coaches() {
  const { profile: me } = useAuth()
  const [rows, setRows] = useState<Profile[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    const { data, error } = await supabase.from('profiles').select('*').order('created_at')
    if (error) setError(error.message)
    setRows((data as Profile[]) ?? [])
  }
  useEffect(() => { load() }, [])

  async function setRole(id: string, role: Role) {
    setError(null)
    const { error } = await supabase.from('profiles').update({ role }).eq('id', id)
    if (error) setError(error.message)
    load()
  }

  if (!rows) return <Spinner />
  const pending = rows.filter((r) => r.role === 'pending').length
  return (
    <>
      <PageHead title="Coaches" sub={pending ? `${pending} waiting for approval` : 'Approve new accounts and manage roles'} back={{ to: '/app', label: 'Home' }} />
      <ErrorNote error={error} />
      <div className="list">
        {rows.map((r) => (
          <div key={r.id} className="card spread">
            <div>
              <strong>{r.full_name || r.email}</strong>{' '}
              {r.role === 'pending' && <span className="tag tag-bad">Needs approval</span>}
              <div className="muted small">{r.email} · joined {fmtDate(r.created_at)}</div>
            </div>
            <select className="select" style={{ width: 'auto' }} value={r.role} disabled={r.id === me?.id}
              onChange={(e) => setRole(r.id, e.target.value as Role)} aria-label={`Role for ${r.email}`}>
              {ROLES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              {(r.role === 'athlete' || r.role === 'guardian') && <option value={r.role}>{r.role}</option>}
            </select>
          </div>
        ))}
      </div>
      <p className="muted small" style={{ marginTop: '1rem' }}>
        Athlete and parent logins are planned for a later phase. The database already limits those accounts to
        the athletes they’re linked to.
      </p>
    </>
  )
}
