// Nutrition data lives in its own localStorage key, separate from the synced workout state S,
// so it never leaves the device and cannot disturb the workout sync or backups.
import { create } from 'zustand'
import { DEFAULT_GOALS } from './engine.js'

const KEY = 'opengym:nutrition:v1'
const EMPTY = {
  entries: [], water: [], recentFoods: [], customFoods: [], goals: DEFAULT_GOALS,
  favorites: [], templates: [], dayType: 'training',
  trainingGoals: DEFAULT_GOALS, restGoals: DEFAULT_GOALS,
  meet: { enabled: false, date: '', weightClass: '' }, mealPhotos: [],
}
const load = () => {
  try {
    const s = JSON.parse(localStorage.getItem(KEY))
    if (s && Array.isArray(s.entries)) return { ...EMPTY, ...s, recentFoods: Array.isArray(s.recentFoods) ? s.recentFoods : [], customFoods: Array.isArray(s.customFoods) ? s.customFoods : [], goals: { ...DEFAULT_GOALS, ...s.goals },
      favorites: Array.isArray(s.favorites) ? s.favorites : [],
      templates: Array.isArray(s.templates) ? s.templates : [],
      dayType: s.dayType === 'rest' ? 'rest' : 'training',
      trainingGoals: { ...DEFAULT_GOALS, ...s.trainingGoals },
      restGoals: { ...EMPTY.restGoals, ...s.restGoals },
      meet: { ...EMPTY.meet, ...s.meet },
      mealPhotos: Array.isArray(s.mealPhotos) ? s.mealPhotos : [] }
  } catch { /* start empty */ }
  return { ...EMPTY }
}
const save = s => { try { localStorage.setItem(KEY, JSON.stringify({ entries: s.entries, water: s.water, recentFoods: s.recentFoods, customFoods: s.customFoods, goals: s.goals, favorites: s.favorites, templates: s.templates,
  dayType: s.dayType, trainingGoals: s.trainingGoals, restGoals: s.restGoals,
  meet: s.meet, mealPhotos: s.mealPhotos })) } catch { /* quota: keep in memory */ } }
const uid = () => Math.random().toString(36).slice(2, 10)
const strip = f => { const { hay, ...rest } = f; return rest }
const haptic = () => { try { if (localStorage.getItem('opengym:haptics') !== '0') navigator.vibrate?.(8) } catch { /* optional */ } }

export const useNutrition = create((set, get) => ({
  ...load(),
  // food (optional): the food behind the entry, kept in Recent for quick re-logging.
  addEntry: (e, food) => {
    const entries = [...get().entries, { ...e, id: e.id || uid() }]
    const recentFoods = food ? [strip(food), ...get().recentFoods.filter(f => f.id !== food.id)].slice(0, 30) : get().recentFoods
    set({ entries, recentFoods }); save(get()); haptic()
  },
  removeEntry: id => { set({ entries: get().entries.filter(e => e.id !== id) }); save(get()) },
  addWater: (ml, at = Date.now()) => { set({ water: [...get().water, { id: uid(), at, ml }] }); save(get()); haptic() },
  undoWater: day => { const last = get().water.filter(x => x.at >= day.from && x.at < day.to).sort((a, b) => b.at - a.at)[0]; if (last) { set({ water: get().water.filter(x => x.id !== last.id) }); save(get()) } },
  setGoals: g => {
    const key = get().dayType === 'rest' ? 'restGoals' : 'trainingGoals'
    set({ goals: { ...get().goals, ...g }, [key]: { ...get()[key], ...g } }); save(get())
  },
  setDayType: type => {
    const next = type === 'rest' ? 'rest' : 'training'
    const targets = next === 'rest' ? get().restGoals : get().trainingGoals
    set({ dayType: next, goals: { ...targets } }); save(get())
  },
  saveDayTargets: (type, goals) => {
    const key = type === 'rest' ? 'restGoals' : 'trainingGoals'
    set({ [key]: { ...get()[key], ...goals } }); save(get())
  },
  toggleFavorite: food => {
    const id = food.id
    const favorites = get().favorites.some(f => f.id === id)
      ? get().favorites.filter(f => f.id !== id)
      : [strip(food), ...get().favorites].slice(0, 60)
    set({ favorites }); save(get())
  },
  addTemplate: template => {
    const templates = [ { ...template, id: template.id || uid(), createdAt: Date.now() }, ...get().templates ].slice(0, 30)
    set({ templates }); save(get()); return templates[0]
  },
  removeTemplate: id => { set({ templates: get().templates.filter(t => t.id !== id) }); save(get()) },
  setMeet: meet => { set({ meet: { ...get().meet, ...meet } }); save(get()) },
  addMealPhoto: photo => { set({ mealPhotos: [...get().mealPhotos, { ...photo, id: uid(), at: Date.now() }].slice(-4) }); save(get()) },
  removeMealPhoto: id => { set({ mealPhotos: get().mealPhotos.filter(p => p.id !== id) }); save(get()) },
  // My foods: custom foods and any food saved from search / Open Food Facts.
  saveFood: f => {
    const food = strip({ ...f, id: f.id && f.custom ? f.id : 'c' + uid(), custom: true, src: f.src || 'My foods' })
    const rest = get().customFoods.filter(x => x.id !== food.id)
    set({ customFoods: [food, ...rest], recentFoods: get().recentFoods.map(r => (r.id === food.id ? food : r)) }); save(get())
    return food
  },
  // Diet backup import: data comes from backup.js (already validated). mode: 'merge' | 'replace'.
  setData: d => { set({ ...EMPTY, ...get(), ...d, entries: d.entries, water: d.water, customFoods: d.customFoods,
    recentFoods: d.recentFoods, goals: d.goals }); save(get()) },
  deleteFood: id => { set({ customFoods: get().customFoods.filter(f => f.id !== id), recentFoods: get().recentFoods.filter(f => f.id !== id) }); save(get()) },
}))
