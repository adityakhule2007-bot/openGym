// Nutrition engine: pure functions, no React, no storage. Vectors are arrays aligned with KEYS.
// Food data: IFCT 2017 (India), OpenNutrition and Open Food Facts contributors (ODbL), see public/nutrition/NOTICE.md.

export const KEYS = ['k', 'p', 'c', 'f', 'fib', 'sug', 'sat', 'chol', 'o3', 'o6', 'va', 'b1', 'b2', 'b3', 'b5', 'b6', 'b7', 'b9', 'b12', 'c_', 'd', 'e', 'kk', 'ca', 'fe', 'mg', 'ph', 'kp', 'na', 'zn', 'cu', 'mn', 'se']
export const IDX = Object.fromEntries(KEYS.map((k, i) => [k, i]))
export const N = KEYS.length

// l label, u unit, g group, t daily target, lim = an upper limit rather than a goal.
export const META = {
  fib: { l: 'Fiber', u: 'g', g: 'oth', t: 38 },
  sug: { l: 'Free sugars', u: 'g', g: 'oth', t: 50, lim: 1 },
  sat: { l: 'Saturated fat', u: 'g', g: 'oth', t: 25, lim: 1 },
  chol: { l: 'Cholesterol', u: 'mg', g: 'oth', t: 300, lim: 1 },
  o3: { l: 'Omega-3', u: 'g', g: 'oth', t: 1.6 },
  o6: { l: 'Omega-6', u: 'g', g: 'oth', t: 17 },
  va: { l: 'Vitamin A', u: 'µg', g: 'vit', t: 900 },
  b1: { l: 'Thiamine (B1)', u: 'mg', g: 'vit', t: 1.2 },
  b2: { l: 'Riboflavin (B2)', u: 'mg', g: 'vit', t: 1.3 },
  b3: { l: 'Niacin (B3)', u: 'mg', g: 'vit', t: 16 },
  b5: { l: 'Pantothenic acid (B5)', u: 'mg', g: 'vit', t: 5 },
  b6: { l: 'Vitamin B6', u: 'mg', g: 'vit', t: 1.3 },
  b7: { l: 'Biotin (B7)', u: 'µg', g: 'vit', t: 30 },
  b9: { l: 'Folate (B9)', u: 'µg', g: 'vit', t: 400 },
  b12: { l: 'Vitamin B12', u: 'µg', g: 'vit', t: 2.4 },
  c_: { l: 'Vitamin C', u: 'mg', g: 'vit', t: 90 },
  d: { l: 'Vitamin D', u: 'µg', g: 'vit', t: 15 },
  e: { l: 'Vitamin E', u: 'mg', g: 'vit', t: 15 },
  kk: { l: 'Vitamin K', u: 'µg', g: 'vit', t: 120 },
  ca: { l: 'Calcium', u: 'mg', g: 'min', t: 1000 },
  fe: { l: 'Iron', u: 'mg', g: 'min', t: 8 },
  mg: { l: 'Magnesium', u: 'mg', g: 'min', t: 420 },
  ph: { l: 'Phosphorus', u: 'mg', g: 'min', t: 700 },
  kp: { l: 'Potassium', u: 'mg', g: 'min', t: 3400 },
  na: { l: 'Sodium', u: 'mg', g: 'min', t: 2000, lim: 1 },
  zn: { l: 'Zinc', u: 'mg', g: 'min', t: 11 },
  cu: { l: 'Copper', u: 'mg', g: 'min', t: 0.9 },
  mn: { l: 'Manganese', u: 'mg', g: 'min', t: 2.3 },
  se: { l: 'Selenium', u: 'µg', g: 'min', t: 55 },
}
export const ORDER = {
  vit: ['va', 'b1', 'b2', 'b3', 'b5', 'b6', 'b7', 'b9', 'b12', 'c_', 'd', 'e', 'kk'],
  min: ['ca', 'fe', 'mg', 'ph', 'kp', 'na', 'zn', 'cu', 'mn', 'se'],
  oth: ['fib', 'sug', 'sat', 'chol', 'o3', 'o6'],
}
export const GNAME = { vit: 'Vitamins', min: 'Minerals', oth: 'Fiber, fats and sugars' }

export const DEFAULT_GOALS = { kcal: 2400, p: 150, c: 280, f: 70, water: 3000 }

export const zeros = () => new Array(N).fill(0)
export const addVec = (a, b) => { for (let i = 0; i < N; i++) a[i] += b[i] || 0; return a }
export const scaleVec = (v, x) => v.map(n => (n || 0) * x)

const pad = n => (n < 10 ? '0' : '') + n
export const dayKey = ms => { const d = new Date(ms); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) }
export const hhmm = ms => { const d = new Date(ms); return pad(d.getHours()) + ':' + pad(d.getMinutes()) }
export const atOf = (iso, time) => { const [y, m, d] = iso.split('-').map(Number); const [h, mi] = (time || '12:00').split(':').map(Number); return new Date(y, m - 1, d, h, mi).getTime() }

