// Nutrition data lives in its own localStorage key, separate from the synced workout state S,
// so it never leaves the device and cannot disturb the workout sync or backups.
// Photos are not here: only a small record per photo (`shots`); the picture itself is in IndexedDB (photos.js).
import { create } from 'zustand'
import { DEFAULT_GOALS } from './engine.js'
import { cleanMeet } from './meet.js'
import { MAX_TEMPLATES } from './templates.js'

const KEY = 'opengym:nutrition:v1'
const EMPTY = { entries: [], water: [], recentFoods: [], customFoods: [], goals: DEFAULT_GOALS, templates: [], shots: [], meet: null }
const arr = a => (Array.isArray(a) ? a : [])
const load = () => {
  try {
    const s = JSON.parse(localStorage.getItem(KEY))
    if (s && Array.isArray(s.entries)) return { ...EMPTY, ...s, recentFoods: arr(s.recentFoods), customFoods: arr(s.customFoods), templates: arr(s.templates), shots: arr(s.shots), meet: cleanMeet(s.meet), goals: { ...DEFAULT_GOALS, ...s.goals } }
  } catch { /* start empty */ }
  return { ...EMPTY }
}
const save = s => { try { localStorage.setItem(KEY, JSON.stringify({ entries: s.entries, water: s.water, recentFoods: s.recentFoods, customFoods: s.customFoods, goals: s.goals, templates: s.templates, shots: s.shots, meet: s.meet })) } catch { /* quota: keep in memory */ } }
export const uid = () => Math.random().toString(36).slice(2, 10)
const strip = f => { const { hay, ...rest } = f; return rest }

export const useNutrition = create((set, get) => ({
  ...load(),
  // food (optional): the food behind the entry, kept in Recent for quick re-logging.
  addEntry: (e, food) => {
    const entries = [...get().entries, { ...e, id: e.id || uid() }]
    const recentFoods = food ? [strip(food), ...get().recentFoods.filter(f => f.id !== food.id)].slice(0, 30) : get().recentFoods
    set({ entries, recentFoods }); save(get())
  },
  // Several entries at once (copy a meal, same as yesterday, apply a template).
  addEntries: list => { set({ entries: [...get().entries, ...list.map(e => ({ ...e, id: e.id || uid() }))] }); save(get()) },
  removeEntry: id => { set({ entries: get().entries.filter(e => e.id !== id) }); save(get()) },
  addWater: (ml, at = Date.now()) => { set({ water: [...get().water, { id: uid(), at, ml }] }); save(get()) },
  undoWater: day => { const last = get().water.filter(x => x.at >= day.from && x.at < day.to).sort((a, b) => b.at - a.at)[0]; if (last) { set({ water: get().water.filter(x => x.id !== last.id) }); save(get()) } },
  setGoals: g => { set({ goals: { ...get().goals, ...g } }); save(get()) },
  // My foods: custom foods and any food saved from search / Open Food Facts.
  saveFood: f => {
    const food = strip({ ...f, id: f.id && f.custom ? f.id : 'c' + uid(), custom: true, src: f.src || 'My foods' })
    const rest = get().customFoods.filter(x => x.id !== food.id)
    set({ customFoods: [food, ...rest], recentFoods: get().recentFoods.map(r => (r.id === food.id ? food : r)) }); save(get())
    return food
  },
  deleteFood: id => { set({ customFoods: get().customFoods.filter(f => f.id !== id), recentFoods: get().recentFoods.filter(f => f.id !== id) }); save(get()) },

  // Saved meals and day templates (templates.js).
  saveTemplate: t => { set({ templates: [t, ...get().templates.filter(x => x.id !== t.id)].slice(0, MAX_TEMPLATES) }); save(get()) },
  deleteTemplate: id => { set({ templates: get().templates.filter(t => t.id !== id) }); save(get()) },
  touchTemplate: id => { set({ templates: get().templates.map(t => (t.id === id ? { ...t, used: Date.now() } : t)) }); save(get()) },

  // Meet-week mode: { date: 'YYYY-MM-DD', first: 'HH:MM', level, use } or null.
  setMeet: m => { set({ meet: cleanMeet(m) }); save(get()) },

  // Meal photo records.
  setShots: shots => { set({ shots }); save(get()) },
  addShot: s => { set({ shots: [...get().shots, s] }); save(get()) },
  removeShot: id => { set({ shots: get().shots.filter(s => s.id !== id) }); save(get()) },

  // Diet backup import: data comes from backup.js (already validated). Fields a backup does not carry stay as they are.
  setData: d => {
    set({ entries: d.entries, water: d.water, customFoods: d.customFoods, recentFoods: d.recentFoods, goals: d.goals,
      templates: d.templates ?? get().templates, meet: d.meet === undefined ? get().meet : d.meet })
    save(get())
  },
}))
