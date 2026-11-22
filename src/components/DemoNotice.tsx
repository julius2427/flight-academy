import { useEffect, useRef, useState } from 'react'

const KEY = 'demo-ack'

/** Shown once per browser session to demo (viewer) users. */
export default function DemoNotice() {
  const [open, setOpen] = useState(() => { try { return sessionStorage.getItem(KEY) !== '1' } catch { return true } })
  const btn = useRef<HTMLButtonElement>(null)
  useEffect(() => { if (open) btn.current?.focus() }, [open])
  if (!open) return null
  const close = () => { try { sessionStorage.setItem(KEY, '1') } catch { /* ignore */ } setOpen(false) }
  return (
    <div className="modal-backdrop" onKeyDown={(e) => e.key === 'Escape' && close()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="demo-title">
        <img src="./logo.png" alt="" className="modal-logo" />
        <h2 id="demo-title">This is a demo</h2>
        <p>
          Everything you’ll see (athletes, names, scores, and sessions) is <strong>made-up sample data</strong>.
          None of it belongs to a real person.
        </p>
        <p>
          In the live program, athlete information is treated as protected minors’ data: it’s visible only to approved
          Flight Academy coaches, never to public or demo accounts, and access is reviewed and locked down before any
          real athlete is entered.
        </p>
        <p className="muted small">This demo is view-only. Explore freely; nothing can be changed.</p>
        <button ref={btn} className="btn btn-primary btn-block" onClick={close}>Got it, show me the demo</button>
      </div>
    </div>
  )
}
