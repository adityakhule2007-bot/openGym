import { describe, it, expect } from 'vitest'
import { entryFromFood, entryFromMacros, dayTotals, coachTips, searchFoods, foodFromRow, IDX, atOf, dayKey, postWorkoutFuel, N } from './engine.js'

const rice = { id: 'a', n: 'Rice, cooked', u: 'g', b: 100, v: Array.from({ length: N }, (_, i) => (i === 0 ? 130 : i === 2 ? 28 : 0)) }
const roti = { id: 'b', n: 'Roti', u: 's', b: 1, s: '1 medium', v: Array.from({ length: N }, (_, i) => (i === 0 ? 112 : i === 2 ? 22 : 0)) }
const at = (h, m = 0) => atOf('2026-10-31', `${h}:${m}`)

describe('entries', () => {
  it('scales per-100g foods by grams and per-serving foods by count', () => {
    expect(entryFromFood(rice, 200, 1, 'x').v[IDX.k]).toBe(260)
    expect(entryFromFood(roti, 3, 1, 'y').v[IDX.c]).toBe(66)
  })
  it('sums a day', () => {
    const t = dayTotals([entryFromMacros('q', 100, 10, 5, 2, 1, 'a'), entryFromMacros('r', 50, 1, 1, 1, 1, 'b')])
    expect([t[0], t[1]]).toEqual([150, 11])
  })
})

describe('coach', () => {
  const base = { goals: { kcal: 2400, p: 150, c: 280, f: 70, water: 3000 }, workouts: [] }
  it('flags no carbs by midday', () => {
    const tips = coachTips({ ...base, entries: [entryFromMacros('eggs', 200, 20, 0, 12, at(9), 'e')], now: at(13) })
    expect(tips.find(t => t.id === 'carbs').title).toMatch(/any carbs/)
  })
  it('asks for pre-workout carbs when a session is planned', () => {
    expect(coachTips({ ...base, entries: [], now: at(16), plannedToday: true }).some(t => t.id === 'pre')).toBe(true)
  })
  it('gives post-workout fuel after a finished session, and stops once eaten', () => {
    const w = { d: '2026-10-31', start: at(15), end: at(16, 10), entries: [{ sets: Array.from({ length: 20 }, () => ({ done: true })) }] }
    const hungry = coachTips({ ...base, entries: [], now: at(16, 30), workouts: [w] })
    expect(hungry.some(t => t.id === 'post')).toBe(true)
    const fed = coachTips({ ...base, entries: [entryFromMacros('meal', 900, 60, 140, 20, at(16, 25), 'm')], now: at(17), workouts: [w] })
    expect(fed.some(t => t.id === 'post')).toBe(false)
  })
  it('fuel scales with body weight', () => {
    const l = { sets: 20, min: 70 }
    expect(postWorkoutFuel(l, 90).carbs).toBeGreaterThan(postWorkoutFuel(l, 60).carbs)
  })
})

describe('search', () => {
  it('finds by word and ranks built-ins first', () => {
    const core = [{ id: 'd1', n: 'Butter chicken', alt: 'murgh makhani', u: 's', b: 1, v: [] }]
    const more = [foodFromRow(['Butter, salted', 0, null, '', 1, []], 0)]
    expect(searchFoods(core, more, 'butter')[0].id).toBe('d1')
    expect(searchFoods(core, more, 'makhani')).toHaveLength(1)
    expect(searchFoods(core, more, 'zzz')).toHaveLength(0)
  })
  it('keys a day by local date', () => { expect(dayKey(at(23, 59))).toBe('2026-10-31') })
})
