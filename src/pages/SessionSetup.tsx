import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import type { Athlete, Better, ItemType, Section, SessionItem, Unit } from '../lib/types'
import { fmtDate, scoringText, todayISO } from '../lib/constants'
import { ErrorNote, Field, PageHead, Spinner } from '../components/Ui'

/** One column of the score sheet. `k` is a stable React key; `id` is set once saved. */
interface Slot { k: string; id?: string; item_type: ItemType; ref: string; unit: Unit; better: Better }
const emptySlot = (): Slot => ({ k: crypto.randomUUID(), item_type: 'exercise', ref: '', unit: 'seconds', better: 'lower' })
const emptySlots = (): Record<Section, Slot[]> => ({ conditioning: [emptySlot()], measure: [emptySlot()] })
// Recommendations come from the paper score sheet (6 conditioning + 3 measure columns). Not enforced.
const SECTIONS: { key: Section; title: string; rec: number; hint: string; add: string }[] = [
  { key: 'conditioning', title: 'Conditioning', rec: 6, hint: 'Drills/exercises worked during the session', add: 'Add conditioning drill' },
  { key: 'measure', title: 'Measure', rec: 3, hint: 'Tested results used for development tracking', add: 'Add measure' },
]

/** Turn saved session columns into editable rows, ordered by slot. */
function rowsFromItems(items: SessionItem[], map: (it: SessionItem) => Slot | null): Record<Section, Slot[]> {
  const out: Record<Section, Slot[]> = { conditioning: [], measure: [] }
  for (const it of [...items].sort((a, b) => a.slot - b.slot)) { const r = map(it); if (r) out[it.section].push(r) }
  if (!out.conditioning.length) out.conditioning.push(emptySlot())
  if (!out.measure.length) out.measure.push(emptySlot())
  return out
}

