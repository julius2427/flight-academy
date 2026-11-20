import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { ErrorNote, Field } from '../components/Ui'

export default function ResetPassword() {
  const [pw, setPw] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true); setError(null)
    const { error } = await supabase.auth.updateUser({ password: pw })
    setBusy(false)
    if (error) setError(error.message)
    else navigate('/app')
  }

  return (
    <div className="auth-wrap">
      <form className="auth-card stack" onSubmit={submit}>
        <img className="logo" src="./logo.png" alt="" />
        <h1 style={{ textAlign: 'center', textTransform: 'uppercase', fontSize: '1.8rem' }}>Set a new password</h1>
        <Field label="New password"><input className="input" type="password" minLength={8} required value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" /></Field>
        <ErrorNote error={error} />
        <button className="btn btn-primary btn-block" disabled={busy}>{busy ? 'Saving…' : 'Save password'}</button>
      </form>
    </div>
  )
}
