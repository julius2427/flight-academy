import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { Athlete } from '../lib/types'
import { ErrorNote, Field, PageHead, Spinner } from '../components/Ui'

const blank: Omit<Athlete, 'id'> = {
  first_name: '', last_name: '', birth_date: null, grade: null, school: null, sport: null, position: null,
  team_group: null, guardian_name: null, guardian_email: null, guardian_phone: null, active: true, notes: null,
}

export default function AthleteForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [a, setA] = useState<Omit<Athlete, 'id'> | null>(id ? null : blank)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    supabase.from('athletes').select('*').eq('id', id).single().then(({ data, error }) => {
      if (error) setError(error.message)
      else { const { id: _drop, ...rest } = data as Athlete; void _drop; setA({ ...blank, ...rest }) }
    })
  }, [id])

  if (!a) return error ? <ErrorNote error={error} /> : <Spinner />
  const set = <K extends keyof typeof a>(k: K, v: (typeof a)[K]) => setA({ ...a, [k]: v })
  const txt = (k: keyof typeof a) => ({
    value: (a[k] as string | null) ?? '',
    onChange: (e: { target: { value: string } }) => set(k, (e.target.value || null) as never),
  })

  async function save(e: FormEvent) {
    e.preventDefault()
    setBusy(true); setError(null)
    const payload = { ...a, first_name: a!.first_name.trim(), last_name: a!.last_name.trim(), updated_at: new Date().toISOString() }
    const res = id
      ? await supabase.from('athletes').update(payload).eq('id', id).select('id').single()
      : await supabase.from('athletes').insert(payload).select('id').single()
    setBusy(false)
    if (res.error) return setError(res.error.message)
    navigate(`/app/athletes/${res.data.id}`, { replace: true })
  }

  async function remove() {
    if (!id || !confirm(`Delete ${a!.first_name} ${a!.last_name} and ALL of their results? This cannot be undone. (Tip: uncheck "Active" instead to keep history.)`)) return
    const { error } = await supabase.from('athletes').delete().eq('id', id)
    if (error) return setError(error.message)
    navigate('/app/athletes', { replace: true })
  }

  return (
    <>
      <PageHead title={id ? 'Edit athlete' : 'Add athlete'} back={{ to: id ? `/app/athletes/${id}` : '/app/athletes', label: id ? 'Profile' : 'Athletes' }} />
      <form onSubmit={save} className="stack">
        <div className="card stack">
          <h3>Athlete</h3>
          <div className="grid-2">
            <Field label="First name"><input className="input" required value={a.first_name} onChange={(e) => set('first_name', e.target.value)} autoComplete="off" /></Field>
            <Field label="Last name"><input className="input" required value={a.last_name} onChange={(e) => set('last_name', e.target.value)} autoComplete="off" /></Field>
            <Field label="Birth date"><input className="input" type="date" {...txt('birth_date')} /></Field>
            <Field label="Grade"><input className="input" {...txt('grade')} placeholder="e.g. 8" /></Field>
            <Field label="School"><input className="input" {...txt('school')} /></Field>
            <Field label="Team / age group"><input className="input" {...txt('team_group')} placeholder="e.g. 12U, Varsity" /></Field>
            <Field label="Sport"><input className="input" {...txt('sport')} placeholder="e.g. Football" /></Field>
            <Field label="Position"><input className="input" {...txt('position')} placeholder="e.g. WR" /></Field>
          </div>
          <label className="check"><input type="checkbox" checked={a.active} onChange={(e) => set('active', e.target.checked)} /> Active in the program</label>
        </div>
        <div className="card stack">
          <h3>Guardian contact</h3>
          <div className="grid-3">
            <Field label="Name"><input className="input" {...txt('guardian_name')} /></Field>
            <Field label="Email"><input className="input" type="email" inputMode="email" {...txt('guardian_email')} /></Field>
            <Field label="Phone"><input className="input" type="tel" inputMode="tel" {...txt('guardian_phone')} /></Field>
          </div>
          <Field label="Notes" hint="(injuries, goals, anything coaches should know)"><textarea className="textarea" {...txt('notes')} /></Field>
        </div>
        <ErrorNote error={error} />
        <div className="spread">
          {id ? <button type="button" className="btn btn-danger" onClick={remove}>Delete athlete</button> : <span />}
          <button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save athlete'}</button>
        </div>
      </form>
    </>
  )
}
