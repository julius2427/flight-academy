import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const isConfigured = Boolean(url && key)

// Skip navigator.locks: a crashed tab can otherwise stall session restore.
const noopLock = async <R,>(_n: string, _t: number, fn: () => Promise<R>): Promise<R> => fn()

export const supabase = createClient(url || 'http://localhost', key || 'missing-key', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    // PKCE puts the auth code in ?code= (not #...), which plays nicely with HashRouter.
    flowType: 'pkce',
    lock: noopLock,
  },
})

/** Where Supabase email links (confirm / reset password) should land. */
export function siteUrl(): string {
  return window.location.origin + window.location.pathname
}
