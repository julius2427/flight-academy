import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

/** Setup diagram / whiteboard photo, stored privately in the 'setups' bucket. */
export function SetupImage({ path }: { path: string | null }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!path) return setUrl(null)
    supabase.storage.from('setups').createSignedUrl(path, 3600).then(({ data }) => setUrl(data?.signedUrl ?? null))
  }, [path])
  return url ? <img className="setup-img" src={url} alt="Setup diagram" /> : null
}

export function SetupUpload({ path, onChange, folder }: { path: string | null; onChange: (p: string | null) => void; folder: string }) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  async function upload(file: File) {
    setBusy(true); setErr(null)
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const p = `${folder}/${crypto.randomUUID()}.${ext}`
    const { error } = await supabase.storage.from('setups').upload(p, file, { contentType: file.type })
    setBusy(false)
    if (error) return setErr(error.message)
    if (path) supabase.storage.from('setups').remove([path])
    onChange(p)
  }
  return (
    <div className="stack">
      <SetupImage path={path} />
      <div className="row">
        <label className="btn btn-sm">
          {busy ? 'Uploading…' : path ? 'Replace photo/diagram' : 'Add photo/diagram'}
          <input type="file" accept="image/*" className="sr-only" disabled={busy}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = '' }} />
        </label>
        {path && <button type="button" className="btn btn-sm btn-ghost" onClick={() => { supabase.storage.from('setups').remove([path]); onChange(null) }}>Remove</button>}
      </div>
      {err && <div className="alert alert-error small">{err}</div>}
    </div>
  )
}
