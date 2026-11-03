import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { effectiveRoutines } from '../lib/history.js'
import { weighInAt } from '../lib/bodyweight.js'
import { todayISO } from '../lib/format.js'
import Icon from '../components/Icon.jsx'
import { useNutrition } from '../lib/nutrition/store.js'
import { applyGlass, glassOn, applyTint, getTint, TINTS, applyAmoled, amoledOn, applyHaptics, hapticsOn } from '../lib/nutrition/glass.js'
import { META, ORDER, GNAME, IDX, dayKey, hhmm, atOf, dayTotals, mealLabel, coachTips } from '../lib/nutrition/engine.js'
import NutritionRings from './NutritionRings.jsx'
import FoodSheet from './NutritionFoodSheet.jsx'
import NutritionFuel from './NutritionFuel.jsx'
import NutritionCharts from './NutritionCharts.jsx'
import NutritionBackup from './NutritionBackup.jsx'
import NeuroFuel from './NeuroFuel.jsx'
import './nutrition.css'

const r0 = n => Math.round(n)
const fmt = x => (x >= 10 ? String(Math.round(x)) : x >= 1 ? String(Math.round(x * 10) / 10) : String(Math.round(x * 100) / 100))
const addDays = (iso, n) => { const [y, m, d] = iso.split('-').map(Number); return dayKey(new Date(y, m - 1, d + n).getTime()) }

