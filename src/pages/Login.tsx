import { useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { isConfigured, siteUrl, supabase } from '../lib/supabase'
import { ErrorNote, Field } from '../components/Ui'

type Mode = 'signin' | 'signup' | 'forgot'

export default function Login() {
  const { session, loading } = useAuth()
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  if (!loading && session) return <Navigate to="/app" replace />

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true); setError(null); setNotice(null)
    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      } else if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email, password, options: { data: { full_name: name }, emailRedirectTo: siteUrl() },
        })
        if (error) throw error
        if (!data.session) setNotice('Check your email to confirm your account, then sign in. A Flight Academy admin will approve your coach access.')
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: siteUrl() })
        if (error) throw error
        setNotice('If that email has an account, a reset link is on its way. Open it on this same device.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <Link to="/"><img className="logo" src="./logo.png" alt="Flight Academy home" /></Link>
        <h1 style={{ textAlign: 'center', textTransform: 'uppercase', fontSize: '1.8rem' }}>
          {mode === 'signin' ? 'Coach Login' : mode === 'signup' ? 'Request Access' : 'Reset Password'}
        </h1>
        <p className="muted" style={{ textAlign: 'center' }}>Forward…Fast</p>

        {!isConfigured && (
          <div className="alert alert-warn" style={{ marginBottom: '1rem' }}>
            Database not connected yet. Add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> (see README).
          </div>
        )}

        <form onSubmit={submit} className="stack">
          {mode === 'signup' && (
            <Field label="Full name"><input className="input" value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" /></Field>
          )}
          <Field label="Email"><input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" inputMode="email" /></Field>
          {mode !== 'forgot' && (
            <Field label="Password"><input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} /></Field>
          )}
          <ErrorNote error={error} />
          {notice && <div className="alert alert-ok">{notice}</div>}
          <button className="btn btn-primary btn-block" disabled={busy || !isConfigured}>
            {busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Create account' : 'Send reset link'}
          </button>
        </form>

        <div className="row" style={{ justifyContent: 'center', marginTop: '1rem', fontSize: '.92rem' }}>
          {mode !== 'signin' && <button className="btn btn-ghost btn-sm" onClick={() => setMode('signin')}>Back to sign in</button>}
          {mode === 'signin' && <>
            <button className="btn btn-ghost btn-sm" onClick={() => setMode('signup')}>New coach? Request access</button>
            <button className="btn btn-ghost btn-sm" onClick={() => setMode('forgot')}>Forgot password</button>
          </>}
        </div>
      </div>
    </div>
  )
}
