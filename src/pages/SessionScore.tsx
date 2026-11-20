import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { Athlete, Session, SessionItem } from '../lib/types'
import { fmtDate, unitShort } from '../lib/constants'
import { ErrorNote, PageHead, Spinner } from '../components/Ui'

const key = (itemId: string, athleteId: string) => `${itemId}|${athleteId}`

export default function SessionScore() {
  const { id } = useParams()
  const [session, setSession] = useState<Session | null>(null)
  const [items, setItems] = useState<SessionItem[]>([])
  const [athletes, setAthletes] = useState<Athlete[]>([])
  const [saved, setSaved] = useState<Record<string, string>>({})
  const [vals, setVals] = useState<Record<string, string>>({})
  const [mode, setMode] = useState<'item' | 'sheet'>(() => (window.innerWidth >= 900 ? 'sheet' : 'item'))
  const [active, setActive] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  async function load() {
    if (!id) return
    const [s, it, att] = await Promise.all([
      supabase.from('sessions').select('*').eq('id', id).single(),
      supabase.from('session_items').select('*').eq('session_id', id),
      supabase.from('session_athletes').select('athletes(*)').eq('session_id', id),
    ])
    if (s.error) return setError(s.error.message)
    const its = ((it.data ?? []) as SessionItem[]).sort((a, b) => (a.section === b.section ? a.slot - b.slot : a.section === 'conditioning' ? -1 : 1))
    const ath = ((att.data ?? []) as unknown as { athletes: Athlete }[]).map((r) => r.athletes).filter(Boolean)
      .sort((a, b) => a.last_name.localeCompare(b.last_name) || a.first_name.localeCompare(b.first_name))
    const res = its.length ? await supabase.from('results').select('session_item_id, athlete_id, value').in('session_item_id', its.map((x) => x.id)) : { data: [] }
    const map: Record<string, string> = {}
    for (const r of res.data ?? []) map[key(r.session_item_id, r.athlete_id)] = String(r.value)
    setSession(s.data as Session); setItems(its); setAthletes(ath); setSaved(map); setVals(map)
  }
  useEffect(() => { load() }, [id])

  const dirty = useMemo(() => {
    const keys = new Set([...Object.keys(vals), ...Object.keys(saved)])
    return [...keys].filter((k) => (vals[k] ?? '').trim() !== (saved[k] ?? ''))
  }, [vals, saved])

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if (dirty.length) { e.preventDefault(); e.returnValue = '' } }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty.length])

  async function save() {
    setBusy(true); setError(null); setNotice(null)
    const upserts: { session_item_id: string; athlete_id: string; value: number }[] = []
    const deletes: [string, string][] = []
    for (const k of dirty) {
      const [itemId, athleteId] = k.split('|')
      const v = (vals[k] ?? '').trim()
      if (v === '') deletes.push([itemId, athleteId])
      else if (isNaN(Number(v))) { setBusy(false); return setError(`"${v}" is not a number.`) }
      else upserts.push({ session_item_id: itemId, athlete_id: athleteId, value: Number(v) })
    }
    if (upserts.length) {
      const { error } = await supabase.from('results').upsert(upserts, { onConflict: 'session_item_id,athlete_id' })
      if (error) { setBusy(false); return setError(error.message) }
    }
    for (const [itemId, athleteId] of deletes) {
      const { error } = await supabase.from('results').delete().eq('session_item_id', itemId).eq('athlete_id', athleteId)
      if (error) { setBusy(false); return setError(error.message) }
    }
    const next = { ...saved }
    for (const k of dirty) { const v = (vals[k] ?? '').trim(); if (v === '') delete next[k]; else next[k] = String(Number(v)) }
    setSaved(next)
    setVals((cur) => { const c = { ...cur }; for (const k of dirty) { const v = (c[k] ?? '').trim(); c[k] = v === '' ? '' : String(Number(v)) } return c })
    setBusy(false)
    setNotice(`Saved ${upserts.length + deletes.length} change${upserts.length + deletes.length === 1 ? '' : 's'}.`)
  }

  if (!session) return error ? <ErrorNote error={error} /> : <Spinner />

  const input = (it: SessionItem, a: Athlete, cls: string, idx?: number) => {
    const k = key(it.id, a.id)
    return (
      <input className={cls} inputMode="decimal" enterKeyHint="next" value={vals[k] ?? ''} data-idx={idx}
        aria-label={`${a.first_name} ${a.last_name}: ${it.label} (${it.unit})`}
        onChange={(e) => setVals({ ...vals, [k]: e.target.value.replace(',', '.') })}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && idx != null) {
            e.preventDefault()
            ;(document.querySelector(`[data-idx="${idx + 1}"]`) as HTMLInputElement | null)?.focus()
          }
        }} />
    )
  }

  const cur = items[Math.min(active, items.length - 1)]
  const filled = (it: SessionItem) => athletes.filter((a) => (vals[key(it.id, a.id)] ?? '') !== '').length

  return (
    <>
      <PageHead
        back={{ to: '/app/sessions', label: 'Sessions' }}
        title={fmtDate(session.session_date)}
        sub={[session.coach_name && `Coach ${session.coach_name}`, session.location, `${athletes.length} athletes`].filter(Boolean).join(' · ')}
        actions={<Link to={`/app/sessions/${id}/setup`} className="btn">Edit setup</Link>}
      />
      {session.notes && <p className="muted">{session.notes}</p>}

      {items.length === 0 || athletes.length === 0 ? (
        <div className="card empty">This session needs at least one drill/exercise and one athlete. <Link to={`/app/sessions/${id}/setup`}>Edit setup</Link></div>
      ) : <>
        <div className="chips" style={{ marginBottom: '1rem' }} role="group" aria-label="Entry mode">
          <button className="chip" aria-pressed={mode === 'item'} onClick={() => setMode('item')}>One at a time</button>
          <button className="chip" aria-pressed={mode === 'sheet'} onClick={() => setMode('sheet')}>Full sheet</button>
        </div>

        {mode === 'item' ? (
          <>
            <div className="chips" style={{ marginBottom: '.75rem' }}>
              {items.map((it, i) => (
                <button key={it.id} className="chip" aria-pressed={it.id === cur.id} onClick={() => setActive(i)}>
                  {it.section === 'measure' ? 'M' : 'C'}{it.slot} · {it.label} <span style={{ opacity: .7 }}>({filled(it)}/{athletes.length})</span>
                </button>
              ))}
            </div>
            <div className="card" style={{ marginBottom: '.75rem' }}>
              <div className="spread">
                <div>
                  <span className={`tag ${cur.section === 'measure' ? '' : 'tag-gray'}`}>{cur.section === 'measure' ? `Measure ${cur.slot}` : `Conditioning ${cur.slot}`}</span>
                  <h2 style={{ margin: '.35rem 0 0' }}>{cur.label}</h2>
                  <div className="muted small">{cur.item_type === 'drill' ? 'Drill' : 'Exercise'} · recording {cur.unit} · {cur.better} is better</div>
                </div>
              </div>
            </div>
            <div className="entry-list">
              {athletes.map((a, i) => (
                <label className="entry-row" key={a.id}>
                  <span><strong>{a.last_name}</strong>, {a.first_name}</span>
                  {input(cur, a, 'input', i)}
                </label>
              ))}
            </div>
          </>
        ) : (
          <div className="table-wrap sheet">
            <table>
              <thead>
                <tr>
                  <th className="sticky" rowSpan={2}>Athlete</th>
                  {items.some((i) => i.section === 'conditioning') && <th colSpan={items.filter((i) => i.section === 'conditioning').length} className="section-cond">Conditioning</th>}
                  {items.some((i) => i.section === 'measure') && <th colSpan={items.filter((i) => i.section === 'measure').length} className="section-meas">Measure</th>}
                </tr>
                <tr>
                  {items.map((it) => <th key={it.id} className="colhead">{it.slot}. {it.label}<br /><span className="muted">{unitShort(it.unit)} · {it.better === 'lower' ? '↓ better' : '↑ better'}</span></th>)}
                </tr>
              </thead>
              <tbody>
                {athletes.map((a, r) => (
                  <tr key={a.id}>
                    <td className="sticky">{a.last_name}, {a.first_name}</td>
                    {items.map((it, c) => <td key={it.id}>{input(it, a, 'cell-input', 1000 + c * 1000 + r)}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="savebar">
          <span className={dirty.length ? '' : 'muted'}>
            {notice && !dirty.length ? notice : dirty.length ? `${dirty.length} unsaved change${dirty.length === 1 ? '' : 's'}` : 'All changes saved'}
          </span>
          <div className="row">
            {mode === 'item' && active < items.length - 1 && (
              <button className="btn" onClick={async () => { if (dirty.length) await save(); setActive(active + 1); window.scrollTo({ top: 0 }) }}>Save & next</button>
            )}
            <button className="btn btn-primary" disabled={!dirty.length || busy} onClick={save}>{busy ? 'Saving…' : 'Save'}</button>
          </div>
        </div>
        <ErrorNote error={error} />
      </>}
    </>
  )
}
