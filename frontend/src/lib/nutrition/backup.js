// Diet backup: a separate JSON file (the diary lives outside openGym's own backup, see store.js).
// parseBackup() trusts nothing: it drops malformed rows and clamps numbers before anything touches the store.
import { N, DEFAULT_GOALS } from './engine.js'

const APP = 'openGym-nutrition'
export const BACKUP_VERSION = 3
const isNum = x => typeof x === 'number' && Number.isFinite(x)
const str = (x, max = 200) => (typeof x === 'string' ? x.slice(0, max) : '')
const vec = v => (Array.isArray(v) && v.length <= N + 8 ? Array.from({ length: N }, (_, i) => (isNum(v[i]) && v[i] >= 0 && v[i] < 1e7 ? v[i] : 0)) : null)

export function buildBackup(s, now = Date.now()) {
  return { app: APP, version: BACKUP_VERSION, exportedAt: new Date(now).toISOString(),
    data: {
      entries: s.entries, water: s.water, recentFoods: s.recentFoods, customFoods: s.customFoods, goals: s.goals,
      favorites: s.favorites || [], templates: s.templates || [], dayType: s.dayType || 'training',
      trainingGoals: s.trainingGoals || s.goals, restGoals: s.restGoals || s.goals,
      meet: s.meet || { enabled: false, date: '', weightClass: '', checklist: {} }, mealPhotos: s.mealPhotos || [],
      neuroFuel: s.neuroFuel || {}, caffeine: s.caffeine || [],
    } }
}

const cleanEntry = e => {
  const v = vec(e?.v)
  if (!e || typeof e.id !== 'string' || !isNum(e.at) || !v || !str(e.name)) return null
  return { id: str(e.id, 64), at: e.at, name: str(e.name), desc: str(e.desc), v }
}
const cleanWater = w => (w && typeof w.id === 'string' && isNum(w.at) && isNum(w.ml) && w.ml > 0 && w.ml < 10000 ? { id: str(w.id, 64), at: w.at, ml: w.ml } : null)
const cleanFood = f => {
  const v = vec(f?.v)
  if (!f || typeof f.id !== 'string' || !str(f.n) || (f.u !== 'g' && f.u !== 's') || !v) return null
  const sv = Array.isArray(f.sv) ? f.sv.filter(x => x && isNum(x.g) && x.g > 0 && x.g < 5000 && str(x.l)).map(x => ({ l: str(x.l, 80), g: x.g })).slice(0, 20) : []
  return { id: str(f.id, 64), n: str(f.n), brand: str(f.brand, 80), u: f.u, b: f.u === 'g' ? 100 : 1, s: str(f.s, 120), sg: isNum(f.sg) && f.sg > 0 ? f.sg : 0, sv,
    ean: str(f.ean, 20), src: str(f.src, 40) || 'My foods', custom: true, v }
}

