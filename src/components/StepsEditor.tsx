export default function StepsEditor({ steps, onChange, placeholder }: { steps: string[]; onChange: (s: string[]) => void; placeholder: string }) {
  const six = [...steps, '', '', '', '', '', ''].slice(0, 6)
  return (
    <div className="steps">
      {six.map((s, i) => (
        <div className="step" key={i}>
          <b>{i + 1}</b>
          <input className="input" value={s} placeholder={i === 0 ? placeholder : ''} aria-label={`Step ${i + 1}`}
            onChange={(e) => { const n = [...six]; n[i] = e.target.value; onChange(n) }} />
        </div>
      ))}
    </div>
  )
}
export const cleanSteps = (s: string[]) => s.map((x) => x.trim()).filter(Boolean).slice(0, 6)
