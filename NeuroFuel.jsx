import { useMemo, useState } from 'react'
import { useNutrition } from '../lib/nutrition/store.js'
import { analyseNeuroFuel, caffeineRemainingMg } from '../lib/nutrition/neurofuel.js'
import { dayKey, hhmm } from '../lib/nutrition/engine.js'
import './neurofuel.css'

const num = n => Math.round(Number(n)||0)
export default function NeuroFuel({ S, entries, goals, bodyKg, plannedToday }) {
  const caffeine = useNutrition(s=>s.caffeine)
  const config = useNutrition(s=>s.neuroFuel)
  const setConfig = useNutrition(s=>s.setNeuroFuel)
  const addCaffeine = useNutrition(s=>s.addCaffeine)
  const removeCaffeine = useNutrition(s=>s.removeCaffeine)
  const [dose,setDose] = useState('80')
  const [source,setSource] = useState('Coffee')
  const [sleep,setSleep] = useState(config.sleepHours || '')
  const [quality,setQuality] = useState(config.sleepQuality || 'unknown')
  const [showSettings,setShowSettings] = useState(false)
  const analysis = useMemo(()=>analyseNeuroFuel({ entries, caffeine, workouts:S?.workouts||[], bodyKg, goals, config, S, plannedToday }),[entries,caffeine,S,bodyKg,goals,config,plannedToday])
  const todaysCaffeine = caffeine.filter(x=>dayKey(x.at)===dayKey(Date.now())).sort((a,b)=>b.at-a.at)
  const nextSession = new Date(analysis.sessionAt)
  const caffeineAtBed = caffeineRemainingMg(caffeine, (()=>{const [h,m]=String(config.bedtime||'23:00').split(':').map(Number);const d=new Date();d.setHours(h,m,0,0);return d.getTime()})(), config.caffeineHalfLife)
  const addDose = () => { const mg=Number(dose); if (mg>0 && mg<=1000) { addCaffeine({mg,source}); setDose('80') } }
  const saveSleep = () => setConfig({sleepHours:sleep===''?'':String(Math.max(0,Math.min(24,Number(sleep)))),sleepQuality:quality,sleepLoggedAt:Date.now()})
  return <div className="nf-wrap">
    <section className="nf-hero card">
      <div className="nf-topline"><span className="nf-mark">NF</span><span className="nf-kicker">OFFLINE TRAINING COPILOT</span><span className="nf-local">● On device</span></div>
      <h2>NeuroFuel</h2><p>Food, training and caffeine timing — interpreted locally from your own logs.</p>
      <div className="nf-stats"><div><small>Data coverage</small><b>{analysis.dataQuality}</b></div><div><small>Training days</small><b>{analysis.trainingDays} / 7d</b></div><div><small>Food log days</small><b>{analysis.loggedDays} / 7</b></div></div>
    </section>

    <section className="card nf-session">
      <div className="nf-heading"><div><small>TRAINING CONTEXT</small><h3>Session planner</h3></div><span className="nf-pill">{S?.active?'Workout active':analysis.todayLoads?'Session logged':'Local schedule'}</span></div>
      <div className="nf-sessionrow"><label>Planned start<input type="time" value={config.sessionTime||'16:30'} onChange={e=>setConfig({sessionTime:e.target.value})}/></label><div><small>Today’s session anchor</small><b>{nextSession.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</b></div></div>
      {analysis.todayLoads && <p className="nf-note">Saved workout: {analysis.todayLoads.sets} work sets · {num(analysis.todayLoads.min)} min · {num(analysis.todayLoads.vol)} kg logged volume.</p>}
      <div className="nf-targets"><div><small>Calories remaining</small><b>{num(analysis.kcalLeft)} kcal</b></div><div><small>Protein remaining</small><b>{num(analysis.pLeft)} g</b></div><div><small>Carbs remaining</small><b>{num(analysis.cLeft)} g</b></div></div>
      <p className="nf-note">Targets are read from Nutrition. NeuroFuel never changes them automatically.</p>
    </section>

    <section className="card nf-trends">
      <div className="nf-heading"><div><small>FOOD + TRAINING PATTERNS</small><h3>Training-day vs rest-day intake</h3></div><span className="nf-pill">Last 7 days</span></div>
      <div className="nf-compare">
        <div><b>Training days</b><span>{analysis.trainingDayAvg.kcal===null?'Not enough logs':`${num(analysis.trainingDayAvg.kcal)} kcal`}</span><small>{analysis.trainingDayAvg.protein===null?'—':`${num(analysis.trainingDayAvg.protein)} g protein · ${num(analysis.trainingDayAvg.carbs)} g carbs`}</small></div>
        <div><b>Rest / unlogged days</b><span>{analysis.restDayAvg.kcal===null?'Not enough logs':`${num(analysis.restDayAvg.kcal)} kcal`}</span><small>{analysis.restDayAvg.protein===null?'—':`${num(analysis.restDayAvg.protein)} g protein · ${num(analysis.restDayAvg.carbs)} g carbs`}</small></div>
      </div>
      <p className="nf-note">Only days with food entries are included. A day without a saved workout is treated as a rest/unlogged-training day, so confirm your schedule and log meals consistently before drawing conclusions.</p>
    </section>

    <section className="nf-recs"><div className="nf-section-title"><div><small>YOUR DAILY BRIEF</small><h3>Copilot recommendations</h3></div><span>{analysis.recs.length} insights</span></div>
      {analysis.recs.map(r=><article className={'nf-rec '+r.level} key={r.id}><div className="nf-rec-title"><i/ ><b>{r.title}</b></div><p>{r.text}</p><small>{r.reason}</small></article>)}
    </section>

    <section className="card nf-caffeine">
      <div className="nf-heading"><div><small>STIMULANT TRACKER</small><h3>Caffeine planner</h3></div><span className="nf-pill">Logged {num(analysis.caffeineTotal)} mg today</span></div>
      <div className="nf-cafstats"><div><small>Estimated active now</small><b>{num(analysis.caffeineEstimate)} mg</b></div><div><small>Estimated at bedtime</small><b>{num(caffeineAtBed)} mg</b></div></div>
      <p className="nf-note">Estimates use a simple half-life model ({config.caffeineHalfLife||5} h). Actual clearance varies; this is not a blood-caffeine measurement.</p>
      <div className="nf-dose"><label>Source<select value={source} onChange={e=>setSource(e.target.value)}>{['Coffee','Tea','Pre-workout','Energy drink','Cola','Caffeine tablet','Other'].map(x=><option key={x}>{x}</option>)}</select></label><label>Dose (mg)<input inputMode="decimal" type="number" min="1" max="1000" value={dose} onChange={e=>setDose(e.target.value)}/></label><button onClick={addDose}>Log dose</button></div>
      <div className="nf-cafhint">{analysis.nextCaffeine.text}</div>
      {todaysCaffeine.length>0 && <div className="nf-log">{todaysCaffeine.map(x=><div key={x.id}><span>{x.source} · {hhmm(x.at)}</span><b>{num(x.mg)} mg</b><button onClick={()=>removeCaffeine(x.id)} aria-label="Remove caffeine entry">×</button></div>)}</div>}
    </section>

    <section className="card nf-recovery">
      <div className="nf-heading"><div><small>RECOVERY FEEDBACK</small><h3>Sleep check-in</h3></div></div>
      <div className="nf-dose"><label>Last night's sleep (hours)<input type="number" min="0" max="24" step="0.5" value={sleep} onChange={e=>setSleep(e.target.value)} placeholder="e.g. 7.5"/></label><label>Sleep quality<select value={quality} onChange={e=>setQuality(e.target.value)}><option value="unknown">Not rated</option><option value="poor">Poor</option><option value="average">Average</option><option value="good">Good</option></select></label></div>
      <button className="nf-save" onClick={saveSleep}>Save sleep check-in</button>
      <p className="nf-note">Manual entry only. NeuroFuel does not read health sensors or infer sleep quality.</p>
    </section>

    <section className="card nf-settings">
      <button className="nf-settings-toggle" onClick={()=>setShowSettings(x=>!x)}><span><small>PERSONAL CONTROLS</small><b>Copilot settings</b></span><b>{showSettings?'−':'＋'}</b></button>
      {showSettings && <div className="nf-settings-grid">
        <label>Usual bedtime<input type="time" value={config.bedtime||'23:00'} onChange={e=>setConfig({bedtime:e.target.value})}/></label>
        <label>Caffeine cutoff before bed (hours)<input type="number" min="4" max="12" value={config.caffeineCutoffHours??8} onChange={e=>setConfig({caffeineCutoffHours:Math.max(4,Math.min(12,Number(e.target.value)||8))})}/></label>
        <label>Estimated caffeine half-life (hours)<input type="number" min="3" max="10" step="0.5" value={config.caffeineHalfLife??5} onChange={e=>setConfig({caffeineHalfLife:Math.max(3,Math.min(10,Number(e.target.value)||5))})}/></label>
        <label>Personal daily caffeine cap (mg)<input type="number" min="0" max="1000" value={config.caffeineLimit??400} onChange={e=>setConfig({caffeineLimit:Math.max(0,Math.min(1000,Number(e.target.value)||0))})}/></label>
      </div>}
      <p className="nf-note">All NeuroFuel settings and logs are stored locally on this device and included in the Nutrition backup. The caffeine cap is your own setting, not a recommended target.</p>
    </section>
    <p className="nf-disclaimer">NeuroFuel provides general planning support, not medical advice. Log every caffeine source for a useful estimate. Never use caffeine to compensate for inadequate sleep, and avoid treating incomplete food logs as a precise measure of intake.</p>
  </div>
}
