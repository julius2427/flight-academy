import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'
import { IconBack } from './Icons'

export function PageHead({ title, back, actions, sub }: { title: ReactNode; back?: { to: string; label: string }; actions?: ReactNode; sub?: ReactNode }) {
  return (
    <>
      {back && <Link to={back.to} className="back"><IconBack /> {back.label}</Link>}
      <div className="page-head">
        <div>
          <h1>{title}</h1>
          {sub && <div className="muted">{sub}</div>}
        </div>
        {actions && <div className="row">{actions}</div>}
      </div>
    </>
  )
}

export const Spinner = () => <div className="spinner" aria-label="Loading" />

export function ErrorNote({ error }: { error: string | null }) {
  return error ? <div className="alert alert-error" role="alert">{error}</div> : null
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="field">
      <span>{label}{hint && <> <em>{hint}</em></>}</span>
      {children}
    </label>
  )
}
