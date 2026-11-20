import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { ErrorNote, Field, PageHead } from '../components/Ui'

/** Signed-in users can change their own password (no email needed). */
export default function Account() {
  const { profile } = useAuth()
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function save(e: FormEvent) {
    e.preventDefault()
    setError(null); setDone(false)
    if (pw !== pw2) return setError('The two passwords don’t match.')
    setBusy(true)
    const { error } = await supabase.auth.updateUser({ password: pw })
    setBusy(false)
    if (error) return setError(error.message)
    setPw(''); setPw2(''); setDone(true)
  }

  return (
    <>
      <PageHead title="My account" sub={[profile?.full_name, profile?.email, profile?.role].filter(Boolean).join(' · ')} />
      <form className="card stack" onSubmit={save} style={{ maxWidth: 480 }}>
        <h3 style={{ margin: 0 }}>Change password</h3>
        <Field label="New password" hint="(at least 8 characters)">
          <input className="input" type="password" minLength={8} required autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
        </Field>
        <Field label="Confirm new password">
          <input className="input" type="password" minLength={8} required autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
        </Field>
        <ErrorNote error={error} />
        {done && <div className="alert alert-ok">Password updated. Use it next time you sign in.</div>}
        <div><button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Update password'}</button></div>
      </form>
    </>
  )
}
