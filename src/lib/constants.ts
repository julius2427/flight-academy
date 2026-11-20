import type { Better, Category, Unit } from './types'

// Mirrors the categories seeded in supabase/schema.sql (PDF p.6–7).
export const CATEGORIES: Category[] = [
  { id: 1, name: 'Strength', examples: 'weight lifting, bodyweight, resistance bands' },
  { id: 2, name: 'Speed', examples: 'sprints, squats, jumps' },
  { id: 3, name: 'Agility', examples: 'cones, shuffles, reaction, directional' },
  { id: 4, name: 'Coordination and Balance', examples: 'balance, eye-hand coordination' },
  { id: 5, name: 'Endurance', examples: 'distance run, circuit training' },
  { id: 6, name: 'Flexibility', examples: 'stretches, range of motion' },
  { id: 7, name: 'Sport-Specific Skills', examples: 'passing, blocking, position-specific' },
]

export const categoryName = (id: number | null | undefined) =>
  CATEGORIES.find((c) => c.id === id)?.name ?? 'Uncategorized'

export const UNITS: { value: Unit; label: string; short: string }[] = [
  { value: 'seconds', label: 'Seconds', short: 's' },
  { value: 'reps', label: '# Reps', short: 'reps' },
  { value: 'meters', label: 'Meters', short: 'm' },
  { value: 'yards', label: 'Yards', short: 'yd' },
  { value: 'inches', label: 'Inches', short: 'in' },
  { value: 'lbs', label: 'Pounds', short: 'lb' },
]

export const unitShort = (u: string) => UNITS.find((x) => x.value === u)?.short ?? u
export const unitLabel = (u: string) => UNITS.find((x) => x.value === u)?.label ?? u
export const scoringText = (u: string, b: Better) => `${unitLabel(u)} · ${b === 'lower' ? '↓ lower' : '↑ higher'} is better`

/** Timed drills: lower is better. Everything else: higher is better. */
export const defaultBetter = (u: Unit): Better => (u === 'seconds' ? 'lower' : 'higher')

export const isBetter = (a: number, b: number, better: Better) => (better === 'lower' ? a < b : a > b)

export function fmtDate(d: string | null | undefined) {
  if (!d) return ''
  const [y, m, day] = d.slice(0, 10).split('-').map(Number)
  return new Date(y, m - 1, day).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

export function fmtNum(n: number) {
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')
}

export function ageFrom(birth: string | null) {
  if (!birth) return null
  const b = new Date(birth + 'T00:00:00')
  const now = new Date()
  let a = now.getFullYear() - b.getFullYear()
  if (now < new Date(now.getFullYear(), b.getMonth(), b.getDate())) a--
  return a
}

export const todayISO = () => {
  const d = new Date()
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}
