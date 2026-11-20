import type { Better, Unit } from '../lib/types'
import { UNITS, defaultBetter } from '../lib/constants'
import { Field } from './Ui'

/** How results for this exercise/drill are recorded in sessions. */
export default function ScoringEditor({ unit, better, onChange }: { unit: Unit; better: Better; onChange: (unit: Unit, better: Better) => void }) {
  return (
    <div className="card stack">
      <div>
        <h3 style={{ margin: 0 }}>Scoring</h3>
        <div className="muted small">How athletes are scored when this is used in a session. Set once here; every session uses it.</div>
      </div>
      <div className="grid-2">
        <Field label="Record results in">
          <select className="select" value={unit} onChange={(e) => { const u = e.target.value as Unit; onChange(u, defaultBetter(u)) }}>
            {UNITS.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
          </select>
        </Field>
        <Field label="A better result is">
          <select className="select" value={better} onChange={(e) => onChange(unit, e.target.value as Better)}>
            <option value="lower">Lower (e.g. a faster time)</option>
            <option value="higher">Higher (e.g. more reps, farther, longer hold)</option>
          </select>
        </Field>
      </div>
    </div>
  )
}