// A built-in food is per 100 g (u 'g', b 100) or per serving (u 's', b 1). Library rows are per 100 g.
export function entryFromFood(food, qty, at, id) {
  const per = food.u === 'g' ? (food.b || 100) : (food.b || 1)
  const x = qty / per
  return { id, at, name: food.n, desc: describeQty(food, qty), v: scaleVec(food.v, x) }
}
export function describeQty(food, qty) {
  if (food.u === 'g') return Math.round(qty) + ' g'
  return (Math.round(qty * 100) / 100) + ' × ' + (food.s || 'serving')
}
export function entryFromMacros(name, kcal, p, c, f, at, id) {
  const v = zeros(); v[0] = kcal; v[1] = p; v[2] = c; v[3] = f
  return { id, at, name, desc: 'quick add', v }
}

export function dayTotals(entries) {
  const t = zeros()
  for (const e of entries) addVec(t, e.v)
  return t
}

// Meal label from the time of day, so the time stays the source of truth.
export function mealLabel(ms) {
  const h = new Date(ms).getHours()
  return h < 5 ? 'Late night' : h < 11 ? 'Breakfast' : h < 15 ? 'Lunch' : h < 18 ? 'Snack' : h < 22 ? 'Dinner' : 'Late night'
}

// Training load of one saved openGym workout: { kg volume, work sets, minutes, end ms }.
export function sessionLoad(w, unit = 'kg') {
  let sets = 0
  for (const e of w?.entries || []) for (const s of e.sets || []) if (s?.done && s.phase !== 'warmup' && s.warmup !== true) sets++
  const lb = unit === 'lb'
  const vol = (typeof w?._vol === 'number' ? w._vol : Number(w?.vol) || 0) * (lb ? 0.4536 : 1)
  const min = Number.isFinite(w?.end) && Number.isFinite(w?.start) && w.end > w.start ? Math.min(240, (w.end - w.start) / 60000) : 45
  return { vol, sets, min, end: Number.isFinite(w?.end) ? w.end : null }
}

// Carbs to eat after a session: more for longer or heavier work. g per kg body weight.
export function postWorkoutFuel(load, kgBody = 75) {
  const strain = Math.min(1.5, Math.max(0.5, (load.sets * 1) / 18 + load.min / 120))
  return {
    carbs: Math.round(kgBody * (0.6 + 0.6 * strain) / 5) * 5,
    protein: Math.max(25, Math.round(kgBody * 0.4 / 5) * 5),
    sodiumMg: load.min > 60 ? 500 : 300,
  }
}

const sum = (arr, i) => arr.reduce((a, e) => a + (e.v[i] || 0), 0)

