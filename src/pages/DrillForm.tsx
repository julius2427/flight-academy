import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import type { Better, Drill, Exercise, Unit } from '../lib/types'
import { todayISO } from '../lib/constants'
import { ErrorNote, Field, PageHead, Spinner } from '../components/Ui'
import { SetupUpload } from '../components/SetupImage'
import StepsEditor, { cleanSteps } from '../components/StepsEditor'
import CategorySelect from '../components/CategoryPicker'
import ScoringEditor from '../components/ScoringEditor'

/** An exercise inside the drill: a library exercise (exId) or a typed-in name (custom !== null). */
interface ExRow { k: string; exId: string; custom: string | null }
const MAX_EXERCISES = 6 // matches the paper "New Drill" sheet
const newRow = (): ExRow => ({ k: crypto.randomUUID(), exId: '', custom: null })
interface Form { title: string; created_on: string; setup: string | null; setup_image: string | null; steps: string[]; exercises: ExRow[]; cats: (number | null)[]; score_unit: Unit; better: Better }
const blank = (): Form => ({ title: '', created_on: todayISO(), setup: null, setup_image: null, steps: [], exercises: [newRow()], cats: [null, null, null], score_unit: 'seconds', better: 'lower' })

export default function DrillForm() {
  const { id } = useParams()
  const { canEdit } = useAuth()
  const ro = !canEdit
  const navigate = useNavigate()
  const [f, setF] = useState<Form | null>(id ? null : blank())
  const [library, setLibrary] = useState<Exercise[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    supabase.from('exercises').select('id, title').order('title').then(({ data }) => setLibrary((data as Exercise[]) ?? []))
  }, [])

  useEffect(() => {
    if (!id) return
    supabase.from('drills').select('*, drill_exercises(position, exercise_id, label, exercises(title)), drill_categories(rank, category_id)').eq('id', id).single()
      .then(({ data, error }) => {
        if (error) return setError(error.message)
        const d = data as Omit<Drill, 'drill_exercises'> & { drill_exercises: { position: number; exercise_id: string | null; label: string | null }[] }
        const ex: ExRow[] = [...d.drill_exercises].sort((p, q) => p.position - q.position)
          .map((x) => ({ k: crypto.randomUUID(), exId: x.exercise_id ?? '', custom: x.exercise_id ? null : (x.label ?? '') }))
        if (!ex.length) ex.push(newRow())
        const cats: (number | null)[] = [null, null, null]
        d.drill_categories?.forEach((c) => { cats[c.rank - 1] = c.category_id })
        setF({ title: d.title, created_on: d.created_on, setup: d.setup, setup_image: d.setup_image, steps: d.steps, exercises: ex, cats, score_unit: d.score_unit ?? 'seconds', better: d.better ?? 'lower' })
      })
  }, [id])

  if (!f) return error ? <ErrorNote error={error} /> : <Spinner />
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF({ ...f, [k]: v })

  async function save(e: FormEvent) {
    e.preventDefault()
    setBusy(true); setError(null)
    try {
      const base = { title: f!.title.trim(), created_on: f!.created_on, setup: f!.setup, setup_image: f!.setup_image, steps: cleanSteps(f!.steps), score_unit: f!.score_unit, better: f!.better }
      const res = id
        ? await supabase.from('drills').update(base).eq('id', id).select('id').single()
        : await supabase.from('drills').insert(base).select('id').single()
      if (res.error) throw res.error
      const drillId = res.data.id as string
      const exRows = f!.exercises
        .filter((r) => (r.custom !== null ? r.custom.trim() : r.exId))
        .map((r, i) => ({ drill_id: drillId, position: i + 1, exercise_id: r.custom !== null ? null : r.exId, label: r.custom !== null ? r.custom.trim() : null }))
      const catRows = f!.cats.filter((c): c is number => c != null).map((c, i) => ({ drill_id: drillId, rank: i + 1, category_id: c }))
      const d1 = await supabase.from('drill_exercises').delete().eq('drill_id', drillId)
      if (d1.error) throw d1.error
      const d2 = await supabase.from('drill_categories').delete().eq('drill_id', drillId)
      if (d2.error) throw d2.error
      if (exRows.length) { const r = await supabase.from('drill_exercises').insert(exRows); if (r.error) throw r.error }
      if (catRows.length) { const r = await supabase.from('drill_categories').insert(catRows); if (r.error) throw r.error }
      navigate('/app/drills', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : (err as { message?: string }).message ?? String(err))
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    if (!id || !confirm(`Delete "${f!.title}"? Past session results keep their label.`)) return
    const { error } = await supabase.from('drills').delete().eq('id', id)
    if (error) return setError(error.message)
    if (f!.setup_image) supabase.storage.from('setups').remove([f!.setup_image])
    navigate('/app/drills', { replace: true })
  }

  return (
    <>
      <PageHead title={ro ? f.title : id ? 'Edit drill' : 'New drill'} sub={ro ? 'View only' : undefined} back={{ to: '/app/drills', label: 'Drills' }} />
      <form onSubmit={save} className="stack">
        <fieldset className="stack bare-fieldset" disabled={ro}>
        <div className="card stack">
          <div className="grid-2">
            <Field label="Drill title"><input className="input" required value={f.title} onChange={(e) => set('title', e.target.value)} /></Field>
            <Field label="Date"><input className="input" type="date" value={f.created_on} onChange={(e) => set('created_on', e.target.value)} /></Field>
          </div>
        </div>
        <div className="card stack">
          <h3>Set up <span className="muted small" style={{ fontFamily: 'var(--body)', fontWeight: 400 }}>diagram any setup necessary</span></h3>
          <textarea className="textarea" value={f.setup ?? ''} onChange={(e) => set('setup', e.target.value || null)} aria-label="Setup description" />
          <SetupUpload path={f.setup_image} onChange={(p) => set('setup_image', p)} folder="drills" />
        </div>
        <div className="card stack">
          <div className="spread" style={{ alignItems: 'flex-start' }}>
            <h3 style={{ margin: 0 }}>Exercises included <span className="muted small" style={{ fontFamily: 'var(--body)', fontWeight: 400 }}>in order of operation</span></h3>
            <span className="tag tag-gray">{f.exercises.filter((r) => r.exId || r.custom?.trim()).length} of {MAX_EXERCISES}</span>
          </div>
          <div className="steps">
            {f.exercises.map((r, i) => {
              const update = (patch: Partial<ExRow>) => set('exercises', f.exercises.map((x, j) => (j === i ? { ...x, ...patch } : x)))
              return (
                <div className="ex-row" key={r.k}>
                  <b>{i + 1}</b>
                  <select className={`select ${r.exId || r.custom !== null ? '' : 'is-empty'}`} aria-label={`Exercise ${i + 1}`}
                    value={r.custom !== null ? '__custom' : r.exId}
                    onChange={(e) => update(e.target.value === '__custom' ? { exId: '', custom: '' } : { exId: e.target.value, custom: null })}>
                    <option value="">Choose an exercise…</option>
                    {library.map((x) => <option key={x.id} value={x.id}>{x.title}</option>)}
                    <option value="__custom">Other (type a name)…</option>
                  </select>
                  <button type="button" className="slot-remove" aria-label={`Remove exercise ${i + 1}`} title="Remove"
                    onClick={() => { const rest = f.exercises.filter((_, j) => j !== i); set('exercises', rest.length ? rest : [newRow()]) }}>✕</button>
                  {r.custom !== null && (
                    <input className="input ex-custom" autoFocus value={r.custom} placeholder="Exercise name (not in the library yet)"
                      aria-label={`Exercise ${i + 1} name`} onChange={(e) => update({ custom: e.target.value })} />
                  )}
                </div>
              )
            })}
          </div>
          {f.exercises.length < MAX_EXERCISES && (
            <div><button type="button" className="btn btn-sm" onClick={() => set('exercises', [...f.exercises, newRow()])}>+ Add exercise</button></div>
          )}
        </div>
        <div className="card stack">
          <h3>Process / actions <span className="muted small" style={{ fontFamily: 'var(--body)', fontWeight: 400 }}>reps, transitions, and other steps</span></h3>
          <StepsEditor steps={f.steps} onChange={(s) => set('steps', s)} placeholder="e.g. 3 rounds, 30s rest between" />
        </div>
        <div className="card stack">
          <h3>Development categories <span className="muted small" style={{ fontFamily: 'var(--body)', fontWeight: 400 }}>up to three, in order of intention</span></h3>
          {[0, 1, 2].map((i) => (
            <Field key={i} label={i === 0 ? 'Primary' : i === 1 ? 'Second' : 'Third'}>
              <CategorySelect value={f.cats[i]} required={i === 0} label={`Category ${i + 1}`}
                exclude={f.cats.filter((c, j) => j !== i && c != null) as number[]}
                onChange={(v) => { const n = [...f.cats]; n[i] = v; set('cats', n) }} />
            </Field>
          ))}
        </div>
        <ScoringEditor unit={f.score_unit} better={f.better} onChange={(u, b) => setF({ ...f, score_unit: u, better: b })} />
        </fieldset>
        <ErrorNote error={error} />
        {!ro && <div className="spread">
          {id ? <button type="button" className="btn btn-danger" onClick={remove}>Delete</button> : <span />}
          <button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save drill'}</button>
        </div>}
      </form>
    </>
  )
}
