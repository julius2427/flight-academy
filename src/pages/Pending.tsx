import { useAuth } from '../lib/auth'

export default function Pending() {
  const { profile, signOut, refreshProfile } = useAuth()
  return (
    <div className="auth-wrap">
      <div className="auth-card stack" style={{ textAlign: 'center' }}>
        <img className="logo" src="./logo.png" alt="" />
        <h1 style={{ textTransform: 'uppercase', fontSize: '1.8rem' }}>Awaiting approval</h1>
        <p className="muted">
          You’re signed in as <strong>{profile?.email}</strong>. A Flight Academy admin needs to approve your coach
          access before athlete data is visible.
        </p>
        <button className="btn btn-primary btn-block" onClick={refreshProfile}>Check again</button>
        <button className="btn btn-block" onClick={signOut}>Sign out</button>
      </div>
    </div>
  )
}
