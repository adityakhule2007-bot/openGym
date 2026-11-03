import { describe, it, expect } from 'vitest'
import { buildBackup, parseBackup, mergeData, replaceData } from './backup.js'
import { N, DEFAULT_GOALS, entryFromMacros } from './engine.js'

const food = { id: 'c1', n: 'My shake', u: 'g', b: 100, sv: [{ l: '1 glass', g: 300 }], v: Array.from({ length: N }, (_, i) => (i === 0 ? 80 : 0)), custom: true }
const state = () => ({ entries: [entryFromMacros('Eggs', 200, 18, 1, 14, 1000, 'e1'), entryFromMacros('Rice', 300, 6, 65, 1, 2000, 'e2')], water: [{ id: 'w1', at: 1500, ml: 500 }], recentFoods: [food], customFoods: [food], goals: { ...DEFAULT_GOALS, kcal: 2800 } })

describe('diet backup', () => {
  it('round-trips through JSON', () => {
    const s = state(), p = parseBackup(JSON.stringify(buildBackup(s)))
    expect(p.entries.map(e => e.id)).toEqual(['e1', 'e2'])
    expect(p.entries[0].v[0]).toBe(200)
    expect(p.customFoods[0].sv).toEqual([{ l: '1 glass', g: 300 }])
    expect(p.goals.kcal).toBe(2800); expect(p.skipped).toBe(0)
  })
  it('rejects files that are not diet backups', () => {
    expect(() => parseBackup('nope')).toThrow('not-a-backup')
    expect(() => parseBackup('{"app":"other"}')).toThrow('not-a-backup')
    expect(() => parseBackup(JSON.stringify({ ...buildBackup(state()), version: 99 }))).toThrow('newer')
    expect(() => parseBackup(JSON.stringify({ app: 'openGym-nutrition', version: 1, data: { entries: [] } }))).toThrow('empty')
  })
  it('drops malformed rows instead of trusting them', () => {
    const b = buildBackup(state()); b.data.entries.push({ id: 5, at: 'x' }, { id: 'bad', at: 1, name: 'n', v: 'no' }); b.data.goals.kcal = -4
    const p = parseBackup(JSON.stringify(b))
    expect(p.entries).toHaveLength(2); expect(p.skipped).toBe(2); expect(p.goals.kcal).toBe(DEFAULT_GOALS.kcal)
  })
  it('merge adds without duplicating; replace swaps everything', () => {
    const cur = state(), inc = parseBackup(JSON.stringify(buildBackup({ ...state(), entries: [entryFromMacros('Dal', 250, 14, 40, 4, 3000, 'e3'), cur.entries[0]], water: [], goals: { ...DEFAULT_GOALS, kcal: 9 } })))
    const m = mergeData(cur, inc)
    expect(m.entries.map(e => e.id)).toEqual(['e1', 'e2', 'e3']); expect(m.water).toHaveLength(1); expect(m.goals.kcal).toBe(2800)
    const r = replaceData(inc)
    expect(r.entries.map(e => e.id)).toEqual(['e3', 'e1']); expect(r.goals.kcal).toBe(9)
  })
})
