// Open Food Facts client (https://world.openfoodfacts.org, ODbL; credit "Open Food Facts contributors").
// Opt-in only: a request is made when the user taps Search or scans a barcode, nothing in the background.
import { nativeFetch } from '../capacitor-fetch.js'
import { foodFromOFF } from './engine.js'

const HOST = 'https://world.openfoodfacts.org'
const FIELDS = 'code,product_name,brands,serving_size,serving_quantity,nutriments'
const HEADERS = { 'User-Agent': 'openGym-Nutrition/1.0 (personal use; github.com/DuarteSantos8/openGym)', Accept: 'application/json' }

async function getJson(url) {
  const res = await nativeFetch(url, { headers: HEADERS })
  if (!res.ok) throw new Error('http ' + res.status)
  return JSON.parse(await res.text())
}
export async function searchOFF(q, limit = 24) {
  const d = await getJson(`${HOST}/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=${limit}&fields=${FIELDS}`)
  return (d.products || []).map(foodFromOFF).filter(Boolean)
}
export async function barcodeOFF(code) {
  const c = String(code).replace(/\D/g, '')
  if (c.length < 8) throw new Error('bad barcode')
  const d = await getJson(`${HOST}/api/v2/product/${c}.json?fields=${FIELDS}`)
  return d.status === 1 ? foodFromOFF(d.product) : null
}
