import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { effectiveRoutines } from '../lib/history.js'
import { todayISO } from '../lib/format.js'
import Icon from '../components/Icon.jsx'
import { useNutrition, uid } from '../lib/nutrition/store.js'
import { applyGlass, glassOn, applyTint, getTint, TINTS, amoledOn, applyAmoled } from '../lib/nutrition/glass.js'
import { META, ORDER, GNAME, IDX, dayKey, hhmm, atOf, dayTotals, mealLabel, coachTips } from '../lib/nutrition/engine.js'
import { daysUntil, meetPlan } from '../lib/nutrition/meet.js'
import { copyEntries, missingMeals, makeTemplate, suggestTemplate, entriesFromTemplate } from '../lib/nutrition/templates.js'
import { orphanShots, dropPhoto } from '../lib/nutrition/photos.js'
import { cacheStats, clearCache } from '../lib/nutrition/cache.js'
import { tap, ok, done, hapticsOn, setHaptics } from '../lib/nutrition/haptics.js'
import { useNewIds, motionOn, applyMotion } from '../lib/nutrition/motion.js'
import NutritionRings from './NutritionRings.jsx'
import FoodSheet from './NutritionFoodSheet.jsx'
import NutritionFuel from './NutritionFuel.jsx'
import NutritionCharts from './NutritionCharts.jsx'
import NutritionBackup from './NutritionBackup.jsx'
import { MeetCard, MeetSheet, MeetSettings } from './NutritionMeet.jsx'
import { SaveMealSheet, CopySheet } from './NutritionMeals.jsx'
import { PhotoStrip, AddPhoto, Lightbox } from './NutritionPhotos.jsx'
import './nutrition.css'

const r0 = n => Math.round(n)
const fmt = x => (x >= 10 ? String(Math.round(x)) : x >= 1 ? String(Math.round(x * 10) / 10) : String(Math.round(x * 100) / 100))
const addDays = (iso, n) => { const [y, m, d] = iso.split('-').map(Number); return dayKey(new Date(y, m - 1, d + n).getTime()) }
const THEMES = [['system', 'System'], ['light', 'Light'], ['dark', 'Dark']]

// Protein, carbs and fat as a share of a meal's calories (4, 4 and 9 kcal per gram).
const split = t => { const k = [t[IDX.p] * 4, t[IDX.c] * 4, t[IDX.f] * 9], s = k[0] + k[1] + k[2]; return s > 0 ? k.map(x => x / s * 100) : [0, 0, 0] }

