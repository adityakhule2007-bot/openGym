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

import { unitsFor, defaultAmount, entryFromUnit, buildCustomFood, valuesPer, foodFromOFF, looksLikeBarcode, KEYS } from './engine.js'

describe('servings', () => {
  const oats = { id: 'o', n: 'Oats', u: 'g', b: 100, sv: [{ l: '1 cup (80 g)', g: 80 }], v: Array.from({ length: N }, (_, i) => (i === 0 ? 380 : i === 1 ? 13 : 0)) }
  it('offers named servings plus g and oz, and starts on the first serving', () => {
    expect(unitsFor(oats).map(u => u.label)).toEqual(['1 cup (80 g)', 'g', 'oz'])
    expect(defaultAmount(oats)).toEqual({ unit: 's0', qty: 1 })
    expect(defaultAmount({ ...oats, sv: [] })).toEqual({ unit: 'g', qty: 100 })
  })
  it('scales by serving, grams and ounces', () => {
    const u = unitsFor(oats)
    expect(entryFromUnit(oats, 2, u[0], 1, 'a').v[0]).toBeCloseTo(608)
    expect(entryFromUnit(oats, 50, u[1], 1, 'a').v[0]).toBeCloseTo(190)
    expect(entryFromUnit(oats, 1, u[2], 1, 'a').v[0]).toBeCloseTo(380 * 0.283495)
    expect(entryFromUnit(oats, 50, u[1], 1, 'a').desc).toBe('50 g')
  })
  it('counts dishes in servings', () => {
    expect(unitsFor(roti)).toHaveLength(1)
    expect(entryFromUnit(roti, 1.5, unitsFor(roti)[0], 1, 'b').v[IDX.k]).toBeCloseTo(168)
  })
})

describe('custom foods', () => {
  it('converts per-serving values to per 100 g and keeps every serving size', () => {
    const f = buildCustomFood({ id: 'c1', name: ' Protein bar ', servingLabel: '1 bar', servingG: 60, basis: 'serving',
      values: { k: '210', p: '20', c: '22', f: '7', mg: '30', b12: '1.2' }, extra: [{ l: 'half bar', g: '30' }, { l: '', g: '5' }] })
    expect(f.n).toBe('Protein bar')
    expect(f.v[IDX.k]).toBeCloseTo(350)
    expect(f.v[IDX.mg]).toBeCloseTo(50)
    expect(f.sv).toEqual([{ l: '1 bar', g: 60 }, { l: 'half bar', g: 30 }])
    expect(entryFromUnit(f, 1, unitsFor(f)[0], 0, '').v[IDX.k]).toBeCloseTo(210)
    expect(valuesPer(f, 60).k).toBe('210')
  })
  it('stores per-100g values as entered', () => {
    expect(buildCustomFood({ name: 'x', servingG: 40, basis: '100', values: { k: '500' } }).v[0]).toBe(500)
  })
  it('ranks the user’s own foods first in search', () => {
    const mine = [{ id: 'c', n: 'Rice mix', u: 'g', b: 100, v: [], hay: 'rice mix' }]
    const core = [{ id: 'd', n: 'Rice, cooked', u: 'g', b: 100, v: [] }]
    expect(searchFoods(core, null, 'rice', 40, mine)[0].id).toBe('c')
  })
})

describe('Open Food Facts', () => {
  const p = { code: '8901', product_name: 'Muesli', brands: 'Acme, Other', serving_size: '40 g', serving_quantity: '40',
    nutriments: { 'energy-kcal_100g': 380, proteins_100g: 9, carbohydrates_100g: 65, fat_100g: 8, sodium_100g: 0.2, calcium_100g: 0.05, 'vitamin-d_100g': 0.000005, 'vitamin-b12_100g': 0.000002 } }
  it('maps units: g to mg and µg', () => {
    const f = foodFromOFF(p)
    expect(f.n).toBe('Muesli by Acme')
    expect(f.v[IDX.na]).toBeCloseTo(200)
    expect(f.v[IDX.ca]).toBeCloseTo(50)
    expect(f.v[IDX.d]).toBeCloseTo(5)
    expect(f.v[IDX.b12]).toBeCloseTo(2)
    expect(f.sv).toEqual([{ l: '40 g', g: 40 }])
    expect(f.ean).toBe('8901')
  })
  it('falls back to kJ and to salt', () => {
    const f = foodFromOFF({ product_name: 'Chips', nutriments: { energy_100g: 2000, salt_100g: 1.5 } })
    expect(f.v[0]).toBeCloseTo(478, 0)
    expect(f.v[IDX.na]).toBeCloseTo(600)
  })
  it('drops products without energy, name or with impossible values', () => {
    expect(foodFromOFF({ product_name: 'x', nutriments: {} })).toBeNull()
    expect(foodFromOFF({ nutriments: { 'energy-kcal_100g': 10 } })).toBeNull()
    expect(foodFromOFF({ product_name: 'bad', nutriments: { 'energy-kcal_100g': 5000 } })).toBeNull()
    expect(foodFromOFF(null)).toBeNull()
  })
  it('recognises barcodes', () => {
    expect(looksLikeBarcode('8901030865279')).toBe(true)
    expect(looksLikeBarcode('rice')).toBe(false)
    expect(KEYS).toHaveLength(N)
  })
})

describe('serving foods with a stated weight', () => {
  const mk = s => ({ id: 'd', n: 'Dish', u: 's', b: 1, s, v: Array.from({ length: N }, (_, i) => (i === 0 ? 200 : 0)) })
  it('offers grams for a cooked or edible weight, and scales by it', () => {
    const f = mk('1 medium (100 g edible)')
    const u = unitsFor(f)
    expect(u.map(x => x.id)).toEqual(['s0', 'g', 'oz'])
    expect(entryFromUnit(f, 50, u[1], 1, 'a').v[0]).toBeCloseTo(100)       // 50 g of a 100 g serving
    expect(unitsFor(mk('100 g cooked (about 130 g raw)')).map(x => x.id)).toContain('g')
  })
  it('does not offer grams when the weight is an ingredient, or absent', () => {
    expect(unitsFor(mk('1 medium (35 g atta)')).map(x => x.id)).toEqual(['s0'])
    expect(unitsFor(mk('1 katori')).map(x => x.id)).toEqual(['s0'])
  })
})
