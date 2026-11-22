export type Role = 'pending' | 'coach' | 'admin' | 'viewer' | 'athlete' | 'guardian'

export interface Profile {
  id: string
  email: string | null
  full_name: string | null
  role: Role
  created_at: string
}

export interface Athlete {
  id: string
  first_name: string
  last_name: string
  birth_date: string | null
  grade: string | null
  school: string | null
  sport: string | null
  position: string | null
  team_group: string | null
  guardian_name: string | null
  guardian_email: string | null
  guardian_phone: string | null
  active: boolean
  notes: string | null
}

export interface Category { id: number; name: string; examples: string }

export interface Exercise {
  id: string
  title: string
  created_on: string
  setup: string | null
  setup_image: string | null
  steps: string[]
  category_id: number | null
  distance_value: number | null
  distance_unit: string | null
  time_value: number | null
  time_unit: string | null
  reps_value: number | null
  reps_unit: string | null
  score_unit: Unit
  better: Better
}

export interface Drill {
  id: string
  title: string
  created_on: string
  setup: string | null
  setup_image: string | null
  steps: string[]
  score_unit: Unit
  better: Better
  drill_exercises?: { position: number; exercise_id: string | null; label: string | null }[]
  drill_categories?: { rank: number; category_id: number }[]
}

export interface Session {
  id: string
  session_date: string
  coach_name: string | null
  location: string | null
  notes: string | null
}

export type Section = 'conditioning' | 'measure'
export type ItemType = 'drill' | 'exercise'
export type Better = 'higher' | 'lower'

export interface SessionItem {
  id: string
  session_id: string
  section: Section
  slot: number
  item_type: ItemType
  drill_id: string | null
  exercise_id: string | null
  label: string
  unit: Unit
  better: Better
}

export interface ResultRow {
  id: string
  athlete_id: string
  value: number
  session_item_id: string
  section: Section
  item_type: ItemType
  label: string
  unit: Unit
  better: Better
  session_id: string
  session_date: string
  category_id: number | null
  measure_key: string
}

export type Unit = 'reps' | 'seconds' | 'meters' | 'yards' | 'inches' | 'lbs'