// Coach messages. Inputs: today's entries, water ml today, goals, `now` ms, saved workouts, unit, body kg,
// and `plannedToday` (does the plan have a session today that is not done yet).
export function coachTips({ entries, waterMl = 0, goals = DEFAULT_GOALS, now = Date.now(), workouts = [], unit = 'kg', bodyKg = 75, plannedToday = false }) {
  const tips = []
  const hour = new Date(now).getHours() + new Date(now).getMinutes() / 60
  const today = dayKey(now)
  const carbs = sum(entries, IDX.c), protein = sum(entries, IDX.p), kcal = sum(entries, IDX.k)
  const lastCarbAt = entries.filter(e => (e.v[IDX.c] || 0) >= 15).reduce((m, e) => Math.max(m, e.at), 0)

  const todays = workouts.filter(w => w.d === today)
  const loads = todays.map(w => sessionLoad(w, unit))
  const done = loads.filter(l => l.end).sort((a, b) => b.end - a.end)[0]

  if (done) {
    const fuel = postWorkoutFuel(done, bodyKg)
    const after = entries.filter(e => e.at >= done.end - 15 * 60000)
    const gotC = sum(after, IDX.c), gotP = sum(after, IDX.p)
    const mins = Math.round((now - done.end) / 60000)
    if (gotC < fuel.carbs * 0.7 || gotP < fuel.protein * 0.7) {
      tips.push({ id: 'post', level: mins < 180 ? 'now' : 'info', title: 'Post-workout fuel',
        text: `Training finished ${mins < 60 ? mins + ' min' : Math.round(mins / 60) + ' h'} ago. Aim for about ${Math.max(0, Math.round(fuel.carbs - gotC))} g carbs and ${Math.max(0, Math.round(fuel.protein - gotP))} g protein in the next meal${done.min > 60 ? ', with some salt or an electrolyte drink' : ''}.` })
    }
  } else if (plannedToday) {
    const gap = lastCarbAt ? (now - lastCarbAt) / 3600000 : Infinity
    if (gap > 3) tips.push({ id: 'pre', level: 'now', title: 'Fuel before training',
      text: `A session is planned and your last real carb meal was ${lastCarbAt ? Math.round(gap) + ' h ago' : 'not logged today'}. Have 40–60 g carbs (rice, banana, oats, roti) 1–2 h before you lift.` })
  }

  if (hour >= 11 && carbs < goals.c * 0.15) {
    tips.push({ id: 'carbs', level: 'now', title: carbs < 5 ? "You haven't eaten any carbs yet" : 'Carbs are low so far',
      text: `${Math.round(carbs)} g of ${goals.c} g. Add about ${Math.round(Math.min(80, goals.c * 0.25))} g from rice, roti, oats, potato or fruit, especially if you train today.` })
  } else if (hour >= 18 && carbs < goals.c * 0.6) {
    tips.push({ id: 'carbs2', level: 'info', title: 'Carbs are behind',
      text: `${Math.round(goals.c - carbs)} g carbs left for today. A carb-heavy dinner helps recovery and sleep.` })
  }

  const wake = 7, sleepAt = 23
  const frac = Math.min(1, Math.max(0, (hour - wake) / (sleepAt - wake)))
  if (frac > 0.35 && protein < goals.p * frac * 0.7) {
    tips.push({ id: 'protein', level: 'info', title: 'Protein is behind pace',
      text: `${Math.round(protein)} g so far, about ${Math.round(goals.p * frac)} g would be on pace. Next meal: 30–40 g (eggs, chicken, paneer, curd, whey).` })
  }

  const water = waterMl
  if (frac > 0.3 && water < goals.water * frac * 0.7) {
    tips.push({ id: 'water', level: 'info', title: 'Drink more water',
      text: `${(water / 1000).toFixed(1)} L of ${(goals.water / 1000).toFixed(1)} L. Add a glass or two now.` })
  }

  const na = sum(entries, IDX.na), kp = sum(entries, IDX.kp), mg = sum(entries, IDX.mg)
  const trainedHard = loads.some(l => l.min > 60 || l.sets > 20)
  if (trainedHard && na < 1200 && hour >= 12) {
    tips.push({ id: 'na', level: 'info', title: 'Electrolytes after a long session',
      text: 'Food sodium is low so far today. Salt your meal or use ORS / nimbu pani with a pinch of salt and some sugar.' })
  }
  if (hour >= 17 && kp < 1800) {
    tips.push({ id: 'k', level: 'info', title: 'Potassium is low',
      text: `${Math.round(kp)} mg of ${META.kp.t}. Banana, coconut water, potato, dal, curd or spinach will close the gap.` })
  }
  if (hour >= 18 && mg < 200) {
    tips.push({ id: 'mg', level: 'info', title: 'Magnesium is low',
      text: 'Nuts, seeds, ragi, leafy greens or a magnesium supplement (check the dose with a clinician) help cramps and sleep.' })
  }

  // Yesterday was a big day: carbs up a little.
  const y = new Date(now); y.setDate(y.getDate() - 1)
  const yl = workouts.filter(w => w.d === dayKey(y.getTime())).map(w => sessionLoad(w, unit))
  if (yl.length && hour < 11 && yl.reduce((a, l) => a + l.sets, 0) > 22)
    tips.push({ id: 'yday', level: 'info', title: 'Big session yesterday', text: 'Add roughly 10% more carbs today to refill glycogen.' })

  if (!entries.length && hour >= 9) tips.push({ id: 'log', level: 'info', title: 'Nothing logged yet', text: 'Log your first meal so the tips can work.' })
  if (kcal > goals.kcal * 1.1) tips.push({ id: 'over', level: 'info', title: 'Over your calorie goal', text: 'No stress: keep the next meal lighter, or account for it tomorrow.' })
  return tips
}

// Search: word match over name + aliases; built-ins rank above library rows.
export function scoreFood(hay, words) {
  let s = 0
  for (const w of words) {
    const i = hay.indexOf(w)
    if (i < 0) return 0
    s += i === 0 ? 6 : hay.charAt(i - 1) === ' ' ? 4 : 1
  }
  return s
}
export function searchFoods(core, more, query, limit = 40) {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (!words.length) return []
  const out = []
  for (const f of core) { const s = scoreFood(f.hay || (f.hay = (f.n + ' ' + (f.alt || '')).toLowerCase()), words); if (s) out.push({ s: s + 3 - f.n.length / 100, f }) }
  if (more) for (const f of more) { const s = scoreFood(f.hay, words); if (s) out.push({ s: s - f.n.length / 100, f }) }
  out.sort((a, b) => b.s - a.s)
  return out.slice(0, limit).map(o => o.f)
}
// Turns a library row [name,typeIdx,[label,g,unit]|null,ean,known,values] into the food shape above.
export function foodFromRow(r, i) {
  const sv = r[2]
  return { id: 'x' + i, n: r[0], u: 'g', b: 100, s: sv ? sv[0] : '', sg: sv ? sv[1] : 0, ean: r[3], v: r[5], hay: r[0].toLowerCase() }
}
