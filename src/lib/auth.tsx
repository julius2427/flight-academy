import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import { isConfigured, supabase } from './supabase'
import type { Profile } from './types'

interface AuthState {
  session: Session | null
  profile: Profile | null
  loading: boolean
  isStaff: boolean
  isAdmin: boolean
  /** Read-only demo/observer access. */
  isViewer: boolean
  /** Can see the coach portal (staff or viewer). */
  canView: boolean
  /** Can add/edit/delete (staff only). */
  canEdit: boolean
  refreshProfile: () => Promise<void>
  signOut: () => Promise<void>
}

const Ctx = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(isConfigured)
  const [profileFor, setProfileFor] = useState<string | null>(null)
  const navigate = useNavigate()

  const loadProfile = useCallback(async (s: Session | null) => {
    if (!s) { setProfile(null); return }
    const { data } = await supabase.from('profiles').select('*').eq('id', s.user.id).maybeSingle()
    setProfile((data as Profile) ?? null)
    setProfileFor(s.user.id)
  }, [])

  useEffect(() => {
    if (!isConfigured) return
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session)
      await loadProfile(data.session)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s)
      // Defer DB work out of the auth callback (supabase-js recommendation).
      setTimeout(() => { loadProfile(s) }, 0)
      if (event === 'PASSWORD_RECOVERY') navigate('/reset-password')
    })
    // Clean ?code=… off the URL after the PKCE exchange.
    if (window.location.search.includes('code=')) {
      window.history.replaceState(null, '', window.location.pathname + window.location.hash)
    }
    return () => sub.subscription.unsubscribe()
  }, [loadProfile, navigate])

  const value: AuthState = {
    session,
    profile,
    // Also "loading" while the signed-in user's profile hasn't arrived yet.
    loading: loading || (!!session && profileFor !== session.user.id),
    isStaff: profile?.role === 'coach' || profile?.role === 'admin',
    isAdmin: profile?.role === 'admin',
    isViewer: profile?.role === 'viewer',
    canView: profile?.role === 'coach' || profile?.role === 'admin' || profile?.role === 'viewer',
    canEdit: profile?.role === 'coach' || profile?.role === 'admin',
    refreshProfile: () => loadProfile(session),
    signOut: async () => { await supabase.auth.signOut(); navigate('/') },
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAuth() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useAuth outside AuthProvider')
  return v
}
