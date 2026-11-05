// Diet backup: a separate JSON file (the diary lives outside openGym's own backup, see store.js).
// parseBackup() trusts nothing: it drops malformed rows and clamps numbers before anything touches the store.
// Version 2 adds saved meals / templates and the meet date. Version 1 files still import. Meal photos are not part of a backup.
import { N, DEFAULT_GOALS } from './engine.js'
import { cleanMeet } from './meet.js'
import { MAX_TEMPLATES, MAX_ITEMS, TAGS } from './templates.js'

const APP = 'openGym-nutrition'
export const BACKUP_VERSION = 2
const isNum = x => typeof x === 'number' && Number.isFinite(x)
const str = (x, max = 200) => (typeof x === 'string' ? x.slice(0, max) : '')
const vec = v => (Array.isArray(v) && v.length <= N + 8 ? Array.from({ length: N }, (_, i) => (isNum(v[i]) && v[i] >= 0 && v[i] < 1e7 ? v[i] : 0)) : null)

export function buildBackup(s, now = Date.now()) {
  return { app: APP, version: BACKUP_VERSION, exportedAt: new Date(now).toISOString(),
    data: { entries: s.entries, water: s.water, recentFoods: s.recentFoods, customFoods: s.customFoods, goals: s.goals, templates: s.templates || [], meet: s.meet || null } }
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
const cleanItem = i => {
  const v = vec(i?.v)
  return i && v && str(i.name) && /^\d{2}:\d{2}$/.test(i.t) ? { name: str(i.name), desc: str(i.desc), v, t: i.t } : null
}
const cleanTemplate = t => {
  if (!t || typeof t.id !== 'string' || !str(t.name) || !Array.isArray(t.items)) return null
  const items = t.items.slice(0, MAX_ITEMS).map(cleanItem).filter(Boolean)
  if (!items.length) return null
  return { id: str(t.id, 64), name: str(t.name, 60), tag: TAGS.some(x => x.id === t.tag) ? t.tag : 'any', items, made: isNum(t.made) ? t.made : 0, used: isNum(t.used) ? t.used : 0 }
}

// Text -> { entries, water, recentFoods, customFoods, templates, meet, goals, skipped } or throws Error('not-a-backup' | 'newer' | 'empty').
export function parseBackup(text) {
  let o
  try { o = JSON.parse(text) } catch { throw new Error('not-a-backup') }
  if (!o || o.app !== APP || !o.data || typeof o.data !== 'object') throw new Error('not-a-backup')
  if (!(o.version <= BACKUP_VERSION)) throw new Error('newer')
  const d = o.data
  const list = (a, fn) => (Array.isArray(a) ? a.map(fn) : [])
  const entries = list(d.entries, cleanEntry), water = list(d.water, cleanWater), customFoods = list(d.customFoods, cleanFood), recent = list(d.recentFoods, cleanFood)
  const templates = list(d.templates, cleanTemplate).slice(0, MAX_TEMPLATES)
  const skipped = [entries, water, customFoods, recent, templates].reduce((n, a) => n + a.filter(x => !x).length, 0)
  const goals = { ...DEFAULT_GOALS }
  for (const k of Object.keys(DEFAULT_GOALS)) if (isNum(d.goals?.[k]) && d.goals[k] > 0 && d.goals[k] < 100000) goals[k] = d.goals[k]
  const out = { entries: entries.filter(Boolean), water: water.filter(Boolean), customFoods: customFoods.filter(Boolean), recentFoods: recent.filter(Boolean),
    templates: templates.filter(Boolean), meet: d.meet ? cleanMeet(d.meet) : null, goals, skipped }
  if (!out.entries.length && !out.water.length && !out.customFoods.length && !out.templates.length) throw new Error('empty')
  return out
}

// Merge keeps what is on the phone and adds what the file has (same id: the file wins for foods and templates, the phone for entries).
export function mergeData(cur, inc) {
  const byId = (a, b, preferB) => { const m = new Map(a.map(x => [x.id, x])); for (const x of b) if (preferB || !m.has(x.id)) m.set(x.id, x); return [...m.values()] }
  return {
    entries: byId(cur.entries, inc.entries, false).sort((a, b) => a.at - b.at),
    water: byId(cur.water, inc.water, false).sort((a, b) => a.at - b.at),
    customFoods: byId(cur.customFoods, inc.customFoods, true),
    recentFoods: byId(cur.recentFoods, inc.recentFoods, false).slice(0, 30),
    templates: byId(cur.templates || [], inc.templates || [], true).slice(0, MAX_TEMPLATES),
    meet: cur.meet || inc.meet || null,
    goals: cur.goals,
  }
}
export const replaceData = inc => ({ entries: inc.entries, water: inc.water, customFoods: inc.customFoods, recentFoods: inc.recentFoods, templates: inc.templates || [], meet: inc.meet || null, goals: inc.goals })
