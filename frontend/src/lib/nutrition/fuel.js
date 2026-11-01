// Turns openGym's per-muscle fatigue (lib/recovery.js fatigueOf, 0..1) into a carb recommendation.
export const LOWER = new Set(['gluteal', 'quadriceps', 'hamstring', 'adductors', 'hip-flexors', 'calves', 'tibialis', 'lower-back'])
// Same bands the Stats fatigue map uses, so the maps agree.
export const FATIGUE_LEVELS = [
  { at: 0, level: 0 }, { at: 0.15, level: 1 }, { at: 0.25, level: 2 }, { at: 0.4, level: 3 }, { at: 0.55, level: 4, exclusive: true },
]
const mean = a => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0)
const top3 = (fatigue, pick) => mean(Object.entries(fatigue).filter(([s]) => pick(s)).map(([, v]) => v || 0).sort((a, b) => b - a).slice(0, 3))

export function fuelFromFatigue(fatigue = {}, bodyKg = 75) {
  const lower = top3(fatigue, s => LOWER.has(s))
  const upper = top3(fatigue, s => !LOWER.has(s))
  const load = Math.max(lower, upper * 0.75)
  const level = load > 0.5 ? 'high' : load > 0.25 ? 'moderate' : 'low'
  const raw = level === 'low' ? 0 : (load - 0.15) * 100 * (bodyKg / 75)
  const carbsAdd = level === 'low' ? 0 : Math.min(80, Math.max(10, Math.round(raw / 5) * 5))
  const top = Object.entries(fatigue).filter(([, v]) => v > 0.25).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([slug, value]) => ({ slug, value }))
  return { level, region: lower >= upper * 0.75 ? 'Lower body' : 'Upper body', lower, upper, carbsAdd, top }
}
