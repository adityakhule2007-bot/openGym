// Offline cache for Open Food Facts. Two kinds of record in IndexedDB store 'cache':
//   'q:<query>'  a search result list, fresh for 24 h, kept (as a fallback when offline) for 30 days, at most 40 queries
//   'b:<code>'   one scanned product, kept for 180 days; "not found" answers are kept for only 1 day because
//                someone may add the product to Open Food Facts later
// The storage is passed in (`kv`), so the rules are testable without a browser. Default: the app's IndexedDB.
// Nothing here makes a network request; off.js decides when to ask the network.
import { idb } from './idb.js'

const H = 3600e3, D = 24 * H
export const TTL = { searchFresh: 24 * H, searchKeep: 30 * D, product: 180 * D, miss: D }
export const MAX_SEARCHES = 40

const defaultKv = { get: k => idb.get('cache', k), put: (k, v) => idb.put('cache', k, v), del: k => idb.del('cache', k), keys: () => idb.keys('cache'), clear: () => idb.clear('cache') }

export const normQuery = q => String(q || '').trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 80)
const trim = f => { const { hay, ...rest } = f; return { ...rest, v: (rest.v || []).map(x => Math.round((x || 0) * 1000) / 1000) } }
const withHay = f => ({ ...f, hay: ((f.n || '') + ' ' + (f.brand || '')).trim().toLowerCase() })

// Which search keys to evict: expired ones, then the oldest beyond `max`. rows: [[key, savedAt], ...]
export function evictions(rows, now, max = MAX_SEARCHES) {
  const live = rows.filter(([, t]) => now - t <= TTL.searchKeep)
  const drop = rows.filter(([, t]) => now - t > TTL.searchKeep).map(([k]) => k)
  live.sort((a, b) => b[1] - a[1])
  return drop.concat(live.slice(max).map(([k]) => k))
}

export async function getSearch(q, now = Date.now(), kv = defaultKv) {
  try {
    const r = await kv.get('q:' + normQuery(q))
    if (!r || !Array.isArray(r.items) || now - r.t > TTL.searchKeep) return null
    return { items: r.items.map(withHay), t: r.t, fresh: now - r.t <= TTL.searchFresh }
  } catch { return null }
}
export async function putSearch(q, items, now = Date.now(), kv = defaultKv) {
  try {
    await kv.put('q:' + normQuery(q), { t: now, items: items.map(trim) })
    const rows = []
    for (const k of await kv.keys()) if (String(k).startsWith('q:')) { const r = await kv.get(k); rows.push([k, r?.t || 0]) }
    for (const k of evictions(rows, now)) await kv.del(k)
  } catch { /* the cache is a convenience, never a failure */ }
}

export async function getProduct(code, now = Date.now(), kv = defaultKv) {
  try {
    const r = await kv.get('b:' + code)
    if (!r) return null
    if (now - r.t > (r.found ? TTL.product : TTL.miss)) return null
    return { found: !!r.found, food: r.found && r.food ? withHay(r.food) : null, t: r.t }
  } catch { return null }
}
export async function putProduct(code, food, now = Date.now(), kv = defaultKv) {
  try { await kv.put('b:' + code, { t: now, found: !!food, food: food ? trim(food) : null }) } catch { /* ignore */ }
}

export async function cacheStats(kv = defaultKv) {
  try {
    const keys = (await kv.keys()).map(String)
    return { searches: keys.filter(k => k.startsWith('q:')).length, products: keys.filter(k => k.startsWith('b:')).length }
  } catch { return { searches: 0, products: 0 } }
}
export async function clearCache(kv = defaultKv) { try { await kv.clear() } catch { /* ignore */ } }
