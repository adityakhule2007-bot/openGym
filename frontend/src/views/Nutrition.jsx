import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { effectiveRoutines } from '../lib/history.js'
import { todayISO } from '../lib/format.js'
import Icon from '../components/Icon.jsx'
import { useNutrition } from '../lib/nutrition/store.js'
import { applyGlass, glassOn, applyTint, getTint, TINTS } from '../lib/nutrition/glass.js'
import { META, ORDER, GNAME, IDX, dayKey, hhmm, atOf, dayTotals, mealLabel, coachTips } from '../lib/nutrition/engine.js'
import NutritionRings from './NutritionRings.jsx'
import FoodSheet from './NutritionFoodSheet.jsx'
import NutritionFuel from './NutritionFuel.jsx'
import NutritionCharts from './NutritionCharts.jsx'
import NutritionBackup from './NutritionBackup.jsx'
import './nutrition.css'

const r0 = n => Math.round(n)
const fmt = x => (x >= 10 ? String(Math.round(x)) : x >= 1 ? String(Math.round(x * 10) / 10) : String(Math.round(x * 100) / 100))
const addDays = (iso, n) => { const [y, m, d] = iso.split('-').map(Number); return dayKey(new Date(y, m - 1, d + n).getTime()) }

export default function Nutrition() {
  const nav = useNavigate()
  const S = useStore(s => s.S)
  const { entries, water, goals, removeEntry, addWater, undoWater, setGoals } = useNutrition()
  const [tab, setTab] = useState('today')
  const [day, setDay] = useState(todayISO())
  const [sheet, setSheet] = useState(false)
  const [glass, setGlass] = useState(glassOn())
  const [tint, setTint] = useState(getTint())
  const [allTips, setAllTips] = useState(false)
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
  const shownTips = allTips ? tips : tips.slice(0, 2)

  const groups = []
  for (const e of dayEntries) { const l = mealLabel(e.at); const g = groups.find(x => x.l === l); g ? g.items.push(e) : groups.push({ l, items: [e] }) }
  const dayRange = () => { const [y, m, d] = day.split('-').map(Number); return { from: new Date(y, m - 1, d).getTime(), to: new Date(y, m - 1, d + 1).getTime() } }
  const toggleGlass = () => { const on = !glass; setGlass(on); applyGlass(on) }
  const label = isToday ? 'Today' : new Date(atOf(day, '12:00')).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
  const waterAt = () => (isToday ? Date.now() : atOf(day, '12:00'))

  return <div className="narrow ng">
    <div className="hdr">
      <div><h1>Nutrition</h1><div className="sub">{new Date(atOf(day, '12:00')).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}</div></div>
      <div className="ng-row">
        <button className={'iconbtn' + (tab === 'goals' ? ' on' : '')} onClick={() => setTab(tab === 'goals' ? 'today' : 'goals')} aria-label="Goals and theme"><Icon name="gear" /></button>
        <button className="iconbtn" onClick={() => nav('/home')} aria-label="Home"><Icon name="house" /></button>
      </div>
    </div>

    <div className="ng-seg">{[['today', 'Diary'], ['fuel', 'Fuel'], ['trends', 'Trends'], ['micros', 'Nutrients']].map(([k, l]) =>
      <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}</div>

    {tab === 'today' && <>
      <div className="ng-daynav">
        <button className="iconbtn" onClick={() => setDay(addDays(day, -1))} aria-label="Previous day"><Icon name="chevronLeft" /></button>
        <span>{label}</span>
        <button className="iconbtn" disabled={isToday} onClick={() => setDay(addDays(day, 1))} aria-label="Next day"><Icon name="chevronRight" /></button>
      </div>

      <div className="card ng-hero">
        <NutritionRings kcal={tot[0]} kcalGoal={goals.kcal}
          macros={[{ key: 'p', value: tot[IDX.p], goal: goals.p }, { key: 'c', value: tot[IDX.c], goal: goals.c }, { key: 'f', value: tot[IDX.f], goal: goals.f }]} />
        <div className="ng-heroft"><span>{r0(tot[0])} eaten</span><span>{goals.kcal} goal</span></div>
      </div>

      {tips.length > 0 && <div className="ng-tips">
        {shownTips.map(t => <div key={t.id} className={'ng-tip ' + t.level}><i /><div><b>{t.title}</b><p>{t.text}</p></div></div>)}
        {tips.length > 2 && <button className="ng-link" onClick={() => setAllTips(!allTips)}>{allTips ? 'Show fewer tips' : `${tips.length - 2} more tips`}</button>}
      </div>}

      <div className="card ng-water">
        <div className="ng-wtop"><div><small>Water</small><b>{(dayWater / 1000).toFixed(2)}<i> / {(goals.water / 1000).toFixed(1)} L</i></b></div>
          <div className="ng-row"><button className="ng-chip" onClick={() => addWater(250, waterAt())}>+250</button><button className="ng-chip" onClick={() => addWater(500, waterAt())}>+500</button><button className="ng-chip ghost" onClick={() => undoWater(dayRange())} aria-label="Undo last water">↶</button></div></div>
        <div className="ng-track"><i className="w" style={{ width: Math.min(100, dayWater / goals.water * 100) + '%' }} /></div>
      </div>

      {groups.map(g => <div className="card ng-meal" key={g.l}>
        <div className="ng-mealhd"><b>{g.l}</b><span>{r0(g.items.reduce((a, e) => a + e.v[0], 0))} kcal</span></div>
        {g.items.map(e => <div className="ng-entry" key={e.id}>
          <time>{hhmm(e.at)}</time>
          <div><span>{e.name}</span><small>{e.desc} · {r0(e.v[1])}P {r0(e.v[2])}C {r0(e.v[3])}F</small></div>
          <b>{r0(e.v[0])}</b>
          <button className="iconbtn" onClick={() => removeEntry(e.id)} aria-label={'Remove ' + e.name}><Icon name="xmark" /></button>
        </div>)}
      </div>)}
      {!groups.length && <div className="card ng-empty">Nothing logged for this day yet.<small>Tap + to add a meal.</small></div>}
      <button className="ng-fab" onClick={() => setSheet(true)} aria-label="Add food"><Icon name="plus" /></button>
    </>}

    {tab === 'fuel' && <NutritionFuel S={S} bodyKg={bodyKg} carbsToday={tot[IDX.c]} carbGoal={goals.c} onAdd={() => setSheet(true)} />}
    {tab === 'trends' && <NutritionCharts entries={entries} water={water} endDay={todayISO()} goals={goals} />}

    {tab === 'micros' && <>{Object.keys(ORDER).map(g => <div className="card" key={g}>
      <div className="ng-sec first">{GNAME[g]}</div>
      {ORDER[g].map(k => { const m = META[k], v = tot[IDX[k]] || 0
        return <div className="ng-nut" key={k}>
          <div className="ng-bar-top"><span>{m.l}{m.lim ? ' (limit)' : ''}</span><b>{fmt(v)} <i>/ {m.t} {m.u}</i></b></div>
          <div className="ng-track"><i className={m.lim && v > m.t ? 'over' : 'n'} style={{ width: Math.min(100, v / m.t * 100) + '%' }} /></div>
        </div> })}
    </div>)}
      <p className="ng-muted">Targets are general adult values. Packaged foods list only some nutrients, and sodium counts only what is in logged foods (not table salt).</p></>}

    {tab === 'goals' && <>
      <div className="card ng-form">
        {[['kcal', 'Calories'], ['p', 'Protein (g)'], ['c', 'Carbs (g)'], ['f', 'Fat (g)'], ['water', 'Water (ml)']].map(([k, l]) =>
          <label className="ng-f" key={k}><span>{l}</span><input className="ng-in" inputMode="numeric" defaultValue={goals[k]} onBlur={e => { const n = parseFloat(e.target.value); if (n > 0) setGoals({ [k]: n }) }} /></label>)}
      </div>
      <div className="card ng-form">
        <label className="ng-toggle"><input type="checkbox" checked={glass} onChange={toggleGlass} /> Liquid glass theme for the whole app</label>
        <div className="ng-tints" role="radiogroup" aria-label="Glass tint">{TINTS.map(t => <button key={t.id} role="radio" aria-checked={tint === t.id} className={tint === t.id ? 'on' : ''}
          onClick={() => { setTint(t.id); applyTint(t.id) }} aria-label={t.label}>
          <span style={{ background: `conic-gradient(from 200deg, ${t.sw[0]}, ${t.sw[1]}, ${t.sw[2]}, ${t.sw[0]})` }} /><small>{t.label}</small></button>)}</div>
        <p className="ng-muted">Glass tint sets the light behind the glass. Button and highlight colour follow the accent chosen in openGym Settings.</p>
      </div>
      <NutritionBackup />
      <p className="ng-muted">Your nutrition diary and foods stay on this phone. They are not part of openGym sync or its own backup, so use Diet backup above to keep a copy. Searching Open Food Facts or scanning a barcode sends only that search or barcode to openfoodfacts.org, and only when you ask.</p>
      <p className="ng-muted">Food data: Indian Food Composition Tables 2017 (ICMR-NIN); <a href="https://www.opennutrition.app" target="_blank" rel="noopener noreferrer">OpenNutrition</a>; © <a href="https://world.openfoodfacts.org" target="_blank" rel="noopener noreferrer">Open Food Facts</a> contributors (ODbL).</p>
    </>}

    {sheet && <FoodSheet day={day} onClose={() => setSheet(false)} />}
  </div>
}
