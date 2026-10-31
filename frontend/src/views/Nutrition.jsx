import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { effectiveRoutines } from '../lib/history.js'
import { todayISO } from '../lib/format.js'
import Icon from '../components/Icon.jsx'
import { useNutrition } from '../lib/nutrition/store.js'
import { applyGlass, glassOn } from '../lib/nutrition/glass.js'
import {
  META, ORDER, GNAME, IDX, dayKey, hhmm, atOf, dayTotals, mealLabel, coachTips,
  entryFromFood, entryFromMacros, searchFoods, foodFromRow,
} from '../lib/nutrition/engine.js'
import './nutrition.css'

const url = name => new URL('nutrition/' + name, document.baseURI).href
const r0 = n => Math.round(n)
const fmt = x => (x >= 10 ? String(Math.round(x)) : x >= 1 ? String(Math.round(x * 10) / 10) : String(Math.round(x * 100) / 100))
const addDays = (iso, n) => { const [y, m, d] = iso.split('-').map(Number); return dayKey(new Date(y, m - 1, d + n).getTime()) }

let coreCache = null, moreCache = null
const loadCore = () => coreCache || (coreCache = fetch(url('foods-core.json')).then(r => r.json()))
const loadMore = () => moreCache || (moreCache = fetch(url('foods-more.json')).then(r => r.json()).then(d => d.rows.map(foodFromRow)))

function Ring({ value, goal }) {
  const R = 52, C = 2 * Math.PI * R, pct = Math.min(1, value / Math.max(1, goal))
  return <svg viewBox="0 0 120 120" className="ng-ring" aria-hidden="true">
    <circle cx="60" cy="60" r={R} className="ng-ring-bg" />
    <circle cx="60" cy="60" r={R} className="ng-ring-fg" strokeDasharray={`${C * pct} ${C}`} transform="rotate(-90 60 60)" />
  </svg>
}
const Bar = ({ label, v, goal, unit = 'g', cls }) => <div className="ng-bar">
  <div className="ng-bar-top"><span>{label}</span><b>{r0(v)} / {goal} {unit}</b></div>
  <div className="ng-track"><i className={cls} style={{ width: Math.min(100, v / Math.max(1, goal) * 100) + '%' }} /></div>
</div>

function AddSheet({ day, onClose }) {
  const add = useNutrition(s => s.addEntry)
  const [tab, setTab] = useState('search')
  const [q, setQ] = useState('')
  const [core, setCore] = useState(null)
  const [more, setMore] = useState(null)
  const [pick, setPick] = useState(null)
  const [qty, setQty] = useState('')
  const [time, setTime] = useState(hhmm(Date.now()))
  const [quick, setQuick] = useState({ name: '', k: '', p: '', c: '', f: '' })
  useEffect(() => { loadCore().then(d => setCore(d.foods)).catch(() => setCore([])) }, [])
  useEffect(() => { if (q.length >= 2 && !more) loadMore().then(setMore).catch(() => setMore([])) }, [q, more])
  const results = useMemo(() => (core && q.trim() ? searchFoods(core, more, q) : []), [core, more, q])
  const at = () => atOf(day, time)
  const choose = f => { setPick(f); setQty(String(f.u === 'g' ? (f.sg || 100) : 1)) }
  const confirm = () => {
    const n = parseFloat(qty); if (!(n > 0)) return
    add(entryFromFood(pick, n, at())); onClose()
  }
  const addQuick = () => {
    const k = parseFloat(quick.k) || 0; if (!quick.name.trim() || !k) return
    add(entryFromMacros(quick.name.trim(), k, parseFloat(quick.p) || 0, parseFloat(quick.c) || 0, parseFloat(quick.f) || 0, at())); onClose()
  }
  const unitLabel = pick ? (pick.u === 'g' ? 'grams' : 'servings') : ''
  return <div className="ng-scrim" onClick={onClose}>
    <div className="ng-sheet" onClick={e => e.stopPropagation()} role="dialog" aria-label="Add food">
      <div className="ng-sheet-hd"><b>{pick ? pick.n : 'Add food'}</b><button className="iconbtn" onClick={onClose} aria-label="Close"><Icon name="xmark" /></button></div>
      {!pick && <>
        <div className="ng-seg"><button className={tab === 'search' ? 'on' : ''} onClick={() => setTab('search')}>Search</button><button className={tab === 'quick' ? 'on' : ''} onClick={() => setTab('quick')}>Quick add</button></div>
        {tab === 'search' && <>
          <input className="ng-in" autoFocus placeholder="Search foods, dishes, brands…" value={q} onChange={e => setQ(e.target.value)} />
          <div className="ng-list">
            {!q.trim() && <p className="ng-muted">{core ? core.length : '…'} built-in foods (IFCT 2017) plus a ~40,000-item library once you start typing.</p>}
            {q.trim() && !results.length && <p className="ng-muted">{core ? 'Nothing found. Try another word, or use Quick add.' : 'Loading…'}</p>}
            {results.map(f => <button key={f.id} className="ng-item" onClick={() => choose(f)}>
              <span>{f.n}</span><small>{f.u === 'g' ? 'per 100 g · ' + r0(f.v[0]) + ' kcal' : (f.s || '1 serving') + ' · ' + r0(f.v[0]) + ' kcal'}</small>
            </button>)}
            {q.trim() && more == null && q.length >= 2 && <p className="ng-muted">Loading the full library…</p>}
          </div>
        </>}
        {tab === 'quick' && <div className="ng-form">
          <input className="ng-in" placeholder="Name" value={quick.name} onChange={e => setQuick({ ...quick, name: e.target.value })} />
          <div className="ng-grid4">
            {[['k', 'kcal'], ['p', 'Protein g'], ['c', 'Carbs g'], ['f', 'Fat g']].map(([k, l]) =>
              <label key={k}>{l}<input className="ng-in" inputMode="decimal" value={quick[k]} onChange={e => setQuick({ ...quick, [k]: e.target.value })} /></label>)}
          </div>
          <label>Time<input className="ng-in" type="time" value={time} onChange={e => setTime(e.target.value)} /></label>
          <button className="ng-btn" onClick={addQuick}>Add</button>
        </div>}
      </>}
      {pick && <div className="ng-form">
        <label>Amount ({unitLabel}){pick.u === 's' && pick.s ? ' · 1 = ' + pick.s : ''}<input className="ng-in" inputMode="decimal" autoFocus value={qty} onChange={e => setQty(e.target.value)} /></label>
        <label>Time<input className="ng-in" type="time" value={time} onChange={e => setTime(e.target.value)} /></label>
        {(() => { const n = parseFloat(qty) || 0; const e = entryFromFood(pick, n, 0); return <p className="ng-muted">{r0(e.v[0])} kcal · {r0(e.v[1])} P · {r0(e.v[2])} C · {r0(e.v[3])} F</p> })()}
        <div className="ng-row"><button className="ng-btn ghost" onClick={() => setPick(null)}>Back</button><button className="ng-btn" onClick={confirm}>Add</button></div>
      </div>}
    </div>
  </div>
}