export default function Nutrition() {
  const nav = useNavigate()
  const S = useStore(s => s.S)
  const update = useStore(s => s.update)
  const { entries, water, goals, templates, shots, meet, removeEntry, addEntries, touchTemplate, addWater, undoWater, setGoals, saveTemplate, addShot, removeShot, setShots } = useNutrition()
  const [tab, setTab] = useState('today')
  const [day, setDay] = useState(todayISO())
  const [sheet, setSheet] = useState(null)          // null | { tab }
  const [glass, setGlass] = useState(glassOn())
  const [tint, setTint] = useState(getTint())
  const [amoled, setAmoled] = useState(amoledOn())
  const [haptics, setHap] = useState(hapticsOn())
  const [motion, setMotion] = useState(motionOn())
  const [allTips, setAllTips] = useState(false)
  const [copy, setCopy] = useState(null)             // { items }
  const [save, setSave] = useState(null)             // { items, title, name, tag }
  const [light, setLight] = useState(null)           // a photo record
  const [meetOpen, setMeetOpen] = useState(false)
  const [cstats, setCstats] = useState(null)
  const isToday = day === todayISO()

  const dayEntries = useMemo(() => entries.filter(e => dayKey(e.at) === day).sort((a, b) => a.at - b.at), [entries, day])
  const dayWater = useMemo(() => water.filter(w => dayKey(w.at) === day).reduce((a, w) => a + w.ml, 0), [water, day])
  const tot = useMemo(() => dayTotals(dayEntries), [dayEntries])
  const unit = S.unit === 'lb' ? 'lb' : 'kg'
  const bw = S.bodyweight?.length ? Number(S.bodyweight[S.bodyweight.length - 1].w) : 0
  const bodyKg = bw > 0 ? (unit === 'lb' ? bw * 0.4536 : bw) : 75
  const hasPlan = effectiveRoutines(S, day).some(r => r.ex.length)
  const plannedToday = isToday && !S.workouts.some(w => w.d === day) && hasPlan
  const trainingDay = S.workouts.some(w => w.d === day) || hasPlan

  // Meet-week mode: the plan for the viewed day, and the targets the rings use when the person has it switched on.
  const daysTo = meet ? daysUntil(meet.date, day) : null
  const plan = useMemo(() => (meet && daysTo >= -1 && daysTo <= 14 ? meetPlan({ days: daysTo, bodyKg, goals, level: meet.level, firstLift: meet.first }) : null), [meet, daysTo, bodyKg, goals])
  const using = !!(plan && meet.use && plan.days >= 0 && plan.targets.changed)
  const eg = useMemo(() => (using ? { ...goals, kcal: plan.targets.kcal, p: plan.targets.p, c: plan.targets.c, f: plan.targets.f } : goals), [using, plan, goals])

  const tips = useMemo(() => isToday ? coachTips({ entries: dayEntries, waterMl: dayWater, goals: eg, workouts: S.workouts, unit, bodyKg, plannedToday }) : [],
    [isToday, dayEntries, dayWater, eg, S.workouts, unit, bodyKg, plannedToday])
  const shownTips = allTips ? tips : tips.slice(0, 2)

  // Quick log: yesterday's meals that are not logged yet today, and a saved meal for this kind of day.
  const yesterday = addDays(day, -1)
  const missing = useMemo(() => missingMeals(entries.filter(e => dayKey(e.at) === yesterday), dayEntries), [entries, yesterday, dayEntries])
  const suggested = dayEntries.length ? null : suggestTemplate(templates, trainingDay)

  const groups = []
  for (const e of dayEntries) { const l = mealLabel(e.at); const g = groups.find(x => x.l === l); g ? g.items.push(e) : groups.push({ l, items: [e] }) }
  const dayShots = shots.filter(s => dayKey(s.at) === day)
  const fresh = useNewIds(dayEntries.map(e => e.id))
  const dayRange = () => { const [y, m, d] = day.split('-').map(Number); return { from: new Date(y, m - 1, d).getTime(), to: new Date(y, m - 1, d + 1).getTime() } }
  const toggleGlass = () => { const on = !glass; setGlass(on); applyGlass(on); tap() }
  const label = isToday ? 'Today' : new Date(atOf(day, '12:00')).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
  const waterAt = () => (isToday ? Date.now() : atOf(day, '12:00'))

  // A ring closing gets a buzz, once, only when it happens while this day is open (not on opening the screen or changing day).
  const closed = useRef(null)
  useEffect(() => {
    const now = { p: tot[IDX.p] >= eg.p, c: tot[IDX.c] >= eg.c, f: tot[IDX.f] >= eg.f }
    if (closed.current && closed.current.day === day && ['p', 'c', 'f'].some(k => now[k] && !closed.current[k])) done()
    closed.current = { day, ...now }
  }, [tot, day, eg])

  // Photos whose meal was deleted are dropped from the phone.
  useEffect(() => {
    const dead = orphanShots(shots, entries)
    if (dead.length) { dead.forEach(s => dropPhoto(s.id)); setShots(shots.filter(s => !dead.includes(s))) }
  }, [entries, shots, setShots])

  useEffect(() => { if (tab === 'goals') cacheStats().then(setCstats) }, [tab])

  const pickDay = d => { setDay(d); tap() }
  const doSame = () => { addEntries(copyEntries(missing, day, uid)); ok() }
  const doCopy = toDay => { addEntries(copyEntries(copy.items, toDay, uid)); ok(); setCopy(null); if (toDay !== day) pickDay(toDay) }
  const doSave = (name, tag) => { saveTemplate(makeTemplate({ id: 't' + uid(), name, tag, entries: save.items })); setSave(null) }
  const removePhoto = s => { dropPhoto(s.id); removeShot(s.id); setLight(null); tap() }

  return <div className="narrow ng">
    <div className="hdr">
      <div><h1>Nutrition</h1><div className="sub">{new Date(atOf(day, '12:00')).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}</div></div>
      <div className="ng-row">
        <button className={'iconbtn' + (tab === 'goals' ? ' on' : '')} onClick={() => { tap(); setTab(tab === 'goals' ? 'today' : 'goals') }} aria-label="Goals and theme"><Icon name="gear" /></button>
        <button className="iconbtn" onClick={() => nav('/home')} aria-label="Home"><Icon name="house" /></button>
      </div>
    </div>

    <div className="ng-seg">{[['today', 'Diary'], ['fuel', 'Fuel'], ['trends', 'Trends'], ['micros', 'Nutrients']].map(([k, l]) =>
      <button key={k} className={tab === k ? 'on' : ''} onClick={() => { tap(); setTab(k) }}>{l}</button>)}</div>

    {tab === 'today' && <>
      <div className="ng-daynav">
        <button className="iconbtn" onClick={() => pickDay(addDays(day, -1))} aria-label="Previous day"><Icon name="chevronLeft" /></button>
        <span>{label}</span>
        <button className="iconbtn" disabled={isToday} onClick={() => pickDay(addDays(day, 1))} aria-label="Next day"><Icon name="chevronRight" /></button>
      </div>

      <div className="card ng-hero">
        <NutritionRings kcal={tot[0]} kcalGoal={eg.kcal}
          macros={[{ key: 'p', value: tot[IDX.p], goal: eg.p }, { key: 'c', value: tot[IDX.c], goal: eg.c }, { key: 'f', value: tot[IDX.f], goal: eg.f }]} />
        <div className="ng-heroft"><span>{r0(tot[0])} eaten</span><span>{r0(eg.kcal)} {using ? 'meet-week ' : ''}goal</span></div>
      </div>

      {plan && <MeetCard plan={plan} using={using} onOpen={() => setMeetOpen(true)} />}

      {tips.length > 0 && <div className="ng-tips">
        {shownTips.map(t => <div key={t.id} className={'ng-tip ' + t.level}><i /><div><b>{t.title}</b><p>{t.text}</p></div></div>)}
        {tips.length > 2 && <button className="ng-link" onClick={() => setAllTips(!allTips)}>{allTips ? 'Show fewer tips' : `${tips.length - 2} more tips`}</button>}
      </div>}

      {suggested && <div className="card ng-suggest">
        <div><small>{trainingDay ? 'Training day' : 'Rest day'} meal</small><b>{suggested.name}</b></div>
        <button className="ng-chip" onClick={() => { addEntries(entriesFromTemplate(suggested, day, uid)); touchTemplate(suggested.id); ok() }}>Add</button>
      </div>}

      <div className="ng-quick">
        {missing.length > 0 && <button className="ng-chip" onClick={doSame}>↻ Same as yesterday · {missing.length}</button>}
        <button className="ng-chip" onClick={() => { tap(); setSheet({ tab: 'meals' }) }}>Saved meals</button>
        {dayEntries.length > 0 && <button className="ng-chip ghost" onClick={() => { tap(); setSave({ items: dayEntries, title: 'Save this day', name: trainingDay ? 'Training day' : 'Rest day', tag: trainingDay ? 'training' : 'rest' }) }}>Save day</button>}
      </div>

      <div className="card ng-water">
        <div className="ng-wtop"><div><small>Water</small><b>{(dayWater / 1000).toFixed(2)}<i> / {(goals.water / 1000).toFixed(1)} L</i></b></div>
          <div className="ng-row"><button className="ng-chip" onClick={() => { tap(); addWater(250, waterAt()) }}>+250</button><button className="ng-chip" onClick={() => { tap(); addWater(500, waterAt()) }}>+500</button><button className="ng-chip ghost" onClick={() => { tap(); undoWater(dayRange()) }} aria-label="Undo last water">↶</button></div></div>
        <div className="ng-track"><i className="w" style={{ width: Math.min(100, dayWater / goals.water * 100) + '%' }} /></div>
      </div>

      {groups.map((g, gi) => {
        const t = dayTotals(g.items), sh = split(t), gs = dayShots.filter(s => mealLabel(s.at) === g.l)
        return <div className="card ng-meal" key={g.l} style={{ '--i': gi }}>
          <div className="ng-mealhd"><b>{g.l}</b><span>{r0(t[0])} kcal</span></div>
          <div className="ng-mmac" aria-label={`${g.l} macros`}>
            <span className="mp"><i />Protein <b>{r0(t[IDX.p])} g</b></span><span className="mc"><i />Carbs <b>{r0(t[IDX.c])} g</b></span><span className="mf"><i />Fat <b>{r0(t[IDX.f])} g</b></span>
          </div>
          <div className="ng-mbar" aria-hidden="true"><i className="p" style={{ width: sh[0] + '%' }} /><i className="c" style={{ width: sh[1] + '%' }} /><i className="f" style={{ width: sh[2] + '%' }} /></div>
          <PhotoStrip shots={gs} onOpen={setLight} />
          {g.items.map(e => <div className={'ng-entry' + (fresh.has(e.id) ? ' new' : '')} key={e.id}>
            <time>{hhmm(e.at)}</time>
            <div><span>{e.name}</span><small>{e.desc} · {r0(e.v[1])}P {r0(e.v[2])}C {r0(e.v[3])}F</small></div>
            <b>{r0(e.v[0])}</b>
            <button className="iconbtn" onClick={() => { tap(); removeEntry(e.id) }} aria-label={'Remove ' + e.name}><Icon name="xmark" /></button>
          </div>)}
          <div className="ng-acts">
            <AddPhoto at={g.items[0].at} onAdded={addShot} />
            <button className="ng-act" onClick={() => { tap(); setCopy({ items: g.items }) }}><Icon name="copy" /><span>Copy</span></button>
            <button className="ng-act" onClick={() => { tap(); setSave({ items: g.items, title: 'Save meal', name: g.l, tag: 'any' }) }}><Icon name="star" /><span>Save meal</span></button>
          </div>
        </div>
      })}
      {!groups.length && <div className="card ng-empty">Nothing logged for this day yet.<small>Tap + to add a meal{templates.length ? ', or use a saved meal above' : ''}.</small></div>}
      <button className="ng-fab" onClick={() => { tap(); setSheet({ tab: 'search' }) }} aria-label="Add food"><Icon name="plus" /></button>
    </>}

    {tab === 'fuel' && <NutritionFuel S={S} bodyKg={bodyKg} carbsToday={tot[IDX.c]} carbGoal={eg.c} onAdd={() => setSheet({ tab: 'search' })} />}
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

      <MeetSettings />

      <div className="card ng-form">
        <div className="ng-sec first">Appearance</div>
        <div className="ng-seg" role="radiogroup" aria-label="Theme">{THEMES.map(([k, l]) =>
          <button key={k} role="radio" aria-checked={(S.theme || 'dark') === k} className={(S.theme || 'dark') === k ? 'on' : ''} onClick={() => { tap(); update(s => { s.theme = k }) }}>{l}</button>)}</div>
        <label className="ng-toggle"><input type="checkbox" checked={amoled} onChange={e => { setAmoled(e.target.checked); applyAmoled(e.target.checked); tap() }} /> AMOLED black (dark theme)</label>
        <label className="ng-toggle"><input type="checkbox" checked={glass} onChange={toggleGlass} /> Liquid glass theme for the whole app</label>
        <div className="ng-tints" role="radiogroup" aria-label="Glass tint">{TINTS.map(t => <button key={t.id} role="radio" aria-checked={tint === t.id} className={tint === t.id ? 'on' : ''}
          onClick={() => { setTint(t.id); applyTint(t.id); tap() }} aria-label={t.label}>
          <span style={{ background: `conic-gradient(from 200deg, ${t.sw[0]}, ${t.sw[1]}, ${t.sw[2]}, ${t.sw[0]})` }} /><small>{t.label}</small></button>)}</div>
        <p className="ng-muted">AMOLED black switches the background and cards to true black in the dark theme, so the screen pixels turn off. Glass tint sets the light behind the glass. Button and highlight colour follow the accent chosen in openGym Settings.</p>
        <label className="ng-toggle"><input type="checkbox" checked={haptics} onChange={e => { setHap(e.target.checked); setHaptics(e.target.checked); if (e.target.checked) tap() }} /> Haptic taps</label>
        <label className="ng-toggle"><input type="checkbox" checked={motion} onChange={e => { setMotion(e.target.checked); applyMotion(e.target.checked) }} /> Small animations</label>
        <p className="ng-muted">Haptics follow openGym Settings → Vibrate as well. Animations also stop when the phone’s “Remove animations” is on.</p>
      </div>

      <div className="card ng-form">
        <div className="ng-sec first">Offline food cache</div>
        <p className="ng-muted">{cstats ? `${cstats.searches} saved search${cstats.searches === 1 ? '' : 'es'} and ${cstats.products} scanned product${cstats.products === 1 ? '' : 's'} are kept on this phone, so they open without a connection.` : 'Saved Open Food Facts searches and scanned products are kept on this phone.'}</p>
        <button className="ng-btn ghost" onClick={async () => { await clearCache(); setCstats(await cacheStats()); tap() }}>Clear saved results</button>
      </div>

      <NutritionBackup />
      <p className="ng-muted">Your nutrition diary, saved meals, meet date and foods stay on this phone. They are not part of openGym sync or its own backup, so use Diet backup above to keep a copy (meal photos are not included). Searching Open Food Facts or looking up a barcode sends only that search or barcode to openfoodfacts.org, and only when you ask.</p>
      <p className="ng-muted">Food data: Indian Food Composition Tables 2017 (ICMR-NIN); <a href="https://www.opennutrition.app" target="_blank" rel="noopener noreferrer">OpenNutrition</a>; © <a href="https://world.openfoodfacts.org" target="_blank" rel="noopener noreferrer">Open Food Facts</a> contributors (ODbL).</p>
    </>}

    {sheet && <FoodSheet day={day} startTab={sheet.tab} onClose={() => setSheet(null)} />}
    {copy && <CopySheet day={day} count={copy.items.length} onPick={doCopy} onClose={() => setCopy(null)} />}
    {save && <SaveMealSheet title={save.title} defaultName={save.name} defaultTag={save.tag} onSave={doSave} onClose={() => setSave(null)} />}
    {light && <Lightbox shot={light} onClose={() => setLight(null)} onDelete={removePhoto} />}
    {meetOpen && plan && <MeetSheet plan={plan} onClose={() => setMeetOpen(false)} />}
  </div>
}
