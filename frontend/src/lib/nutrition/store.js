// Nutrition data lives in its own localStorage key, separate from the synced workout state S,
// so it never leaves the device and cannot disturb the workout sync or backups.
import { create } from 'zustand'
import { DEFAULT_GOALS } from './engine.js'

const KEY = 'opengym:nutrition:v1'
const load = () => {
  try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && Array.isArray(s.entries)) return { goals: DEFAULT_GOALS, water: [], recent: [], ...s, goals: { ...DEFAULT_GOALS, ...s.goals } } } catch { /* start empty */ }
  return { entries: [], water: [], recent: [], goals: DEFAULT_GOALS }
}
const save = s => { try { localStorage.setItem(KEY, JSON.stringify({ entries: s.entries, water: s.water, recent: s.recent, goals: s.goals })) } catch { /* quota: keep in memory */ } }
const uid = () => Math.random().toString(36).slice(2, 10)

export const useNutrition = create((set, get) => ({
  ...load(),
  addEntry: e => { const entries = [...get().entries, { ...e, id: e.id || uid() }]; const recent = [e.name, ...get().recent.filter(n => n !== e.name)].slice(0, 12); set({ entries, recent }); save(get()) },
  removeEntry: id => { set({ entries: get().entries.filter(e => e.id !== id) }); save(get()) },
  addWater: (ml, at = Date.now()) => { set({ water: [...get().water, { id: uid(), at, ml }] }); save(get()) },
  undoWater: day => { const w = get().water.filter(x => x.at >= day.from && x.at < day.to); const last = w.sort((a, b) => b.at - a.at)[0]; if (last) { set({ water: get().water.filter(x => x.id !== last.id) }); save(get()) } },
  setGoals: g => { set({ goals: { ...get().goals, ...g } }); save(get()) },
}))
