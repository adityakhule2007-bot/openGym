import { useState } from 'react'
import Icon from '../components/Icon.jsx'
import { useNutrition, uid } from '../lib/nutrition/store.js'
import { TAGS, tagLabel, entriesFromTemplate, templateTotals } from '../lib/nutrition/templates.js'
import { addDaysIso } from '../lib/nutrition/meet.js'
import { todayISO } from '../lib/format.js'
import { ok, tap } from '../lib/nutrition/haptics.js'

const r0 = n => Math.round(n)

// A bottom sheet with a title. `onClose` is the scrim and the X.
export function MiniSheet({ title, onClose, children }) {
  return <div className="ng-scrim" onClick={onClose}><div className="ng-sheet" onClick={e => e.stopPropagation()} role="dialog" aria-label={title}>
    <div className="ng-sheet-hd"><b>{title}</b><button className="iconbtn" onClick={onClose} aria-label="Close"><Icon name="xmark" /></button></div>
    {children}
  </div></div>
}

// Save a meal or a whole day as a reusable meal: a name and the kind of day it is for.
export function SaveMealSheet({ title, defaultName, defaultTag = 'any', onSave, onClose }) {
  const [name, setName] = useState(defaultName || '')
  const [tag, setTag] = useState(defaultTag)
  return <MiniSheet title={title} onClose={onClose}>
    <div className="ng-form">
      <input className="ng-in" autoFocus placeholder="Name (e.g. Heavy day, Post-workout shake)" value={name} maxLength={60} onChange={e => setName(e.target.value)} />
      <div className="ng-sec first">Best for</div>
      <div className="ng-seg">{TAGS.map(t => <button key={t.id} className={tag === t.id ? 'on' : ''} onClick={() => { tap(); setTag(t.id) }}>{t.label}</button>)}</div>
      <p className="ng-muted">Training and rest day meals are suggested on the matching day, from your openGym plan and workouts.</p>
      <button className="ng-btn" disabled={!name.trim()} onClick={() => { ok(); onSave(name.trim(), tag) }}>Save meal</button>
    </div>
  </MiniSheet>
}

// Copy meals to another day.
export function CopySheet({ day, count, onPick, onClose }) {
  const today = todayISO()
  const [other, setOther] = useState('')
  const opts = [['Today', today], ['Tomorrow', addDaysIso(today, 1)], ['Yesterday', addDaysIso(today, -1)]].filter(([, d]) => d !== day)
  return <MiniSheet title={`Copy ${count} item${count === 1 ? '' : 's'} to…`} onClose={onClose}>
    <div className="ng-form">
      <div className="ng-copyopts">{opts.map(([l, d]) => <button key={l} className="ng-btn ghost" onClick={() => onPick(d)}>{l}</button>)}</div>
      <label className="ng-f"><span>Another day</span><input className="ng-in" type="date" value={other} onChange={e => setOther(e.target.value)} /></label>
      <button className="ng-btn" disabled={!other || other === day} onClick={() => onPick(other)}>Copy to this day</button>
      <p className="ng-muted">Meal times are kept, so the copies land in the same meals.</p>
    </div>
  </MiniSheet>
}

// Saved meals and day templates: add one to the diary in a tap.
export function MealsList({ day, onApplied }) {
  const templates = useNutrition(s => s.templates)
  const addEntries = useNutrition(s => s.addEntries)
  const touch = useNutrition(s => s.touchTemplate)
  const del = useNutrition(s => s.deleteTemplate)
  const [sure, setSure] = useState(null)
  if (!templates.length) return <div className="ng-list"><p className="ng-muted">No saved meals yet. On the Diary, tap “Save meal” on any meal, or “Save day” to keep a whole day, and pick Training or Rest day. They show up here, and the matching one is suggested each morning.</p></div>
  return <div className="ng-list">{templates.map(t => {
    const tot = templateTotals(t)
    return <div className="ng-tpl" key={t.id}>
      <div className="ng-tplmain"><b>{t.name}</b>
        <small><em className={'ng-tag ' + t.tag}>{tagLabel(t.tag)}</em> {t.items.length} item{t.items.length === 1 ? '' : 's'} · {r0(tot[0])} kcal · {r0(tot[1])}P {r0(tot[2])}C {r0(tot[3])}F</small></div>
      <button className="ng-chip" onClick={() => { addEntries(entriesFromTemplate(t, day, uid)); touch(t.id); ok(); onApplied() }}>Add</button>
      {sure === t.id
        ? <button className="ng-chip ghost danger" onClick={() => { del(t.id); setSure(null) }}>Delete?</button>
        : <button className="iconbtn" onClick={() => setSure(t.id)} aria-label={'Delete ' + t.name}><Icon name="trash" /></button>}
    </div>
  })}</div>
}
