// Per-day series for the charts: calories, macros and water for the last n days ending at endDay (YYYY-MM-DD).
import { dayKey, IDX } from './engine.js'

export function dailySeries(entries, water, endDay, n = 7) {
  const [y, m, d] = endDay.split('-').map(Number)
  const days = []
  for (let i = n - 1; i >= 0; i--) { const dt = new Date(y, m - 1, d - i); days.push({ day: dayKey(dt.getTime()), wd: dt.toLocaleDateString(undefined, { weekday: 'short' }), k: 0, p: 0, c: 0, f: 0, water: 0, logged: false }) }
  const at = Object.fromEntries(days.map(x => [x.day, x]))
  for (const e of entries) { const x = at[dayKey(e.at)]; if (!x) continue; x.k += e.v[IDX.k] || 0; x.p += e.v[IDX.p] || 0; x.c += e.v[IDX.c] || 0; x.f += e.v[IDX.f] || 0; x.logged = true }
  for (const w of water) { const x = at[dayKey(w.at)]; if (x) x.water += w.ml }
  return days
}
export const averageOf = (days, key) => { const l = days.filter(x => x.logged); return l.length ? l.reduce((a, x) => a + x[key], 0) / l.length : 0 }
