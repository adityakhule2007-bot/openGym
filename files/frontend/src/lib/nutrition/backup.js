// Diet backup: a separate JSON file (the diary lives outside openGym's own backup, see store.js).
// parseBackup() trusts nothing: it drops malformed rows and clamps numbers before anything touches the store.
import { N, DEFAULT_GOALS } from './engine.js'

const APP = 'openGym-nutrition'
export const BACKUP_VERSION = 1
const isNum = x => typeof x === 'number' && Number.isFinite(x)
const str = (x, max = 200) => (typeof x === 'string' ? x.slice(0, max) : '')
const vec = v => (Array.isArray(v) && v.length <= N + 8 ? Array.from({ length: N }, (_, i) => (isNum(v[i]) && v[i] >= 0 && v[i] < 1e7 ? v[i] : 0)) : null)

export function buildBackup(s, now = Date.now()) {
  return { app: APP, version: BACKUP_VERSION, exportedAt: new Date(now).toISOString(),
    data: { entries: s.entries, water: s.water, recentFoods: s.recentFoods, customFoods: s.customFoods, goals: s.goals } }
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
  const out = { entries: entries.filter(Boolean), water: water.filter(Boolean), customFoods: customFoods.filter(Boolean), recentFoods: recent.filter(Boolean), goals, skipped }
  if (!out.entries.length && !out.water.length && !out.customFoods.length) throw new Error('empty')
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
  }
}
export const replaceData = inc => ({ entries: inc.entries, water: inc.water, customFoods: inc.customFoods, recentFoods: inc.recentFoods, goals: inc.goals })
