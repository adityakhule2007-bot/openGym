import { useMemo } from 'react'
import BodyMap from '../components/BodyMap.jsx'
import { fatigueOf } from '../lib/recovery.js'
import { fatigueStateOf, fatigueRecoveryMs, fmtRecoveryIn } from '../lib/recovery-view.js'
import { MUSCLE_NAME } from '../lib/muscles.js'
import { t } from '../lib/i18n.js'
import { fuelFromFatigue, FATIGUE_LEVELS } from '../lib/nutrition/fuel.js'

const STATE = { ready: 'Ready', recovering: 'Recovering', fatigued: 'Fatigued' }
const LEVEL = { high: 'High', moderate: 'Moderate', low: 'Low' }

// "Fuel": openGym's own muscle-fatigue model, turned into what to eat. Shows the fatigue map, a refeed
// recommendation (extra carbs on top of your goal) and the muscles that need the longest to recover.
export default function NutritionFuel({ S, bodyKg, carbsToday, carbGoal, onAdd }) {
  const now = useMemo(() => Date.now(), [S.workouts])
  const fatigue = useMemo(() => fatigueOf(S.workouts, now, { bodyweightKg: bodyKg, unit: S.unit }), [S.workouts, S.unit, bodyKg, now])
  const plan = useMemo(() => fuelFromFatigue(fatigue, bodyKg), [fatigue, bodyKg])
  const target = carbGoal + plan.carbsAdd
  const left = Math.max(0, Math.round(target - carbsToday))
  const none = !S.workouts.length

  return <>
    <div className="card ng-anatomy">
      <div className="ng-cardhd"><b>Muscle fatigue</b><small>from your openGym training</small></div>
      <BodyMap className="hm-fatigue" load={fatigue} thresholds={FATIGUE_LEVELS} body={S.body} />
      <div className="ng-fstate"><small>Fatigue state</small><b>{none ? 'No training yet' : LEVEL[plan.level]}{!none && plan.level !== 'low' ? ` (${plan.region})` : ''}</b></div>
      <div className="ng-flegend"><span><i className="f4" />Fatigued</span><span><i className="f2" />Recovering</span><span><i className="f0" />Ready</span></div>
    </div>

    <div className={'card ng-refeed ' + (plan.carbsAdd ? 'on' : '')}>
      <div className="ng-cardhd"><b>{plan.carbsAdd ? 'Refeed recommendation' : 'Fuel status'}</b></div>
      {none && <p>Log a workout in openGym and this will tell you how much extra to eat.</p>}
      {!none && plan.carbsAdd > 0 && <>
        <div className="ng-refeed-big"><b>+{plan.carbsAdd} g</b><small>carbs today</small></div>
        <p>{plan.top.slice(0, 3).map(r => t(MUSCLE_NAME[r.slug])).join(', ')} {plan.top.length > 1 ? 'are' : 'is'} {plan.level === 'high' ? 'highly' : 'moderately'} fatigued. Add the extra carbs to your post-workout meal (rice, sweet potato, oats, banana) to refill glycogen.</p>
        <div className="ng-refeed-row"><span>Carbs today</span><b>{Math.round(carbsToday)} / {target} g</b></div>
        <div className="ng-track"><i className="c" style={{ width: Math.min(100, carbsToday / Math.max(1, target) * 100) + '%' }} /></div>
        <button className="ng-btn" onClick={onAdd}>{left > 0 ? `Add food (${left} g to go)` : 'Add food'}</button>
      </>}
      {!none && plan.carbsAdd === 0 && <p>Your muscles are recovered. Stick to your normal macros{plan.top.length ? '' : ' and train hard.'}</p>}
    </div>

    {plan.top.length > 0 && <div className="card">
      <div className="ng-cardhd"><b>Needs the most recovery</b></div>
      {plan.top.map(r => {
        const st = fatigueStateOf(r.value), rec = fatigueRecoveryMs(r.value, r.slug), when = fmtRecoveryIn(rec.toReadyMs)
        return <div className="ng-frow" key={r.slug}>
          <div><span>{t(MUSCLE_NAME[r.slug])}</span><small>{STATE[st]}{when ? ` · ready ${when}` : ''}</small></div>
          <div className="ng-fbar"><i className={st} style={{ width: Math.round(r.value * 100) + '%' }} /></div>
          <b>{Math.round(r.value * 100)}%</b>
        </div>
      })}
    </div>}
  </>
}
