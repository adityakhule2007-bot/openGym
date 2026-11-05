import { describe, it, expect } from 'vitest'
import { getSearch, putSearch, getProduct, putProduct, cacheStats, clearCache, evictions, normQuery, TTL, MAX_SEARCHES } from './cache.js'

const memory = () => {
  const m = new Map()
  return { get: async k => m.get(k), put: async (k, v) => { m.set(k, v) }, del: async k => { m.delete(k) }, keys: async () => [...m.keys()], clear: async () => m.clear() }
}
const food = (n, kcal = 100) => ({ id: 'off' + n, n, u: 'g', b: 100, sv: [], src: 'Open Food Facts', v: [kcal, 1.23456, 2, 3], hay: n.toLowerCase() })
const H = 3600e3, D = 24 * H

describe('search cache', () => {
  it('normalises queries so case and spacing hit the same record', () => {
    expect(normQuery('  Peanut   BUTTER ')).toBe('peanut butter')
  })
  it('returns fresh results for a day, then stale (still usable offline) until 30 days', async () => {
    const kv = memory(), t0 = 1e12
    await putSearch('Peanut Butter', [food('Crunchy PB')], t0, kv)
    const a = await getSearch('peanut butter', t0 + 2 * H, kv)
    expect(a.fresh).toBe(true); expect(a.items[0].n).toBe('Crunchy PB'); expect(a.items[0].hay).toBe('crunchy pb')
    const b = await getSearch('peanut butter', t0 + 3 * D, kv)
    expect(b.fresh).toBe(false); expect(b.items).toHaveLength(1)
    expect(await getSearch('peanut butter', t0 + 31 * D, kv)).toBeNull()
  })
  it('stores a lean copy: no search text field, rounded numbers', async () => {
    const kv = memory()
    await putSearch('x', [food('A')], 1, kv)
    const raw = await kv.get('q:x')
    expect(raw.items[0].hay).toBeUndefined(); expect(raw.items[0].v[1]).toBe(1.235)
  })
  it('keeps only the most recent searches', async () => {
    const kv = memory()
    for (let i = 0; i < MAX_SEARCHES + 5; i++) await putSearch('q' + i, [food('f' + i)], 1000 + i, kv)
    const s = await cacheStats(kv)
    expect(s.searches).toBe(MAX_SEARCHES)
    expect(await getSearch('q0', 2000, kv)).toBeNull(); expect(await getSearch('q' + (MAX_SEARCHES + 4), 2000, kv)).not.toBeNull()
  })
  it('evictions drops expired rows first, then the oldest over the limit', () => {
    const now = 100 * D
    const rows = [['a', now - 40 * D], ['b', now - 1], ['c', now - 5], ['d', now - 9]]
    expect(evictions(rows, now, 2)).toEqual(['a', 'd'])
  })
})

describe('product cache', () => {
  it('remembers a found product for a long time', async () => {
    const kv = memory()
    await putProduct('8901', food('Biscuit'), 0, kv)
    const r = await getProduct('8901', 100 * D, kv)
    expect(r.found).toBe(true); expect(r.food.n).toBe('Biscuit')
    expect(await getProduct('8901', 200 * D, kv)).toBeNull()
  })
  it('remembers "not found" for only a day', async () => {
    const kv = memory()
    await putProduct('1234', null, 0, kv)
    expect((await getProduct('1234', 2 * H, kv)).found).toBe(false)
    expect(await getProduct('1234', 2 * D, kv)).toBeNull()
  })
  it('counts and clears', async () => {
    const kv = memory()
    await putSearch('a', [food('A')], 1, kv); await putProduct('1', food('B'), 1, kv); await putProduct('2', null, 1, kv)
    expect(await cacheStats(kv)).toEqual({ searches: 1, products: 2 })
    await clearCache(kv)
    expect(await cacheStats(kv)).toEqual({ searches: 0, products: 0 })
  })
  it('never throws when storage fails', async () => {
    const bad = { get: async () => { throw new Error('x') }, put: async () => { throw new Error('x') }, del: async () => {}, keys: async () => { throw new Error('x') }, clear: async () => { throw new Error('x') } }
    expect(await getSearch('a', 1, bad)).toBeNull(); expect(await getProduct('1', 1, bad)).toBeNull()
    await putSearch('a', [], 1, bad); await putProduct('1', null, 1, bad); await clearCache(bad)
    expect(await cacheStats(bad)).toEqual({ searches: 0, products: 0 })
  })
  it('exposes its time limits', () => { expect(TTL.searchFresh).toBe(24 * H); expect(TTL.miss).toBe(D) })
})
