// Meal photos. Stored as small JPEG Blobs in the app's own IndexedDB on the phone: never uploaded, never in the diet backup
// (they would make it huge), deleted with the app. The picture is redrawn through a canvas, which also drops the EXIF block
// (so GPS location and camera details do not stay in the stored copy).
import { idb } from './idb.js'
import { dayKey, mealLabel } from './engine.js'

export const MAX_SIDE = 1280
export const QUALITY = 0.82

// Largest size that fits in a max x max box, keeping the shape; never enlarges.
export function fitSize(w, h, max = MAX_SIDE) {
  if (!(w > 0) || !(h > 0)) return { w: 0, h: 0 }
  const k = Math.min(1, max / Math.max(w, h))
  return { w: Math.max(1, Math.round(w * k)), h: Math.max(1, Math.round(h * k)) }
}

async function decode(file) {
  if (typeof createImageBitmap === 'function') {
    try { return await createImageBitmap(file, { imageOrientation: 'from-image' }) } catch { /* try the <img> route */ }
  }
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.decoding = 'async'
    img.src = url
    await img.decode()
    return img
  } finally { URL.revokeObjectURL(url) }
}

export async function shrink(file, max = MAX_SIDE, quality = QUALITY) {
  const img = await decode(file)
  const w0 = img.naturalWidth || img.width, h0 = img.naturalHeight || img.height
  const { w, h } = fitSize(w0, h0, max)
  const canvas = document.createElement('canvas')
  canvas.width = w; canvas.height = h
  canvas.getContext('2d').drawImage(img, 0, 0, w, h)
  if (typeof img.close === 'function') img.close()
  const blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', quality))
  if (!blob) throw new Error('encode-failed')
  return blob
}

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
export async function savePhoto(file) {
  const blob = await shrink(file)
  const id = uid()
  await idb.put('photos', id, blob)
  return id
}
const urls = new Map()
export async function photoUrl(id) {
  if (urls.has(id)) return urls.get(id)
  const blob = await idb.get('photos', id)
  if (!blob) return null
  const u = URL.createObjectURL(blob)
  urls.set(id, u)
  return u
}
export async function dropPhoto(id) {
  const u = urls.get(id)
  if (u) { URL.revokeObjectURL(u); urls.delete(id) }
  try { await idb.del('photos', id) } catch { /* ignore */ }
}

// Photos whose meal no longer exists (every entry of that meal was deleted): ids to drop.
export function orphanShots(shots, entries) {
  const meals = new Set(entries.map(e => dayKey(e.at) + '|' + mealLabel(e.at)))
  return shots.filter(s => !meals.has(dayKey(s.at) + '|' + mealLabel(s.at)))
}
