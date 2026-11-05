// Meet-week nutrition: a conservative plan for the last days before a powerlifting meet. Pure functions.
//
// What it does and does not do (the person asked for no weight cut and nothing extreme):
//  - no weight cut, no water loading or restriction, no sodium manipulation: hydration and salt stay normal;
//  - an optional carbohydrate top-up in the last 3 days: Off, Gentle (+5% then +10% of the usual carbs) or
//    Standard (about 6 then 6.5 g per kg of body weight, never above 7 g/kg), taken from fat, not piled on top;
//  - protein held inside 1.6-2.2 g/kg, raised only when the person's own goal sits below 1.6 g/kg;
//  - lower fibre and no new foods in the last 2 days, a gut-comfort habit rather than a trial-proven effect;
//  - a meet-day schedule counted back from the first lift.
// This is general sports-nutrition guidance, not medical advice, and evidence specific to powerlifting meets is thin.

export const BASIS = [
  'Thomas, Erdman & Burke (2016), ACSM / Academy of Nutrition and Dietetics / Dietitians of Canada position stand on nutrition and athletic performance: 5-7 g/kg/day carbohydrate for regular training, 1-4 g/kg in the 1-4 h before an event, 1.2-2.0 g/kg/day protein, about 5-7 ml/kg of fluid at least 4 h before.',
  'Morton et al. (2018), Br J Sports Med, meta-analysis: muscle-gain benefit of protein levels off around 1.6 g/kg/day (upper range about 2.2).',
  'Schoenfeld & Aragon (2018), J Int Soc Sports Nutr: about 0.4 g/kg protein per meal, spread over the day.',
  'Guest et al. (2021), ISSN position stand on caffeine and exercise: 3-6 mg/kg, taken about 60 min before, only if it is tolerated and already used in training.',
]

const pad = n => (n < 10 ? '0' : '') + n
const r5 = x => Math.round(x / 5) * 5
const parse = iso => { const [y, m, d] = String(iso).split('-').map(Number); return Date.UTC(y, m - 1, d) }

export const validIso = s => { if (!/^\d{4}-\d{2}-\d{2}$/.test(String(s))) return false; const t = parse(s); return Number.isFinite(t) && addDaysIso(s, 0) === s }
export function addDaysIso(iso, n) {
  const d = new Date(parse(iso) + n * 86400000)
  return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate())
}
// Whole days from `todayIso` to the meet (0 = meet day, negative = after it). UTC maths, so daylight saving never shifts it.
export const daysUntil = (meetIso, todayIso) => Math.round((parse(meetIso) - parse(todayIso)) / 86400000)

// A saved meet setting from storage or a backup: { date, first, level, use } or null when the date is not a real date.
export const cleanMeet = m => (m && validIso(m.date)
  ? { date: m.date, first: /^\d{2}:\d{2}$/.test(m.first) ? m.first : '09:00', level: ['off', 'gentle', 'standard'].includes(m.level) ? m.level : 'gentle', use: m.use !== false }
  : null)

export const PHASES = { build: 'Normal training', practice: 'Practice run', topup: 'Top-up', eve: 'Day before', meet: 'Meet day', after: 'Recovery' }
export function phaseOf(days) {
  if (days < 0) return 'after'
  if (days === 0) return 'meet'
  if (days === 1) return 'eve'
  if (days <= 3) return 'topup'
  if (days <= 7) return 'practice'
  return 'build'
}

export const LEVELS = [
  { id: 'off', label: 'Off', hint: 'Keep my usual targets.' },
  { id: 'gentle', label: 'Gentle', hint: 'A few percent more carbs in the last 3 days.' },
  { id: 'standard', label: 'Standard', hint: 'About 6 to 6.5 g carbs per kg in the last 3 days.' },
]

// Carb target for a day. Never below the usual goal, never above 7 g/kg.
export function carbTarget({ days, kg, baseC, level = 'gentle' }) {
  if (level === 'off' || days < 0 || days > 3) return baseC
  const near = days <= 2
  const want = level === 'standard' ? (near ? 6.5 : 6) * kg : baseC * (near ? 1.1 : 1.05)
  return r5(Math.max(baseC, Math.min(7 * kg, want)))   // the 7 g/kg ceiling limits the top-up; it never cuts the person's own goal
}

// Targets for one day. goals: { kcal, p, c, f, water }. Returns the changed targets plus `changed` and `fibreMax`.
export function meetTargets({ days, bodyKg = 75, goals, level = 'gentle' }) {
  const kg = bodyKg > 30 ? bodyKg : 75
  const c = carbTarget({ days, kg, baseC: goals.c, level })
  const p = Math.max(goals.p, r5(1.6 * kg))
  const near = days >= 0 && days <= 1
  const f = near ? r5(goals.f * 0.9) : goals.f
  // calories follow the macros, so the three agree
  const kcal = Math.round(goals.kcal + 4 * (c - goals.c) + 4 * (p - goals.p) + 9 * (f - goals.f))
  const fibreMax = days >= 0 && days <= 1 ? 25 : days === 2 ? 30 : null
  const changed = c !== goals.c || p !== goals.p || f !== goals.f
  return { kcal, p, c, f, water: goals.water, fibreMax, changed }
}

