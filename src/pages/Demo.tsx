import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'

// Shared read-only demo login. Set via GitHub Actions secrets; leave unset to turn the demo off.
const DEMO_EMAIL = import.meta.env.VITE_DEMO_EMAIL as string | undefined
const DEMO_PASSWORD = import.meta.env.VITE_DEMO_PASSWORD as string | undefined
export const demoEnabled = Boolean(DEMO_EMAIL && DEMO_PASSWORD)

/** /demo — one-tap sign-in to the view-only demo account. */
export default function Demo() {
  const { session, profile, loading, isViewer } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const [confirmSwitch, setConfirmSwitch] = useState(false)

  useEffect(() => {
    if (!demoEnabled || loading) return
    if (session && isViewer) { navigate('/app', { replace: true }); return }
    if (session && !isViewer) { setConfirmSwitch(true); return }
    supabase.auth.signInWithPassword({ email: DEMO_EMAIL!, password: DEMO_PASSWORD! }).then(({ error }) => {
      if (error) setError('The demo is unavailable right now.')
      else { try { sessionStorage.removeItem('demo-ack') } catch { /* ignore */ } navigate('/app', { replace: true }) }
    })
  }, [loading, session, isViewer, navigate])

  async function switchToDemo() {
    await supabase.auth.signOut()
    setConfirmSwitch(false)
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card stack" style={{ textAlign: 'center' }}>
        <img className="logo" src="./logo.png" alt="" />
        {!demoEnabled || error ? <>
          <h1 style={{ textTransform: 'uppercase', fontSize: '1.6rem' }}>Demo unavailable</h1>
          <p className="muted">{error ?? 'The demo is turned off.'}</p>
          <Link to="/" className="btn btn-block">Back to home</Link>
        </> : confirmSwitch ? <>
          <h1 style={{ textTransform: 'uppercase', fontSize: '1.6rem' }}>Open the demo?</h1>
          <p className="muted">You’re signed in as <strong>{profile?.email}</strong>. Opening the demo will sign you out of that account.</p>
          <button className="btn btn-primary btn-block" onClick={switchToDemo}>Sign out &amp; open demo</button>
          <Link to="/app" className="btn btn-block">Stay signed in</Link>
        </> : <>
          <h1 style={{ textTransform: 'uppercase', fontSize: '1.6rem' }}>Opening demo…</h1>
          <div className="spinner" style={{ margin: '1rem auto' }} />
        </>}
      </div>
    </div>
  )
}
