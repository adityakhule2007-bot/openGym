// Open Food Facts client (https://world.openfoodfacts.org, ODbL; credit "Open Food Facts contributors").
// Opt-in only: a request is made when the user taps Search or scans/looks up a barcode, nothing in the background.
// Answers are kept in an on-phone cache (cache.js): a repeat search within a day makes no request at all, a product that
// was found once is available offline, and when the network fails the last saved answer is shown instead of an error.
import { nativeFetch } from '../capacitor-fetch.js'
import { foodFromOFF, draftFromOFF } from './engine.js'
import { classifyBarcode } from './barcode.js'
import { getSearch, putSearch, getProduct, putProduct } from './cache.js'

const HOST = 'https://world.openfoodfacts.org'
const FIELDS = 'code,product_name,brands,serving_size,serving_quantity,nutriments'
const HEADERS = { 'User-Agent': 'openGym-Nutrition/1.1 (personal use; github.com/DuarteSantos8/openGym)', Accept: 'application/json' }

async function getJson(url) {
  const res = await nativeFetch(url, { headers: HEADERS })
  if (!res.ok) throw new Error('http ' + res.status)
  return JSON.parse(await res.text())
}

// -> { items, from: 'network' | 'cache', t (when it was saved), stale (cache older than a day, used because the network failed) }
export async function searchOFF(q, limit = 24, { refresh = false } = {}) {
  const hit = refresh ? null : await getSearch(q)
  if (hit?.fresh) return { items: hit.items, from: 'cache', t: hit.t, stale: false }
  try {
    const d = await getJson(`${HOST}/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=${limit}&fields=${FIELDS}`)
    const items = (d.products || []).map(foodFromOFF).filter(Boolean)
    putSearch(q, items)
    return { items, from: 'network', t: Date.now(), stale: false }
  } catch (e) {
    const old = hit || await getSearch(q)
    if (old) return { items: old.items, from: 'cache', t: old.t, stale: true }
    throw e
  }
}

// One product by barcode, trying each form of the number (see barcode.js). The saved answer is used first.
// -> { food, found, nutrition, draft, from }: found = the product exists; nutrition = it has usable nutrition data;
// draft = name, brand, serving and barcode to pre-fill a custom food when the product is listed without nutrition (common for supplements).
export async function barcodeOFF(code) {
  const { variants } = classifyBarcode(code)
  if (!variants.length) throw new Error('bad barcode')
  for (const v of variants) {
    const c = await getProduct(v)
    if (c?.found && c.food) return { food: c.food, found: true, nutrition: true, from: 'cache' }
  }
  let found = false, failed = false, draft = null
  for (const v of variants) {
    try {
      const d = await getJson(`${HOST}/api/v2/product/${v}.json?fields=${FIELDS}`)
      if (d.status === 1) {
        found = true
        draft = draft || draftFromOFF(d.product)
        const food = foodFromOFF(d.product)
        if (food) { for (const x of variants) putProduct(x, food); return { food, found: true, nutrition: true, from: 'network' } }
      }
    } catch { failed = true }
  }
  if (found) return { food: null, found: true, nutrition: false, draft: draft && { ...draft, ean: variants[0] }, from: 'network' }
  if (failed) {
    // Offline or blocked: a saved "not found" is no help, so tell the caller to say the network is the problem.
    throw new Error('network')
  }
  for (const x of variants) putProduct(x, null)
  return { food: null, found: false, nutrition: false, draft: null, from: 'network' }
}
