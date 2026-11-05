import { useEffect, useRef, useState } from 'react'
import Icon from '../components/Icon.jsx'
import { savePhoto, photoUrl } from '../lib/nutrition/photos.js'
import { tap, ok, warn } from '../lib/nutrition/haptics.js'

function Thumb({ id, className = '' }) {
  const [src, setSrc] = useState(null)
  useEffect(() => { let on = true; photoUrl(id).then(u => on && setSrc(u)).catch(() => {}); return () => { on = false } }, [id])
  return src ? <img className={className} src={src} alt="Meal" /> : <span className={'ng-ph-empty ' + className} />
}

// Thumbnails of a meal's photos. Tap one to see it full size.
export function PhotoStrip({ shots, onOpen }) {
  if (!shots.length) return null
  return <div className="ng-photos">{shots.map(s => <button key={s.id} className="ng-ph" onClick={() => { tap(); onOpen(s) }} aria-label="Open meal photo"><Thumb id={s.id} /></button>)}</div>
}

// "Photo" button of a meal card: take a picture or choose one. The picture is shrunk and stored on the phone only.
export function AddPhoto({ at, onAdded }) {
  const cam = useRef(null), pick = useRef(null)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const onFile = async e => {
    const f = e.target.files && e.target.files[0]
    e.target.value = ''
    if (!f) return
    setBusy(true); setErr('')
    try { const id = await savePhoto(f); onAdded({ id, at }); ok(); setOpen(false) } catch { warn(); setErr('Couldn’t save that photo.') } finally { setBusy(false) }
  }
  return <>
    <button className="ng-act" onClick={() => { tap(); setOpen(!open) }} disabled={busy}><Icon name="camera" /><span>{busy ? 'Saving…' : 'Photo'}</span></button>
    {open && <span className="ng-actrow">
      <button className="ng-chip" onClick={() => cam.current?.click()}>Take photo</button>
      <button className="ng-chip ghost" onClick={() => pick.current?.click()}>Choose</button>
    </span>}
    <input ref={cam} type="file" accept="image/*" capture="environment" hidden onChange={onFile} />
    <input ref={pick} type="file" accept="image/*" hidden onChange={onFile} />
    {err && <span className="ng-err ng-actmsg">{err}</span>}
  </>
}

export function Lightbox({ shot, onClose, onDelete }) {
  return <div className="ng-scrim ng-lightbox" onClick={onClose}>
    <div className="ng-lbbody" onClick={e => e.stopPropagation()}>
      <Thumb id={shot.id} className="ng-lbimg" />
      <div className="ng-row">
        <button className="ng-btn ghost" onClick={onClose}>Close</button>
        <button className="ng-btn ghost danger" onClick={() => onDelete(shot)}><Icon name="trash" /> Delete</button>
      </div>
      <p className="ng-muted">Stored only on this phone. Photos are not part of Diet backup.</p>
    </div>
  </div>
}