export default function Nutrition() {
  const nav = useNavigate()
  const S = useStore(s => s.S)
  const { entries, water, goals, removeEntry, addWater, undoWater, setGoals } = useNutrition()
  const dayType = useNutrition(s => s.dayType)
  const setDayType = useNutrition(s => s.setDayType)
  const templates = useNutrition(s => s.templates)
  const addTemplate = useNutrition(s => s.addTemplate)
  const removeTemplate = useNutrition(s => s.removeTemplate)
  const addEntry = useNutrition(s => s.addEntry)
  const meet = useNutrition(s => s.meet)
  const setMeet = useNutrition(s => s.setMeet)
  const mealPhotos = useNutrition(s => s.mealPhotos)
  const addMealPhoto = useNutrition(s => s.addMealPhoto)
  const removeMealPhoto = useNutrition(s => s.removeMealPhoto)
  const photoInput = useRef(null)
  const [templateName, setTemplateName] = useState('')
  const [photoNote, setPhotoNote] = useState('')
  const [tab, setTab] = useState('today')
  const [day, setDay] = useState(todayISO())
  const [sheet, setSheet] = useState(false)
  const [glass, setGlass] = useState(glassOn())
  const [tint, setTint] = useState(getTint())
  const [amoled, setAmoled] = useState(amoledOn())
  const [haptics, setHaptics] = useState(hapticsOn())
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
  const saveCurrentTemplate = () => {
    if (!dayEntries.length) return
    const name = templateName.trim() || (dayType === 'training' ? 'Training day meals' : 'Rest day meals')
    addTemplate({ name, type: dayType, items: dayEntries.map(e => ({ name: e.name, desc: e.desc, v: e.v.slice(), meal: mealLabel(e.at) })) })
    setTemplateName('')
  }
  const applyTemplate = template => {
    const now = atOf(day, '12:00')
    template.items.forEach((e, i) => {
      const mealTime = ({ 'Breakfast': '08:00', 'Lunch': '13:00', 'Snack': '16:30', 'Dinner': '19:30', 'Late night': '23:00' })[e.meal] || '12:00'
      addEntry({ at: atOf(day, mealTime) + i * 1000, name: e.name, desc: e.desc, v: e.v.slice() })
    })
  }
  const attachPhoto = async file => {
    if (!file || !file.type.startsWith('image/')) return
    try {
      let data
      if (window.createImageBitmap) {
        const bmp = await createImageBitmap(file)
        const scale = Math.min(1, 960 / Math.max(bmp.width, bmp.height))
        const canvas = document.createElement('canvas')
        canvas.width = Math.max(1, Math.round(bmp.width * scale)); canvas.height = Math.max(1, Math.round(bmp.height * scale))
        canvas.getContext('2d').drawImage(bmp, 0, 0, canvas.width, canvas.height)
        data = canvas.toDataURL('image/jpeg', .66)
        bmp.close?.()
      } else {
        data = await new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(r.result); r.onerror = reject; r.readAsDataURL(file) })
      }
      if (data.length > 280000) { setPhotoNote('Image is too large after compression. Choose a smaller photo.'); return }
      addMealPhoto({ day, note: photoNote.trim(), data })
      setPhotoNote('')
    } catch { setPhotoNote('Could not attach this image. Try another photo.') }
  }
  const recentWeighIns = (S.bodyweight || []).filter(b => weighInAt(b) >= Date.now() - 7 * 86400000)
  const weighAvg = recentWeighIns.length ? recentWeighIns.reduce((a, b) => a + Number(b.w || 0), 0) / recentWeighIns.length : null
  const latestWeighIn = S.bodyweight?.length ? S.bodyweight[S.bodyweight.length - 1] : null
  const daysToMeet = meet.date ? Math.ceil((new Date(meet.date + 'T00:00:00').getTime() - new Date(todayISO() + 'T00:00:00').getTime()) / 86400000) : null
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

    <div className="ng-seg nf-tabs">{[['today', 'Diary'], ['neuro', 'NeuroFuel'], ['fuel', 'Fuel'], ['trends', 'Trends'], ['micros', 'Nutrients'], ['meet', 'Meet']].map(([k, l]) =>
      <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}</div>

    {tab === 'today' && <>
      <div className="ng-daytype">
        <span>Nutrition profile</span>
        <div className="ng-seg compact">
          <button className={dayType === 'training' ? 'on' : ''} onClick={() => setDayType('training')}>Training</button>
          <button className={dayType === 'rest' ? 'on' : ''} onClick={() => setDayType('rest')}>Rest</button>
        </div>
      </div>
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

      <div className="card ng-tools">
        <div className="ng-mealhd"><b>Quick actions</b><span>Less tapping, faster logging</span></div>
        <input className="ng-in ng-photo-note" placeholder="Template name (optional)" value={templateName} onChange={e => setTemplateName(e.target.value)} />
        <div className="ng-toolrow">
          <button className="ng-chip" onClick={() => setSheet(true)}>＋ Quick log</button>
          <button className="ng-chip ghost" onClick={saveCurrentTemplate} disabled={!dayEntries.length}>Save day as template</button>
          <button className="ng-chip ghost" onClick={() => photoInput.current?.click()}>＋ Meal photo</button>
        </div>
        <input ref={photoInput} type="file" accept="image/*" capture="environment" hidden onChange={e => { attachPhoto(e.target.files?.[0]); e.target.value = '' }} />
        <input className="ng-in ng-photo-note" placeholder="Photo note (optional)" value={photoNote} onChange={e => setPhotoNote(e.target.value)} />
        {templates.length > 0 && <div className="ng-template-list">
          <div className="ng-sec">Saved meal templates</div>
          {templates.slice(0, 5).map(t => <div className="ng-template" key={t.id}>
            <div><b>{t.name}</b><small>{t.items.length} foods · {t.type === 'rest' ? 'Rest day' : 'Training day'}</small></div>
            <button className="ng-chip" onClick={() => applyTemplate(t)}>Add</button>
            <button className="iconbtn" onClick={() => removeTemplate(t.id)} aria-label="Delete template"><Icon name="xmark" /></button>
          </div>)}
        </div>}
      </div>
      {mealPhotos.filter(p => p.day === day).length > 0 && <div className="card ng-photo-grid">
        <div className="ng-mealhd"><b>Meal photos</b><span>{mealPhotos.filter(p => p.day === day).length}</span></div>
        <div className="ng-photos">{mealPhotos.filter(p => p.day === day).map(p => <div key={p.id}>
          <img src={p.data} alt={p.note || 'Meal photo'} loading="lazy" />
          <small>{p.note || 'Meal photo'}</small>
          <button className="ng-link danger" onClick={() => removeMealPhoto(p.id)}>Remove</button>
        </div>)}</div>
      </div>}

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

    {tab === 'neuro' && <NeuroFuel S={S} entries={entries} goals={goals} bodyKg={bodyKg} plannedToday={plannedToday} />}
    {tab === 'fuel' && <NutritionFuel S={S} bodyKg={bodyKg} carbsToday={tot[IDX.c]} carbGoal={goals.c} onAdd={() => setSheet(true)} />}
    {tab === 'trends' && <NutritionCharts entries={entries} water={water} endDay={todayISO()} goals={goals} bodyweight={S.bodyweight || []} unit={unit} />}

    {tab === 'micros' && <>{Object.keys(ORDER).map(g => <div className="card" key={g}>
      <div className="ng-sec first">{GNAME[g]}</div>
      {ORDER[g].map(k => { const m = META[k], v = tot[IDX[k]] || 0
        return <div className="ng-nut" key={k}>
          <div className="ng-bar-top"><span>{m.l}{m.lim ? ' (limit)' : ''}</span><b>{fmt(v)} <i>/ {m.t} {m.u}</i></b></div>
          <div className="ng-track"><i className={m.lim && v > m.t ? 'over' : 'n'} style={{ width: Math.min(100, v / m.t * 100) + '%' }} /></div>
        </div> })}
    </div>)}
      <p className="ng-muted">Targets are general adult values. Packaged foods list only some nutrients, and sodium counts only what is in logged foods (not table salt).</p></>}

    {tab === 'meet' && <div className="ng-meet">
      <div className="card ng-meet-hero">
        <div className="ng-sec first">Competition mode</div>
        <h2>{meet.enabled ? 'Meet week workspace' : 'Prepare for competition'}</h2>
        <p className="ng-muted">A focused view for weigh-ins, meal consistency and competition logistics. It does not prescribe dehydration or rapid weight cuts.</p>
        <label className="ng-toggle"><input type="checkbox" checked={!!meet.enabled} onChange={e => setMeet({ enabled: e.target.checked })} /> Enable meet mode</label>
        <label className="ng-f"><span>Competition date</span><input className="ng-in" type="date" value={meet.date || ''} onChange={e => setMeet({ date: e.target.value })} /></label>
        <label className="ng-f"><span>Weight class (optional)</span><input className="ng-in" placeholder="e.g. 59 kg" value={meet.weightClass || ''} onChange={e => setMeet({ weightClass: e.target.value })} /></label>
        {daysToMeet !== null && <div className="ng-countdown"><b>{daysToMeet < 0 ? 'Meet completed' : daysToMeet === 0 ? 'Competition day' : daysToMeet}</b><span>{daysToMeet > 0 ? 'days remaining' : daysToMeet < 0 ? 'days ago' : 'Today'}</span></div>}
      </div>
      <div className="card">
        <div className="ng-mealhd"><b>Meet-week checklist</b><span>Tick off as needed</span></div>
        {latestWeighIn && <div className="ng-weight-snapshot">
          <div><small>Latest weigh-in</small><b>{Number(latestWeighIn.w).toFixed(1)} {unit}</b></div>
          <div><small>7-day average</small><b>{weighAvg === null ? '—' : weighAvg.toFixed(1) + ' ' + unit}</b></div>
          <div><small>Entries</small><b>{recentWeighIns.length}/7</b></div>
        </div>}
        {['Confirm weigh-in and lifting schedule','Keep familiar foods and meals available','Prepare food, fluids and competition kit','Record morning bodyweight consistently','Avoid untested supplements or last-minute food changes'].map((x, i) => <label className="ng-check" key={x}><input type="checkbox" checked={!!meet.checklist?.[i]} onChange={e => setMeet({ checklist: { ...(meet.checklist || {}), [i]: e.target.checked } })} />{x}</label>)}
      </div>
    </div>}

    {tab === 'goals' && <>
      <div className="card ng-form">
        {[['kcal', 'Calories'], ['p', 'Protein (g)'], ['c', 'Carbs (g)'], ['f', 'Fat (g)'], ['water', 'Water (ml)']].map(([k, l]) =>
          <label className="ng-f" key={k}><span>{l}</span><input className="ng-in" inputMode="numeric" defaultValue={goals[k]} onBlur={e => { const n = parseFloat(e.target.value); if (n > 0) setGoals({ [k]: n }) }} /></label>)}
      </div>
      <div className="card ng-form">
        <label className="ng-toggle"><input type="checkbox" checked={glass} onChange={toggleGlass} /> Liquid glass theme for the whole app</label>
        <label className="ng-toggle"><input type="checkbox" checked={amoled} onChange={e => { setAmoled(e.target.checked); applyAmoled(e.target.checked) }} /> True-black AMOLED surfaces</label>
        <label className="ng-toggle"><input type="checkbox" checked={haptics} onChange={e => { setHaptics(e.target.checked); applyHaptics(e.target.checked) }} /> Subtle haptic feedback</label>
        <p className="ng-muted">AMOLED mode uses deeper blacks while keeping glass effects and your chosen tint. Disable it for softer dark surfaces.</p>
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
