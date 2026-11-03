// NeuroFuel: deterministic, offline-only coaching logic. No network, remote model or auto-target edits.
import { dayKey, dayTotals, IDX, sessionLoad, postWorkoutFuel } from './engine.js'

const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x))
const timeOn = (iso, hhmm) => { const [y,m,d] = iso.split('-').map(Number); const [h,mi] = (hhmm || '16:30').split(':').map(Number); return new Date(y,m-1,d,h,mi).getTime() }
const fmt = n => Math.round(n)
const hours = ms => ms / 3600000
const lastDays = (n, now=Date.now()) => { const start = new Date(now); start.setHours(0,0,0,0); start.setDate(start.getDate()-(n-1)); return start.getTime() }

export function caffeineRemainingMg(items, at=Date.now(), halfLifeHours=5) {
  const half = clamp(Number(halfLifeHours) || 5, 3, 10)
  return (items || []).reduce((sum, x) => {
    const age = (at - x.at) / 3600000
    return age >= 0 ? sum + Number(x.mg || 0) * Math.pow(0.5, age / half) : sum
  }, 0)
}

export function analyseNeuroFuel({ entries=[], caffeine=[], workouts=[], bodyKg=70, goals={}, config={}, S={}, plannedToday: plannedFlag=false, now=Date.now() }) {
  const today = dayKey(now), from7 = lastDays(7, now), from14 = lastDays(14, now)
  const todayEntries = entries.filter(e => dayKey(e.at) === today)
  const totals = dayTotals(todayEntries)
  const recentEntries = entries.filter(e => e.at >= from7 && e.at <= now)
  const recentDays = [...new Set(recentEntries.map(e => dayKey(e.at)))]
  const loggedDays = recentDays.length
  const avg = key => loggedDays ? recentEntries.reduce((a,e) => a + (e.v[key] || 0),0) / loggedDays : 0
  const proteinAvg = avg(IDX.p), kcalAvg = avg(IDX.k), carbAvg = avg(IDX.c)
  const recentWorkouts = (workouts || []).filter(w => w.d && new Date(w.d+'T00:00:00').getTime() >= from14).sort((a,b) => (b.end||b.start||0)-(a.end||a.start||0))
  const todayWorkout = (workouts || []).filter(w => w.d === today).sort((a,b)=>(b.end||b.start||0)-(a.end||a.start||0))[0]
  const plannedToday = !todayWorkout && (plannedFlag || !!(S && (S.active || S.queue || S.dayPlan?.[today])))
  const sessionAt = timeOn(today, config.sessionTime || '16:30')
  const caffeineToday = caffeine.filter(x => dayKey(x.at) === today)
  const caffeineTotal = caffeineToday.reduce((a,x)=>a+Number(x.mg||0),0)
  const caffeineEstimate = caffeineRemainingMg(caffeine, now, config.caffeineHalfLife || 5)
  const bedtimeAt = timeOn(today, config.bedtime || '23:00')
  const cutoffAt = bedtimeAt - clamp(Number(config.caffeineCutoffHours)||8, 4, 12)*3600000
  const sleepIsFresh = Number.isFinite(config.sleepLoggedAt) && now - config.sleepLoggedAt <= 36*3600000 && now >= config.sleepLoggedAt
  const sleepHours = sleepIsFresh ? Number(config.sleepHours) : NaN
  const recs = []
  const add = (id, level, title, text, reason) => recs.push({id,level,title,text,reason})

  if (todayWorkout) {
    const load = sessionLoad(todayWorkout, S?.unit === 'lb' ? 'lb' : 'kg')
    add('completed', 'good', 'Session logged', `${load.sets} work sets · about ${fmt(load.min)} min · ${fmt(load.vol)} kg logged volume`, 'Read from your saved openGym workout. Volume is the app’s logged tonnage, not a direct measure of physiological fatigue.')
    const recovery = postWorkoutFuel(load, bodyKg)
    add('post-workout', 'info', 'Post-training recovery guide', `The existing openGym session-load model estimates about ${recovery.protein} g protein and ${recovery.carbs} g carbohydrate as a post-session meal reference.`, 'This estimate uses completed work sets, session duration and bodyweight. Treat it as a meal-planning reference, not a mandatory target; your daily goals remain unchanged.')
  } else if (plannedToday || S?.active) {
    add('session', 'info', 'Training day detected', `Your workout data indicates a session today. The fuel plan is anchored to your selected ${config.sessionTime || '16:30'} session time.`, 'The workout record provides the training context; session time is a user-set planning input because routines do not consistently contain a clock time.')
  } else {
    add('rest', 'info', 'No completed session found today', 'If today is a training day, set the planned session time below. Otherwise, use the rest-day profile already configured in Nutrition.', 'Based on saved workouts and available schedule metadata.')
  }

  const proteinGoal = Number(goals.p) || 150, carbGoal = Number(goals.c) || 280, kcalGoal = Number(goals.kcal) || 2400
  const pLeft = Math.max(0, proteinGoal - totals[IDX.p]), cLeft = Math.max(0, carbGoal - totals[IDX.c]), kcalLeft = Math.max(0, kcalGoal - totals[IDX.k])
  if (loggedDays >= 3 && proteinAvg < proteinGoal * .85) add('protein-trend','warn','Protein consistency is below target',`Your logged 7-day average is about ${fmt(proteinAvg)} g/day against a ${fmt(proteinGoal)} g target.`, 'Average is calculated only across days with at least one food entry; missing days are not treated as zero.')
  else if (todayEntries.length && totals[IDX.p] < proteinGoal * .65) add('protein-today','info','Protein still needs attention',`You have logged ${fmt(totals[IDX.p])} g; approximately ${fmt(pLeft)} g remain to reach today's target.`, 'Calculated from today’s food diary and your saved protein goal.')
  if (loggedDays >= 3 && kcalAvg < kcalGoal * .8) add('energy-trend','warn','Your logged energy intake trends low',`The 7-day logged-day average is about ${fmt(kcalAvg)} kcal/day versus your ${fmt(kcalGoal)} kcal target.`, 'This is a diary trend, not proof of under-fuelling; incomplete food logging can lower the estimate.')
  if ((plannedToday || S?.active) && now >= sessionAt - 3*3600000 && now <= sessionAt - 3600000 && cLeft > 30) add('preworkout-carb','info','Plan carbohydrates around training',`You have about ${fmt(cLeft)} g of your daily carb target remaining. Consider a familiar, easy-to-digest carb-containing meal 1–3 hours before training, sized to appetite and tolerance.`, 'Timing suggestion only. It does not prescribe a fixed carb dose or change your daily target.')
  if (todayEntries.length && totals[IDX.k] < kcalGoal*.45 && new Date(now).getHours() >= 17) add('late-fuel','warn','Diary intake is low for this point in the day',`Only ${fmt(totals[IDX.k])} kcal are logged so far today. Check whether meals are missing before interpreting this as low intake.`, 'Compares current diary entries with the saved daily goal; not an energy-availability diagnosis.')

  if (caffeineTotal > (Number(config.caffeineLimit)||400)) add('caffeine-limit','warn','Logged caffeine is above your configured limit',`${fmt(caffeineTotal)} mg is logged today; your personal app limit is ${fmt(Number(config.caffeineLimit)||400)} mg. Avoid adding more until you review the total.`, 'Counts only caffeine entries you record. It may omit coffee, tea, cola, energy drinks or pre-workout that were not logged.')
  if (now >= cutoffAt && now < sessionAt) add('caffeine-cutoff','warn','Caffeine timing may conflict with sleep',`Your configured caffeine cutoff (${config.caffeineCutoffHours || 8} h before bedtime) has passed. NeuroFuel will not recommend a late dose to rescue this session.`, 'Cutoff is a conservative personal setting, not a universal pharmacological threshold.')
  if (caffeineEstimate > 50 && config.bedtime) add('caffeine-residual','info','Caffeine may still be active near bedtime',`The simple half-life estimate is about ${fmt(caffeineRemainingMg(caffeine, timeOn(today, config.bedtime), config.caffeineHalfLife || 5))} mg remaining by ${config.bedtime}.`, 'Modelled estimate from logged doses and your selected half-life; real clearance varies substantially between people.')
  if (Number.isFinite(sleepHours) && sleepHours > 0 && sleepHours < 7) add('sleep','warn','Short sleep logged',`You recorded ${sleepHours.toFixed(1)} hours. Prioritise recovery rather than increasing caffeine to compensate.`, 'Uses your manual sleep entry; does not infer sleep from device data.')

  if (!recs.length) add('steady','good','No major flags from the available data','Keep logging meals and workouts consistently. NeuroFuel will become more useful as it has more complete history.','The engine avoids strong conclusions when the diary or schedule data is sparse.')
  const todayLoads = todayWorkout ? sessionLoad(todayWorkout, S?.unit === 'lb' ? 'lb' : 'kg') : null
  const trainingDateSet = new Set(recentWorkouts.filter(w=>new Date(w.d+'T00:00:00').getTime() >= from7).map(w=>w.d))
  const trainingDays = trainingDateSet.size
  const dayBuckets = new Map()
  for (const e of recentEntries) { const k=dayKey(e.at); const row=dayBuckets.get(k)||{k:0,p:0,c:0}; row.k+=e.v[IDX.k]||0; row.p+=e.v[IDX.p]||0; row.c+=e.v[IDX.c]||0; dayBuckets.set(k,row) }
  const trainingRows = [...dayBuckets.entries()].filter(([d])=>trainingDateSet.has(d)).map(([,v])=>v)
  const restRows = [...dayBuckets.entries()].filter(([d])=>!trainingDateSet.has(d)).map(([,v])=>v)
  const mean = (rows,key) => rows.length ? rows.reduce((a,x)=>a+x[key],0)/rows.length : null
  const trainingDayAvg = { kcal:mean(trainingRows,'k'), protein:mean(trainingRows,'p'), carbs:mean(trainingRows,'c') }
  const restDayAvg = { kcal:mean(restRows,'k'), protein:mean(restRows,'p'), carbs:mean(restRows,'c') }
  const dataQuality = loggedDays >= 5 && recentWorkouts.length >= 2 ? 'moderate' : loggedDays >= 2 || recentWorkouts.length ? 'limited' : 'very limited'
  const nextCaffeine = (() => {
    if (now >= cutoffAt) return { status:'cutoff', text:'No caffeine timing suggestion: your configured sleep cutoff has passed.' }
    if (caffeineTotal >= (Number(config.caffeineLimit)||400)) return { status:'limit', text:'Your recorded daily caffeine limit has been reached.' }
    return { status:'optional', text:'If you already tolerate caffeine, use your own familiar amount and log the dose. NeuroFuel does not calculate or prescribe a stimulant dose.' }
  })()
  return { today, totals, pLeft, cLeft, kcalLeft, proteinAvg, kcalAvg, carbAvg, loggedDays, recentWorkouts:recentWorkouts.length, trainingDays, trainingDayAvg, restDayAvg, dataQuality, recs, caffeineTotal, caffeineEstimate, nextCaffeine, sessionTime:config.sessionTime||'16:30', sessionAt, todayLoads }
}
