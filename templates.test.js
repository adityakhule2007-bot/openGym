import { describe, it, expect } from 'vitest'
import { copyEntries, missingMeals, makeTemplate, entriesFromTemplate, templateTotals, suggestTemplate, itemsFromEntries, MAX_ITEMS } from './templates.js'
import { entryFromMacros, atOf, dayKey, hhmm } from './engine.js'

const at = (day, t) => atOf(day, t)
const mk = (id, day, t, kcal, name = id) => entryFromMacros(name, kcal, 10, 20, 5, at(day, t), id)
const ids = () => { let n = 0; return () => 'n' + ++n }

describe('copy', () => {
  it('moves entries to another day and keeps their time of day', () => {
    const out = copyEntries([mk('b', '2026-11-01', '13:00', 500), mk('a', '2026-11-01', '08:30', 300)], '2026-11-02', ids())
    expect(out.map(e => [dayKey(e.at), hhmm(e.at)])).toEqual([['2026-11-02', '08:30'], ['2026-11-02', '13:00']])
    expect(out.map(e => e.id)).toEqual(['n1', 'n2'])
  })
  it('copies the numbers, not a shared array', () => {
    const src = mk('a', '2026-11-01', '08:30', 300), [c] = copyEntries([src], '2026-11-02', ids())
    c.v[0] = 1
    expect(src.v[0]).toBe(300)
  })
})

describe('same as yesterday', () => {
  it('offers only the meals that have nothing logged yet today', () => {
    const y = [mk('y1', '2026-11-01', '08:00', 300), mk('y2', '2026-11-01', '13:00', 600), mk('y3', '2026-11-01', '20:00', 700)]
    const today = [mk('t1', '2026-11-02', '08:15', 250)]
    expect(missingMeals(y, today).map(e => e.id)).toEqual(['y2', 'y3'])
    expect(missingMeals(y, []).length).toBe(3)
  })
})

describe('templates', () => {
  const day = [mk('a', '2026-11-01', '08:00', 300, 'Oats'), mk('b', '2026-11-01', '13:00', 600, 'Rice and dal')]
  it('snapshots a day and applies it to another with the same times', () => {
    const t = makeTemplate({ id: 't1', name: ' Heavy day ', tag: 'training', entries: day, now: 5 })
    expect(t.name).toBe('Heavy day'); expect(t.items.map(i => i.t)).toEqual(['08:00', '13:00'])
    const out = entriesFromTemplate(t, '2026-11-05', ids())
    expect(out.map(e => [e.name, dayKey(e.at), hhmm(e.at)])).toEqual([['Oats', '2026-11-05', '08:00'], ['Rice and dal', '2026-11-05', '13:00']])
    expect(templateTotals(t)[0]).toBe(900)
  })
  it('falls back to "any" for an unknown tag and caps the item count', () => {
    expect(makeTemplate({ id: 'x', name: 'n', tag: 'weird', entries: day }).tag).toBe('any')
    const many = Array.from({ length: MAX_ITEMS + 10 }, (_, i) => mk('e' + i, '2026-11-01', '09:00', 10))
    expect(itemsFromEntries(many)).toHaveLength(MAX_ITEMS)
  })
  it('suggests the most recently used template for the kind of day', () => {
    const t = [
      { id: 'a', tag: 'training', made: 1, used: 5 }, { id: 'b', tag: 'training', made: 2, used: 9 },
      { id: 'c', tag: 'rest', made: 3, used: 0 }, { id: 'd', tag: 'any', made: 4, used: 99 },
    ]
    expect(suggestTemplate(t, true).id).toBe('b')
    expect(suggestTemplate(t, false).id).toBe('c')
    expect(suggestTemplate([{ id: 'a', tag: 'training', made: 1 }], false)).toBeNull()
  })
})