export default function Nutrition() {
  const nav = useNavigate()
  const S = useStore(s => s.S)
  const { entries, water, goals, removeEntry, addWater, undoWater, setGoals } = useNutrition()
  const [tab, setTab] = useState('today')
  const [day, setDay] = useState(todayISO())
  const [sheet, setSheet] = useState(false)
  const [glass, setGlass] = useState(glassOn())
  const isToday = day === todayISO()

  const dayEntries = useMemo(() => entries.filter(e => dayKey(e.at) === day).sort((a, b) => a.at - b.at), [entries, day])
  const dayWater = useMemo(() => water.filter(w => dayKey(w.at) === day).reduce((a, w) => a + w.ml, 0), [water, day])
  const tot = useMemo(() => dayTotals(dayEntries), [dayEntries])
  const unit = S.unit === 'lb' ? 'lb' : 'kg'
  const bw = S.bodyweight?.length ? Number(S.bodyweight[S.bodyweight.length - 1].w) : 0
  const bodyKg = bw > 0 ? (unit === 'lb' ? bw * 0.4536 : bw) : 75
  const plannedToday = isToday && !S.workouts.some(w => w.d === day) && effectiveRoutines(S, day).some(r => r.ex.length)
  const tips = useMemo(() => isToday ? coachTips({ entries: dayEntries, waterMl: dayWater, goals, workouts: S.workouts, unit, bodyKg, plannedToday }) : [],
    [isToday, dayEntries, dayWater, goals, S.workouts, unit, bodyKg, plannedToday])

  const groups = []
  for (const e of dayEntries) { const l = mealLabel(e.at); const g = groups.find(x => x.l === l); g ? g.items.push(e) : groups.push({ l, items: [e] }) }
  const dayRange = () => { const [y, m, d] = day.split('-').map(Number); return { from: new Date(y, m - 1, d).getTime(), to: new Date(y, m - 1, d + 1).getTime() } }
  const toggleGlass = () => { const on = !glass; setGlass(on); applyGlass(on) }
  const label = isToday ? 'Today' : new Date(atOf(day, '12:00')).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })

  return <div className="narrow ng">
    <div className="hdr">
      <div><h1>Nutrition</h1><div className="sub">{label}</div></div>
      <div className="ng-row">
        <button className="iconbtn" onClick={() => setDay(addDays(day, -1))} aria-label="Previous day"><Icon name="chevronLeft" /></button>
        <button className="iconbtn" disabled={isToday} onClick={() => setDay(addDays(day, 1))} aria-label="Next day"><Icon name="chevronRight" /></button>
        <button className="iconbtn" onClick={() => nav('/home')} aria-label="Home"><Icon name="house" /></button>
      </div>
    </div>
    <div className="ng-seg">{[['today', 'Today'], ['micros', 'Nutrients'], ['goals', 'Goals']].map(([k, l]) =>
      <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}</div>

    {tab === 'today' && <>
      <div className="card ng-sum">
        <div className="ng-ringwrap"><Ring value={tot[0]} goal={goals.kcal} /><div className="ng-ringtxt"><b>{r0(Math.max(0, goals.kcal - tot[0]))}</b><small>kcal left</small></div></div>
        <div className="ng-bars">
          <Bar label="Protein" v={tot[IDX.p]} goal={goals.p} cls="p" />
          <Bar label="Carbs" v={tot[IDX.c]} goal={goals.c} cls="c" />
          <Bar label="Fat" v={tot[IDX.f]} goal={goals.f} cls="f" />
        </div>
      </div>

      {tips.length > 0 && <div className="ng-tips">{tips.map(t => <div key={t.id} className={'card ng-tip ' + t.level}><b>{t.title}</b><p>{t.text}</p></div>)}</div>}

      <div className="card ng-water">
        <div className="ng-bar-top"><span>Water</span><b>{(dayWater / 1000).toFixed(2)} / {(goals.water / 1000).toFixed(1)} L</b></div>
        <div className="ng-track"><i className="w" style={{ width: Math.min(100, dayWater / goals.water * 100) + '%' }} /></div>
        <div className="ng-row"><button className="ng-chip" onClick={() => addWater(250, isToday ? Date.now() : atOf(day, '12:00'))}>+250 ml</button><button className="ng-chip" onClick={() => addWater(500, isToday ? Date.now() : atOf(day, '12:00'))}>+500 ml</button><button className="ng-chip ghost" onClick={() => undoWater(dayRange())}>Undo</button></div>
      </div>

      {groups.map(g => <div className="card" key={g.l}>
        <div className="ng-bar-top"><b>{g.l}</b><span>{r0(g.items.reduce((a, e) => a + e.v[0], 0))} kcal</span></div>
        {g.items.map(e => <div className="ng-entry" key={e.id}>
          <time>{hhmm(e.at)}</time>
          <div><span>{e.name}</span><small>{e.desc} · {r0(e.v[1])}P · {r0(e.v[2])}C · {r0(e.v[3])}F</small></div>
          <b>{r0(e.v[0])}</b>
          <button className="iconbtn" onClick={() => removeEntry(e.id)} aria-label={'Remove ' + e.name}><Icon name="trash" /></button>
        </div>)}
      </div>)}
      {!groups.length && <div className="card empty">Nothing logged for this day.</div>}
      <button className="ng-fab" onClick={() => setSheet(true)} aria-label="Add food"><Icon name="plus" /></button>
    </>}

    {tab === 'micros' && Object.keys(ORDER).map(g => <div className="card" key={g}>
      <b>{GNAME[g]}</b>
      {ORDER[g].map(k => { const m = META[k], v = tot[IDX[k]] || 0
        return <div className="ng-nut" key={k}>
          <div className="ng-bar-top"><span>{m.l}{m.lim ? ' (limit)' : ''}</span><b>{fmt(v)} / {m.t} {m.u}</b></div>
          <div className="ng-track"><i className={m.lim && v > m.t ? 'over' : 'n'} style={{ width: Math.min(100, v / m.t * 100) + '%' }} /></div>
        </div> })}
    </div>)}
    {tab === 'micros' && <p className="ng-muted">Targets are general adult values. B12 and sodium count only what is in logged foods (no table salt).</p>}

    {tab === 'goals' && <div className="card ng-form">
      {[['kcal', 'Calories'], ['p', 'Protein (g)'], ['c', 'Carbs (g)'], ['f', 'Fat (g)'], ['water', 'Water (ml)']].map(([k, l]) =>
        <label key={k}>{l}<input className="ng-in" inputMode="numeric" defaultValue={goals[k]} onBlur={e => { const n = parseFloat(e.target.value); if (n > 0) setGoals({ [k]: n }) }} /></label>)}
      <label className="ng-toggle"><input type="checkbox" checked={glass} onChange={toggleGlass} /> Liquid glass theme for the whole app</label>
      <p className="ng-muted">Nutrition data is stored only on this device and is not part of openGym sync or backups.</p>
    </div>}

    {sheet && <AddSheet day={day} onClose={() => setSheet(false)} />}
  </div>
}