export default function SessionSetup() {
  const { id } = useParams()
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [meta, setMeta] = useState({ session_date: todayISO(), coach_name: profile?.full_name ?? '', location: '', notes: '' })
  const [slots, setSlots] = useState<Record<Section, Slot[]>>(emptySlots)
  const [athletes, setAthletes] = useState<Athlete[] | null>(null)
  const [picked, setPicked] = useState<Set<string>>(new Set())
  type LibItem = { id: string; title: string; score_unit: Unit; better: Better }
  const [lib, setLib] = useState<{ exercise: LibItem[]; drill: LibItem[] } | null>(null)
  const [prefilledFrom, setPrefilledFrom] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [group, setGroup] = useState('')
  const [busy, setBusy] = useState(false)
  const [loaded, setLoaded] = useState(!id)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    supabase.from('athletes').select('*').eq('active', true).order('last_name').order('first_name').then(({ data }) => setAthletes((data as Athlete[]) ?? []))
    const loadLib = async (table: 'exercises' | 'drills'): Promise<LibItem[]> => {
      const full = await supabase.from(table).select('id, title, score_unit, better').order('title')
      if (!full.error) return (full.data ?? []) as LibItem[]
      // Database update 002 not applied yet: fall back to timed/lower defaults.
      const basic = await supabase.from(table).select('id, title').order('title')
      if (basic.error) setError(basic.error.message)
      return (basic.data ?? []).map((x) => ({ ...x, score_unit: 'seconds' as Unit, better: 'lower' as Better }))
    }
    Promise.all([loadLib('exercises'), loadLib('drills')]).then(async ([e, d]) => {
      const l = { exercise: e, drill: d }
      setLib(l)
      if (id) return
      // New session: start from the most recent session's columns.
      const { data: last } = await supabase.from('sessions').select('id, session_date').order('session_date', { ascending: false }).order('created_at', { ascending: false }).limit(1).maybeSingle()
      if (!last) return
      const { data: its } = await supabase.from('session_items').select('*').eq('session_id', last.id)
      if (!its?.length) return
      let copied = 0
      const next = rowsFromItems(its as SessionItem[], (it) => {
        const ref = it.exercise_id ?? it.drill_id
        const item = ref ? l[it.item_type].find((x) => x.id === ref) : undefined
        if (!item) return null // removed from the library since
        copied++
        return { k: crypto.randomUUID(), item_type: it.item_type, ref: item.id, unit: item.score_unit, better: item.better }
      })
      if (!copied) return
      setSlots(next)
      setPrefilledFrom(last.session_date)
    })
  }, [id])

  useEffect(() => {
    if (!id) return
    Promise.all([
      supabase.from('sessions').select('*').eq('id', id).single(),
      supabase.from('session_items').select('*').eq('session_id', id),
      supabase.from('session_athletes').select('athlete_id').eq('session_id', id),
    ]).then(([s, items, att]) => {
      if (s.error) return setError(s.error.message)
      setMeta({ session_date: s.data.session_date, coach_name: s.data.coach_name ?? '', location: s.data.location ?? '', notes: s.data.notes ?? '' })
      setSlots(rowsFromItems((items.data ?? []) as SessionItem[], (it) => (
        { k: it.id, id: it.id, item_type: it.item_type, ref: (it.exercise_id ?? it.drill_id ?? '') || `label:${it.label}`, unit: it.unit, better: it.better })))
      setPicked(new Set((att.data ?? []).map((r) => r.athlete_id)))
      setLoaded(true)
    })
  }, [id])

  // Inactive athletes who attended an old session still need to show up when editing it.
  useEffect(() => {
    if (!athletes || !picked.size) return
    const missing = [...picked].filter((pid) => !athletes.some((a) => a.id === pid))
    if (missing.length) supabase.from('athletes').select('*').in('id', missing).then(({ data }) => data && setAthletes([...athletes, ...(data as Athlete[])]))
  }, [athletes, picked])

  const groups = useMemo(() => [...new Set((athletes ?? []).map((a) => a.team_group).filter(Boolean))].sort() as string[], [athletes])
  const visible = (athletes ?? []).filter((a) => (!group || a.team_group === group) && `${a.first_name} ${a.last_name}`.toLowerCase().includes(q.toLowerCase()))

  if (!loaded || !athletes || !lib) return error ? <ErrorNote error={error} /> : <Spinner />

  const setSlot = (sec: Section, i: number, patch: Partial<Slot>) =>
    setSlots({ ...slots, [sec]: slots[sec].map((s, j) => (j === i ? { ...s, ...patch } : s)) })
  const addSlot = (sec: Section) => setSlots({ ...slots, [sec]: [...slots[sec], emptySlot()] })
  const removeSlot = (sec: Section, i: number) => {
    const rest = slots[sec].filter((_, j) => j !== i)
    setSlots({ ...slots, [sec]: rest.length ? rest : [emptySlot()] })
  }
  const toggle = (aid: string) => { const n = new Set(picked); n.has(aid) ? n.delete(aid) : n.add(aid); setPicked(n) }

  async function save(e: FormEvent) {
    e.preventDefault()
    // Filled rows only, numbered 1..n within each section.
    const used = SECTIONS.flatMap((s) => slots[s.key].filter((x) => x.ref).map((x, i) => ({ ...x, section: s.key, slot: i + 1 })))
    if (used.length === 0) return setError('Pick at least one drill or exercise.')
    if (picked.size === 0) return setError('Select at least one athlete.')
    setBusy(true); setError(null)
    try {
      const sres = id
        ? await supabase.from('sessions').update(meta).eq('id', id).select('id').single()
        : await supabase.from('sessions').insert(meta).select('id').single()
      if (sres.error) throw sres.error
      const sid = sres.data.id as string

      // Columns. Saved rows are matched by id so results stay with their drill even when rows
      // are removed or renumbered. Removed columns are deleted (their results go with them).
      const { data: existing } = await supabase.from('session_items').select('id').eq('session_id', sid)
      const keep = new Set(used.map((u) => u.id).filter(Boolean) as string[])
      const drop = (existing ?? []).filter((x) => !keep.has(x.id)).map((x) => x.id)
      if (drop.length) { const r = await supabase.from('session_items').delete().in('id', drop); if (r.error) throw r.error }
      // Park kept rows on temporary slot numbers so renumbering can't collide.
      for (const u of used) if (u.id) {
        const r = await supabase.from('session_items').update({ slot: 1000 + u.slot }).eq('id', u.id); if (r.error) throw r.error
      }
      for (const u of used) {
        const title = u.ref.startsWith('label:') ? u.ref.slice(6) : lib![u.item_type].find((x) => x.id === u.ref)?.title ?? 'Untitled'
        const realId = u.ref.startsWith('label:') ? null : u.ref
        const row = {
          session_id: sid, section: u.section, slot: u.slot, item_type: u.item_type,
          exercise_id: u.item_type === 'exercise' ? realId : null, drill_id: u.item_type === 'drill' ? realId : null,
          label: title, unit: u.unit, better: u.better,
        }
        const r = u.id
          ? await supabase.from('session_items').update(row).eq('id', u.id)
          : await supabase.from('session_items').insert(row)
        if (r.error) throw r.error
      }

      // Attendance
      const { data: att } = await supabase.from('session_athletes').select('athlete_id').eq('session_id', sid)
      const had = new Set((att ?? []).map((r) => r.athlete_id))
      const add = [...picked].filter((a) => !had.has(a)).map((athlete_id) => ({ session_id: sid, athlete_id }))
      const rem = [...had].filter((a) => !picked.has(a))
      if (add.length) { const r = await supabase.from('session_athletes').insert(add); if (r.error) throw r.error }
      if (rem.length) {
        const r = await supabase.from('session_athletes').delete().eq('session_id', sid).in('athlete_id', rem); if (r.error) throw r.error
        const { data: its } = await supabase.from('session_items').select('id').eq('session_id', sid)
        if (its?.length) await supabase.from('results').delete().in('session_item_id', its.map((x) => x.id)).in('athlete_id', rem)
      }
      navigate(`/app/sessions/${sid}`, { replace: true })
    } catch (err) {
      setError((err as { message?: string }).message ?? String(err))
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    if (!id || !confirm('Delete this session and every result recorded in it? This cannot be undone.')) return
    const { error } = await supabase.from('sessions').delete().eq('id', id)
    if (error) return setError(error.message)
    navigate('/app/sessions', { replace: true })
  }

  return (
    <>
      <PageHead title={id ? 'Edit session' : 'New session'} back={{ to: id ? `/app/sessions/${id}` : '/app/sessions', label: id ? 'Score sheet' : 'Sessions' }} />
      <form onSubmit={save} className="stack">
        <div className="card">
          <div className="grid-2">
            <Field label="Date"><input className="input" type="date" required value={meta.session_date} onChange={(e) => setMeta({ ...meta, session_date: e.target.value })} /></Field>
            <Field label="Coach"><input className="input" value={meta.coach_name} onChange={(e) => setMeta({ ...meta, coach_name: e.target.value })} /></Field>
            <Field label="Location" hint="(optional)"><input className="input" value={meta.location} onChange={(e) => setMeta({ ...meta, location: e.target.value })} /></Field>
            <Field label="Notes" hint="(optional)"><input className="input" value={meta.notes} onChange={(e) => setMeta({ ...meta, notes: e.target.value })} /></Field>
          </div>
        </div>

        {prefilledFrom && (
          <div className="alert spread">
            <span className="small">Drills copied from your last session ({fmtDate(prefilledFrom)}). Change any that are different today.</span>
            <button type="button" className="btn btn-sm" onClick={() => { setSlots(emptySlots()); setPrefilledFrom(null) }}>Clear all</button>
          </div>
        )}

        {SECTIONS.map((sec) => {
          const filled = slots[sec.key].filter((x) => x.ref).length
          return (
          <div className="card stack" key={sec.key}>
            <div className="spread" style={{ alignItems: 'flex-start' }}>
              <div>
                <h3 style={{ textTransform: 'uppercase', margin: 0 }}>{sec.title}</h3>
                <div className="muted small">{sec.hint}</div>
              </div>
              <span className={`tag ${filled > sec.rec ? 'tag-warn' : 'tag-gray'}`} title={`The score sheet has ${sec.rec} ${sec.title.toLowerCase()} columns`}>
                {filled} of {sec.rec} recommended
              </span>
            </div>
            {slots[sec.key].map((s, i) => (
              <div className="slot" key={s.k}>
                <span className="slot-num">{i + 1}</span>
                <select className={`select ${s.ref ? '' : 'is-empty'}`} value={s.ref ? `${s.item_type}:${s.ref}` : ''} aria-label={`${sec.title} ${i + 1}`}
                  onChange={(e) => {
                    const v = e.target.value
                    if (!v) return setSlot(sec.key, i, { ref: '' })
                    const [type, ...rest] = v.split(':')
                    const ref = rest.join(':')
                    const item = lib[type as ItemType].find((x) => x.id === ref)
                    setSlot(sec.key, i, item ? { item_type: type as ItemType, ref: item.id, unit: item.score_unit, better: item.better } : { item_type: type as ItemType, ref })
                  }}>
                  <option value="">Choose a drill or exercise…</option>
                  {s.ref.startsWith('label:') && <option value={`${s.item_type}:${s.ref}`}>{s.ref.slice(6)} (removed from library)</option>}
                  {lib.exercise.length > 0 && <optgroup label="Exercises">{lib.exercise.map((x) => <option key={x.id} value={`exercise:${x.id}`}>{x.title}</option>)}</optgroup>}
                  {lib.drill.length > 0 && <optgroup label="Drills">{lib.drill.map((x) => <option key={x.id} value={`drill:${x.id}`}>{x.title}</option>)}</optgroup>}
                </select>
                <button type="button" className="slot-remove" aria-label={`Remove ${sec.title} ${i + 1}`} title="Remove"
                  onClick={() => {
                    if (s.id && !confirm('Remove this column? Any scores already entered for it in this session will be deleted when you save.')) return
                    removeSlot(sec.key, i)
                  }}>✕</button>
                <span className="slot-score">{s.ref ? scoringText(s.unit, s.better) : ''}</span>
              </div>
            ))}
            {filled > sec.rec && (
              <div className="alert alert-warn small">
                {filled} added: more than the recommended {sec.rec}. That’s fine; scoring will just take a little longer.
              </div>
            )}
            <div>
              <button type="button" className="btn btn-sm" onClick={() => addSlot(sec.key)}>+ {sec.add}</button>
            </div>
          </div>
          )
        })}

        <div className="card stack">
          <div className="spread">
            <div>
              <h3 style={{ textTransform: 'uppercase', margin: 0 }}>Athletes</h3>
              <div className="muted small">{picked.size} selected</div>
            </div>
            <div className="row">
              <button type="button" className="btn btn-sm" onClick={() => setPicked(new Set([...picked, ...visible.map((a) => a.id)]))}>Select shown</button>
              <button type="button" className="btn btn-sm btn-ghost" onClick={() => setPicked(new Set())}>Clear</button>
            </div>
          </div>
          <div className="row">
            <input className="input" style={{ flex: '1 1 200px' }} placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search athletes" />
            {groups.length > 0 && (
              <select className="select" style={{ flex: '0 1 180px' }} value={group} onChange={(e) => setGroup(e.target.value)} aria-label="Group">
                <option value="">All groups</option>{groups.map((g) => <option key={g}>{g}</option>)}
              </select>
            )}
          </div>
          {athletes.length === 0 ? <p className="muted">No active athletes yet. Add athletes first.</p> : (
            <div className="grid-2" style={{ gap: '.15rem 1rem' }}>
              {visible.map((a) => (
                <label key={a.id} className="check">
                  <input type="checkbox" checked={picked.has(a.id)} onChange={() => toggle(a.id)} />
                  {a.last_name}, {a.first_name}{a.team_group && <span className="muted small">· {a.team_group}</span>}
                </label>
              ))}
            </div>
          )}
        </div>

        <ErrorNote error={error} />
        <div className="spread">
          {id ? <button type="button" className="btn btn-danger" onClick={remove}>Delete session</button> : <span />}
          <button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : id ? 'Save changes' : 'Create & enter scores'}</button>
        </div>
      </form>
    </>
  )
}
