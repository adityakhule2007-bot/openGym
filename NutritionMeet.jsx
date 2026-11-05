import { useState } from 'react'
import Icon from '../components/Icon.jsx'
import { useNutrition } from '../lib/nutrition/store.js'
import { LEVELS, BASIS, daysUntil, addDaysIso, validIso } from '../lib/nutrition/meet.js'
import { todayISO } from '../lib/format.js'
import { MiniSheet } from './NutritionMeals.jsx'
import { tap } from '../lib/nutrition/haptics.js'

const r0 = n => Math.round(n)

// The card at the top of the Diary in the last two weeks before the meet.
export function MeetCard({ plan, using, onOpen }) {
  const t = plan.targets
  return <div className="card ng-meet">
    <div className="ng-cardhd"><b>{plan.headline}</b><small>{plan.label}</small></div>
    {plan.days >= 0 && <div className="ng-meetnum">
      <span><small>Calories</small><b>{r0(t.kcal)}</b></span><span><small>Carbs</small><b>{r0(t.c)} g</b></span>
      <span><small>Protein</small><b>{r0(t.p)} g</b></span><span><small>Fat</small><b>{r0(t.f)} g</b></span>
    </div>}
    {t.changed && <p className="ng-muted ng-meetnote">{using ? 'The rings use these meet-week targets today.' : 'Meet-week targets are off, the rings use your usual goals.'}{t.fibreMax ? ` Keep fibre under ${t.fibreMax} g.` : ''}</p>}
    <p className="ng-meettip">{plan.tips[0]}</p>
    <button className="ng-link" onClick={() => { tap(); onOpen() }}>Full plan</button>
  </div>
}

// The whole plan for the day: every tip, the meet-day schedule, and where the numbers come from.
export function MeetSheet({ plan, onClose }) {
  const [why, setWhy] = useState(false)
  return <MiniSheet title={plan.headline} onClose={onClose}>
    <div className="ng-form">
      <div className="ng-sec first">{plan.label}</div>
      <ul className="ng-ul">{plan.tips.map((x, i) => <li key={i}>{x}</li>)}</ul>
      {plan.schedule.length > 0 && <>
        <div className="ng-sec">Meet-day schedule</div>
        {plan.schedule.map((s, i) => <div className="ng-sched" key={i}><time>{s.at}</time><div><b>{s.title}</b><p>{s.text}</p></div></div>)}
      </>}
      <button className="ng-acc" onClick={() => setWhy(!why)}><span>Where this comes from</span><Icon name={why ? 'chevronUp' : 'chevronDown'} /></button>
      {why && <div>
        <p className="ng-muted">No weight cut, no water loading and no salt cutting. The carb top-up is optional and capped at 7 g/kg. Fibre is lowered in the last two days for gut comfort; that part rests on practice more than on trials. General sports nutrition guidance, not medical advice; if you have a medical condition or take medication, check with your doctor.</p>
        <ul className="ng-ul small">{BASIS.map((b, i) => <li key={i}>{b}</li>)}</ul>
      </div>}
    </div>
  </MiniSheet>
}

// Goals tab: set or change the meet date, first lift time and top-up level.
export function MeetSettings() {
  const meet = useNutrition(s => s.meet)
  const setMeet = useNutrition(s => s.setMeet)
  const [days, setDays] = useState('')
  const today = todayISO()
  const left = meet ? daysUntil(meet.date, today) : null
  const patch = p => setMeet({ ...meet, ...p })
  return <div className="card ng-form">
    <div className="ng-cardhd"><b>Meet week</b><small>{meet ? (left > 0 ? `${left} day${left === 1 ? '' : 's'} to go` : left === 0 ? 'Meet day' : 'Meet is over') : 'Not set'}</small></div>
    {!meet && <>
      <p className="ng-muted">Date not announced yet? Enter your best guess. You can change it any time and the plan moves with it.</p>
      <div className="ng-grid2">
        <label className="ng-f"><span>Meet is in (days)</span><input className="ng-in" inputMode="numeric" value={days} onChange={e => setDays(e.target.value.replace(/\D/g, '').slice(0, 3))} /></label>
        <label className="ng-f"><span>or pick the date</span><input className="ng-in" type="date" min={today} onChange={e => validIso(e.target.value) && setMeet({ date: e.target.value, first: '09:00', level: 'gentle', use: true })} /></label>
      </div>
      <button className="ng-btn" disabled={!(parseInt(days, 10) >= 0)} onClick={() => setMeet({ date: addDaysIso(today, parseInt(days, 10)), first: '09:00', level: 'gentle', use: true })}>Start meet-week plan</button>
    </>}
    {meet && <>
      <div className="ng-grid2">
        <label className="ng-f"><span>Meet date</span><input className="ng-in" type="date" value={meet.date} onChange={e => validIso(e.target.value) && patch({ date: e.target.value })} /></label>
        <label className="ng-f"><span>First lift (time)</span><input className="ng-in" type="time" value={meet.first} onChange={e => e.target.value && patch({ first: e.target.value })} /></label>
      </div>
      <div className="ng-sec">Carb top-up (last 3 days)</div>
      <div className="ng-seg">{LEVELS.map(l => <button key={l.id} className={meet.level === l.id ? 'on' : ''} onClick={() => { tap(); patch({ level: l.id }) }}>{l.label}</button>)}</div>
      <p className="ng-muted">{LEVELS.find(l => l.id === meet.level)?.hint} Never a weight cut, water loading or salt cutting.</p>
      <label className="ng-toggle"><input type="checkbox" checked={meet.use} onChange={e => patch({ use: e.target.checked })} /> Use meet-week targets in the rings</label>
      <button className="ng-link danger" onClick={() => setMeet(null)}>Clear meet date</button>
    </>}
  </div>
}