const LIGHT = 'rice, khichdi, curd rice, idli, poha, plain roti, banana, paneer or eggs'
const HEAVY = 'raw salads, rajma or chole, cabbage-family vegetables, very spicy or oily food'

export function tipsFor({ days, bodyKg = 75, goals, level = 'gentle' }) {
  const kg = bodyKg > 30 ? bodyKg : 75
  const phase = phaseOf(days)
  const t = meetTargets({ days, bodyKg: kg, goals, level })
  const extraC = t.c - goals.c
  const norm = 'Keep water and salt normal: no water loading, no salt cutting, no dehydration.'
  switch (phase) {
    case 'build':
      return ['Nothing changes yet. Eat to your usual targets and keep sleep steady.', 'Log normal days now; the plan below is built around what you actually eat.']
    case 'practice':
      return [
        'Rehearse meet day in one hard session this week: the same breakfast, the same timing, the same drinks.',
        'If you plan to use caffeine at the meet, test it in training now. Skip it if you do not already use it.',
        `Keep protein at or above ${r5(1.6 * kg)} g a day (1.6 g/kg).`,
        'Nothing new from here: no new supplements and no unfamiliar foods.',
      ]
    case 'topup':
      return [
        extraC > 0 ? `Carbs go up by about ${extraC} g today, to ${t.c} g. Add ${LIGHT.split(', ').slice(0, 5).join(', ')} rather than extra fat.` : 'Your carbs are already at the top-up level. Keep them there.',
        norm,
        days === 3 ? 'Start easing fibre tomorrow.' : `Lower fibre now (aim for under ${t.fibreMax} g): prefer ${LIGHT}. Go easy on ${HEAVY}.`,
        'Nothing new: only foods you have eaten before a hard session.',
      ]
    case 'eve':
      return [
        `Low-fibre, familiar meals (${LIGHT}). Avoid ${HEAVY}.`,
        `Carbs about ${t.c} g, fat a little lower (${t.f} g), protein ${t.p} g.`,
        'Finish dinner at least 3 hours before bed and aim for a calm, early night. Sleep matters more than the last meal.',
        'Pack the bag: your usual breakfast foods, quick carbs (banana, dates), an electrolyte drink, and caffeine only if you have tested it.',
        norm,
      ]
    case 'meet':
      return ['Follow the schedule below. Eat only what you have practised.', norm]
    default:
      return ['The meet is done. Eat a normal high-protein, high-carb day and refill.', 'Go back to your usual targets tomorrow.']
  }
}

const hhmm = min => { const m = ((Math.round(min) % 1440) + 1440) % 1440; return pad(Math.floor(m / 60)) + ':' + pad(m % 60) }
const toMin = s => { const [h, m] = String(s || '09:00').split(':').map(Number); return (h || 0) * 60 + (m || 0) }

// Meet-day schedule counted back from the first lift ("HH:MM"). Amounts scale with body weight.
export function meetDaySchedule({ firstLift = '09:00', bodyKg = 75 } = {}) {
  const kg = bodyKg > 30 ? bodyKg : 75
  const t0 = toMin(firstLift)
  const fluid = r5(kg * 6)
  return [
    { at: hhmm(t0 - 240), title: 'Main meal', text: `About ${r5(kg * 1.5)} g carbs and 20 to 30 g protein, low in fibre and fat (${LIGHT}). Drink about ${fluid} ml of fluid with it.` },
    { at: hhmm(t0 - 90), title: 'Top-up snack', text: 'About 30 to 40 g of easy carbs: banana, dates, a plain biscuit or a small glass of juice. Sip water.' },
    { at: hhmm(t0 - 50), title: 'Caffeine (optional)', text: `Only if you have used it in training: about ${r5(kg * 3)} mg (3 mg/kg). Skip it if you do not already use it.` },
    { at: hhmm(t0 - 20), title: 'Warm up and sip', text: 'Small sips of water or an electrolyte drink. Do not force fluid or eat a big meal now.' },
    { at: 'Between rounds', title: 'While you wait', text: 'Every 1 to 2 hours: 20 to 40 g quick carbs and a few sips, as your stomach allows. Add electrolytes if you are sweating or the hall is hot.' },
    { at: 'After your last lift', title: 'Refuel', text: `About ${r5(kg * 0.4)} g protein and ${r5(kg * 1)} g carbs within 1 to 2 hours, plus a proper salted meal.` },
  ]
}

// Everything the screen needs for one day.
export function meetPlan({ days, bodyKg = 75, goals, level = 'gentle', firstLift = '09:00' }) {
  const phase = phaseOf(days)
  return {
    days, phase, label: PHASES[phase],
    headline: days > 0 ? `${days} day${days === 1 ? '' : 's'} to the meet` : days === 0 ? 'Meet day' : 'After the meet',
    targets: meetTargets({ days, bodyKg, goals, level }),
    tips: tipsFor({ days, bodyKg, goals, level }),
    schedule: phase === 'meet' || phase === 'eve' ? meetDaySchedule({ firstLift, bodyKg }) : [],
  }
}
