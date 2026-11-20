import { CATEGORIES } from '../lib/constants'

export default function CategorySelect({ value, onChange, label, required, exclude = [] }: { value: number | null; onChange: (v: number | null) => void; label: string; required?: boolean; exclude?: number[] }) {
  return (
    <select className="select" value={value ?? ''} required={required} aria-label={label}
      onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}>
      <option value="">{required ? 'Select a category…' : '— none —'}</option>
      {CATEGORIES.filter((c) => c.id === value || !exclude.includes(c.id)).map((c) => (
        <option key={c.id} value={c.id}>{c.id}. {c.name} ({c.examples})</option>
      ))}
    </select>
  )
}
