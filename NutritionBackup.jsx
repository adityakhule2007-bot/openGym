import { useRef, useState } from 'react'
import Icon from '../components/Icon.jsx'
import { MOBILE, shareExport } from '../lib/mobile.js'
import { todayISO } from '../lib/format.js'
import { useNutrition } from '../lib/nutrition/store.js'
import { buildBackup, parseBackup, mergeData, replaceData } from '../lib/nutrition/backup.js'

const LAST = 'opengym:nutrition:last-export'
const lastExport = () => { try { return localStorage.getItem(LAST) } catch { return null } }
const count = (n, one, many = one + 's') => `${n} ${n === 1 ? one : many}`
const MSG = { 'not-a-backup': 'That file is not an openGym diet backup.', newer: 'That backup is from a newer version of the app.', empty: 'That backup has no meals, water or foods in it.' }

// Export / import of the diet (diary, water, My foods, goals). A separate file from openGym's own backup.
export default function NutritionBackup() {
  const file = useRef(null)
  const [msg, setMsg] = useState('')
  const [pending, setPending] = useState(null)   // parsed backup waiting for merge / replace
  const [last, setLast] = useState(lastExport())

  const doExport = async () => {
    const s = useNutrition.getState()
    const json = JSON.stringify(buildBackup(s), null, 2), name = 'opengym-diet-' + todayISO() + '.json'
    try {
      if (MOBILE) await shareExport(json, name)
      else { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 60000) }
      const d = new Date().toLocaleDateString(); try { localStorage.setItem(LAST, d) } catch { /* ignore */ } setLast(d)
      setMsg(`Backup exported: ${count(s.entries.length, 'meal')}, ${count(s.customFoods.length, 'food')}, ${count((s.caffeine || []).length, 'caffeine entry')}.`)
    } catch { setMsg('') /* share sheet dismissed */ }
  }
  const onFile = async ev => {
    const f = ev.target.files[0]; ev.target.value = ''
    if (!f) return
    if (f.size > 25e6) return setMsg('That file is too large to be a diet backup.')
    try { setPending(parseBackup(await f.text())); setMsg('') } catch (e) { setPending(null); setMsg(MSG[e.message] || 'Could not read that file.') }
  }
  const apply = mode => {
    const st = useNutrition.getState()
    st.setData(mode === 'merge' ? mergeData(st, pending) : replaceData(pending))
    setMsg(`Imported ${count(pending.entries.length, 'meal')}, ${count(pending.customFoods.length, 'food')}, ${count((pending.caffeine || []).length, 'caffeine entry')}${pending.skipped ? ` (${pending.skipped} unreadable rows skipped)` : ''}.`)
    setPending(null)
  }
  const hasData = useNutrition(s => s.entries.length + s.customFoods.length + (s.caffeine || []).length) > 0

  return <div className="card ng-form ng-backup">
    <div className="ng-cardhd"><b>Diet backup</b><small>{last ? 'Last: ' + last : 'Never exported'}</small></div>
    <p className="ng-muted">Your diary, water, My foods and goals are not in openGym’s own backup. Export them here to keep a copy, or move to a new phone.</p>
    {hasData && !last && <p className="ng-warn">You have a diet log but no backup yet.</p>}
    <div className="ng-row">
      <button className="ng-btn" onClick={doExport}><Icon name="share" /> Export</button>
      <button className="ng-btn ghost" onClick={() => file.current?.click()}><Icon name="download" /> Import</button>
    </div>
    <input ref={file} type="file" accept="application/json,.json" hidden onChange={onFile} />
    {pending && <div className="ng-pending">
      <b>Backup found</b>
      <small>{count(pending.entries.length, 'meal')} · {count(pending.water.length, 'water entry', 'water entries')} · {count(pending.customFoods.length, 'food')} · {count((pending.caffeine || []).length, 'caffeine entry')}</small>
      <div className="ng-row">
        <button className="ng-btn" onClick={() => apply('merge')}>Merge</button>
        <button className="ng-btn ghost" onClick={() => apply('replace')}>Replace all</button>
        <button className="ng-btn ghost" onClick={() => setPending(null)}>Cancel</button>
      </div>
      <small>Merge keeps what is on this phone and adds the rest. Replace swaps everything, including goals.</small>
    </div>}
    {msg && <p className="ng-note" role="status">{msg}</p>}
  </div>
}