// Text -> { entries, water, recentFoods, customFoods, goals, skipped } or throws Error('not-a-backup' | 'newer' | 'empty').
export function parseBackup(text) {
  let o
  try { o = JSON.parse(text) } catch { throw new Error('not-a-backup') }
  if (!o || o.app !== APP || !o.data || typeof o.data !== 'object') throw new Error('not-a-backup')
  if (!(o.version <= BACKUP_VERSION)) throw new Error('newer')
  const d = o.data
  const list = (a, fn) => (Array.isArray(a) ? a.map(fn) : [])
  const entries = list(d.entries, cleanEntry), water = list(d.water, cleanWater), customFoods = list(d.customFoods, cleanFood), recent = list(d.recentFoods, cleanFood)
  const skipped = [entries, water, customFoods, recent].reduce((n, a) => n + a.filter(x => !x).length, 0)
  const goals = { ...DEFAULT_GOALS }
  for (const k of Object.keys(DEFAULT_GOALS)) if (isNum(d.goals?.[k]) && d.goals[k] > 0 && d.goals[k] < 100000) goals[k] = d.goals[k]
  const cleanGoals = source => {
    const out = { ...DEFAULT_GOALS }
    for (const k of Object.keys(DEFAULT_GOALS)) if (isNum(source?.[k]) && source[k] > 0 && source[k] < 100000) out[k] = source[k]
    return out
  }
  const cleanTemplates = list(d.templates, t => {
    if (!t || typeof t.name !== 'string' || !Array.isArray(t.items)) return null
    const items = t.items.filter(x => x && typeof x.name === 'string' && vec(x.v)).slice(0, 80)
      .map(x => ({ name: str(x.name), desc: str(x.desc), meal: str(x.meal, 40), v: vec(x.v) }))
    return items.length ? { id: str(t.id, 64) || Math.random().toString(36).slice(2, 10), name: str(t.name, 80), type: t.type === 'rest' ? 'rest' : 'training', items } : null
  }).filter(Boolean)
  const photos = list(d.mealPhotos, p => p && typeof p.data === 'string' && p.data.startsWith('data:image/') && p.data.length < 280000
    ? { id: str(p.id, 64), day: str(p.day, 10), note: str(p.note, 120), data: p.data, at: isNum(p.at) ? p.at : Date.now() } : null).filter(Boolean).slice(-12)
  const favorites = list(d.favorites, cleanFood).filter(Boolean).slice(0, 60)
  const out = {
    entries: entries.filter(Boolean), water: water.filter(Boolean), customFoods: customFoods.filter(Boolean),
    recentFoods: recent.filter(Boolean), goals, favorites, templates: cleanTemplates,
    dayType: d.dayType === 'rest' ? 'rest' : 'training',
    trainingGoals: cleanGoals(d.trainingGoals), restGoals: cleanGoals(d.restGoals),
    meet: { enabled: !!d.meet?.enabled, date: /^\d{4}-\d{2}-\d{2}$/.test(d.meet?.date || '') ? d.meet.date : '', weightClass: str(d.meet?.weightClass, 40), checklist: d.meet?.checklist && typeof d.meet.checklist === 'object' ? Object.fromEntries(Object.entries(d.meet.checklist).slice(0, 10).map(([k,v]) => [k, !!v])) : {} },
    mealPhotos: photos,
    neuroFuel: { sessionTime: /^\d{2}:\d{2}$/.test(d.neuroFuel?.sessionTime || '') ? d.neuroFuel.sessionTime : '16:30', bedtime: /^\d{2}:\d{2}$/.test(d.neuroFuel?.bedtime || '') ? d.neuroFuel.bedtime : '23:00', caffeineCutoffHours: isNum(d.neuroFuel?.caffeineCutoffHours) ? Math.max(4,Math.min(12,d.neuroFuel.caffeineCutoffHours)) : 8, caffeineHalfLife: isNum(d.neuroFuel?.caffeineHalfLife) ? Math.max(3,Math.min(10,d.neuroFuel.caffeineHalfLife)) : 5, caffeineLimit: isNum(d.neuroFuel?.caffeineLimit) ? Math.max(0,Math.min(1000,d.neuroFuel.caffeineLimit)) : 400, sleepHours: d.neuroFuel?.sleepHours === '' ? '' : (isNum(Number(d.neuroFuel?.sleepHours)) ? String(Math.max(0,Math.min(24,Number(d.neuroFuel.sleepHours)))) : ''), sleepQuality: ['unknown','poor','average','good'].includes(d.neuroFuel?.sleepQuality) ? d.neuroFuel.sleepQuality : 'unknown', sleepLoggedAt: isNum(d.neuroFuel?.sleepLoggedAt) ? d.neuroFuel.sleepLoggedAt : null },
    caffeine: list(d.caffeine, x => x && typeof x.source === 'string' && isNum(x.at) && isNum(x.mg) && x.mg > 0 && x.mg <= 1000 ? { id: str(x.id,64) || Math.random().toString(36).slice(2,10), at:x.at, mg:x.mg, source:str(x.source,40) } : null).filter(Boolean).slice(-500), skipped,
  }
  if (!out.entries.length && !out.water.length && !out.customFoods.length && !out.caffeine.length) throw new Error('empty')
  return out
}

// Merge keeps what is on the phone and adds what the file has (same id: the file wins for foods, the phone for entries).
export function mergeData(cur, inc) {
  const byId = (a, b, preferB) => { const m = new Map(a.map(x => [x.id, x])); for (const x of b) if (preferB || !m.has(x.id)) m.set(x.id, x); return [...m.values()] }
  return {
    entries: byId(cur.entries, inc.entries, false).sort((a, b) => a.at - b.at),
    water: byId(cur.water, inc.water, false).sort((a, b) => a.at - b.at),
    customFoods: byId(cur.customFoods, inc.customFoods, true),
    recentFoods: byId(cur.recentFoods, inc.recentFoods, false).slice(0, 30),
    goals: cur.goals,
    favorites: byId(cur.favorites || [], inc.favorites || [], true).slice(0, 60),
    templates: byId(cur.templates || [], inc.templates || [], true).slice(0, 30),
    dayType: cur.dayType || 'training',
    trainingGoals: cur.trainingGoals || cur.goals,
    restGoals: cur.restGoals || cur.goals,
    meet: cur.meet || inc.meet || { enabled: false, date: '', weightClass: '', checklist: {} },
    mealPhotos: [...(cur.mealPhotos || []), ...(inc.mealPhotos || [])].slice(-4),
    neuroFuel: cur.neuroFuel || inc.neuroFuel || {}, caffeine: byId(cur.caffeine || [], inc.caffeine || [], false).slice(-500),
  }
}
export const replaceData = inc => ({
  entries: inc.entries, water: inc.water, customFoods: inc.customFoods, recentFoods: inc.recentFoods,
  goals: inc.goals, favorites: inc.favorites || [], templates: inc.templates || [],
  dayType: inc.dayType || 'training', trainingGoals: inc.trainingGoals || inc.goals,
  restGoals: inc.restGoals || inc.goals, meet: inc.meet || { enabled: false, date: '', weightClass: '', checklist: {} },
  mealPhotos: inc.mealPhotos || [], neuroFuel: inc.neuroFuel || {}, caffeine: inc.caffeine || [],
})
