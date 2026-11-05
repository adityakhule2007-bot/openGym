// Quick-log helpers: copy meals between days, "same as yesterday", and saved meals / day templates. Pure functions.
// A template stores a snapshot of what was logged (name, description, nutrient vector, time of day), so it never
// depends on a food still being in search, and applying it is one tap.
import { atOf, dayKey, hhmm, mealLabel, addVec, zeros } from './engine.js'

export const MAX_TEMPLATES = 24
export const MAX_ITEMS = 40
export const TAGS = [{ id: 'any', label: 'Any day' }, { id: 'training', label: 'Training day' }, { id: 'rest', label: 'Rest day' }]
export const tagLabel = id => (TAGS.find(t => t.id === id) || TAGS[0]).label

const copyV = v => v.slice()

// New entries for `toDay` copied from `entries`. Times of day are kept unless `at` (ms) is given for the first one.
export function copyEntries(entries, toDay, newId, { time = 'keep' } = {}) {
  return [...entries].sort((a, b) => a.at - b.at).map(e => ({
    id: newId(), at: time === 'keep' ? atOf(toDay, hhmm(e.at)) : atOf(toDay, hhmm(Date.now())), name: e.name, desc: e.desc, v: copyV(e.v),
  }))
}

// "Same as yesterday": the meals of `fromEntries` whose meal label has nothing logged yet in `todayEntries`.
export function missingMeals(fromEntries, todayEntries) {
  const have = new Set(todayEntries.map(e => mealLabel(e.at)))
  return fromEntries.filter(e => !have.has(mealLabel(e.at)))
}

export function itemsFromEntries(entries) {
  return [...entries].sort((a, b) => a.at - b.at).slice(0, MAX_ITEMS).map(e => ({ name: e.name, desc: e.desc, v: copyV(e.v), t: hhmm(e.at) }))
}
export function makeTemplate({ id, name, tag = 'any', entries, now = Date.now() }) {
  return { id, name: String(name).trim().slice(0, 60), tag: TAGS.some(t => t.id === tag) ? tag : 'any', items: itemsFromEntries(entries), made: now, used: 0 }
}
// A template's items as entries on `day`. Times of day are kept.
export function entriesFromTemplate(tpl, day, newId) {
  return tpl.items.map(i => ({ id: newId(), at: atOf(day, i.t), name: i.name, desc: i.desc, v: copyV(i.v) }))
}
export function templateTotals(tpl) {
  const t = zeros()
  for (const i of tpl.items) addVec(t, i.v)
  return t
}

// The template to offer for today: the most recently used one saved for this kind of day (training or rest).
export function suggestTemplate(templates, trainingDay) {
  const tag = trainingDay ? 'training' : 'rest'
  const pool = templates.filter(t => t.tag === tag)
  pool.sort((a, b) => (b.used || 0) - (a.used || 0) || b.made - a.made)
  return pool[0] || null
}

export const dayOf = ms => dayKey(ms)
