import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import type { Exercise } from '../lib/types'
import { todayISO } from '../lib/constants'
import { ErrorNote, Field, PageHead, Spinner } from '../components/Ui'
import { SetupUpload } from '../components/SetupImage'
import StepsEditor, { cleanSteps } from '../components/StepsEditor'
import CategorySelect from '../components/CategoryPicker'
import ScoringEditor from '../components/ScoringEditor'

type Form = Omit<Exercise, 'id'>
const blank = (): Form => ({
  title: '', created_on: todayISO(), setup: null, setup_image: null, steps: [], category_id: null,
  distance_value: null, distance_unit: 'meters', time_value: null, time_unit: 'seconds', reps_value: null, reps_unit: 'reps',
  score_unit: 'seconds', better: 'lower',
})

export default function ExerciseForm() {
  const { id } = useParams()
  const { canEdit } = useAuth()
  const ro = !canEdit
  const navigate = useNavigate()
  const [f, setF] = useState<Form | null>(id ? null : blank())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    supabase.from('exercises').select('*').eq('id', id).single().then(({ data, error }) => {
      if (error) return setError(error.message)
      const { id: _i, ...rest } = data as Exercise; void _i
      setF({ ...blank(), ...rest, distance_unit: rest.distance_unit || 'meters', time_unit: rest.time_unit || 'seconds', reps_unit: rest.reps_unit || 'reps' })
    })
  }, [id])

  if (!f) return error ? <ErrorNote error={error} /> : <Spinner />
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF({ ...f, [k]: v })
  const num = (k: 'distance_value' | 'time_value' | 'reps_value') => ({
    value: f[k] ?? '', inputMode: 'decimal' as const, type: 'number', step: 'any', min: 0,
    onChange: (e: { target: { value: string } }) => set(k, e.target.value === '' ? null : Number(e.target.value)),
  })

  async function save(e: FormEvent) {
    e.preventDefault()
    setBusy(true); setError(null)
    const payload = { ...f!, title: f!.title.trim(), steps: cleanSteps(f!.steps) }
    const res = id
      ? await supabase.from('exercises').update(payload).eq('id', id).select('id').single()
      : await supabase.from('exercises').insert(payload).select('id').single()
    setBusy(false)
    if (res.error) return setError(res.error.message)
    navigate('/app/exercises', { replace: true })
  }

  async function remove() {
    if (!id || !confirm(`Delete "${f!.title}"? Past session results keep their label.`)) return
    const { error } = await supabase.from('exercises').delete().eq('id', id)
    if (error) return setError(error.message)
    if (f!.setup_image) supabase.storage.from('setups').remove([f!.setup_image])
    navigate('/app/exercises', { replace: true })
  }

  return (
    <>
      <PageHead title={ro ? f.title : id ? 'Edit exercise' : 'New exercise'} sub={ro ? 'View only' : undefined} back={{ to: '/app/exercises', label: 'Exercises' }} />
      <form onSubmit={save} className="stack">
        <fieldset className="stack bare-fieldset" disabled={ro}>
        <div className="card stack">
          <div className="grid-2">
            <Field label="Exercise title"><input className="input" required value={f.title} onChange={(e) => set('title', e.target.value)} /></Field>
            <Field label="Date"><input className="input" type="date" value={f.created_on} onChange={(e) => set('created_on', e.target.value)} /></Field>
          </div>
          <Field label="Development category" hint="(select one)">
            <CategorySelect value={f.category_id} onChange={(v) => set('category_id', v)} label="Development category" required />
          </Field>
        </div>
        <div className="card stack">
          <h3>Set up <span className="muted small" style={{ fontFamily: 'var(--body)', fontWeight: 400 }}>diagram any setup necessary</span></h3>
          <textarea className="textarea" value={f.setup ?? ''} onChange={(e) => set('setup', e.target.value || null)} placeholder="e.g. 4 cones in a 5-yard square…" aria-label="Setup description" />
          <SetupUpload path={f.setup_image} onChange={(p) => set('setup_image', p)} folder="exercises" />
        </div>
        <div className="card stack">
          <h3>Process / actions <span className="muted small" style={{ fontFamily: 'var(--body)', fontWeight: 400 }}>define the steps of action</span></h3>
          <StepsEditor steps={f.steps} onChange={(s) => set('steps', s)} placeholder="e.g. Start in athletic stance at cone 1" />
        </div>
        <div className="card stack">
          <h3>Prescription <span className="muted small" style={{ fontFamily: 'var(--body)', fontWeight: 400 }}>distance / time / reps per set; complete all that apply</span></h3>
          <div className="measure-grid">
            <span className="lbl">Distance</span>
            <input className="input" {...num('distance_value')} aria-label="Distance" />
            <select className="select" value={f.distance_unit ?? 'meters'} onChange={(e) => set('distance_unit', e.target.value)} aria-label="Distance unit">
              <option value="meters">meters</option><option value="yards">yards</option><option value="feet">feet</option><option value="inches">inches</option>
            </select>
            <span className="lbl">Specified time</span>
            <input className="input" {...num('time_value')} aria-label="Specified time" />
            <select className="select" value={f.time_unit ?? 'seconds'} onChange={(e) => set('time_unit', e.target.value)} aria-label="Time unit">
              <option value="seconds">seconds</option><option value="minutes">minutes</option>
            </select>
            <span className="lbl"># per single rep</span>
            <input className="input" {...num('reps_value')} aria-label="Number per single rep" />
            <input className="input" value={f.reps_unit ?? ''} onChange={(e) => set('reps_unit', e.target.value)} aria-label="Rep unit" placeholder="reps" />
          </div>
        </div>
        <ScoringEditor unit={f.score_unit} better={f.better} onChange={(u, b) => setF({ ...f, score_unit: u, better: b })} />
        </fieldset>
        <ErrorNote error={error} />
        {!ro && <div className="spread">
          {id ? <button type="button" className="btn btn-danger" onClick={remove}>Delete</button> : <span />}
          <button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save exercise'}</button>
        </div>}
      </form>
    </>
  )
}
