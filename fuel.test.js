import { describe, it, expect } from 'vitest'
import { fuelFromFatigue } from './fuel.js'
import { dailySeries, averageOf } from './trends.js'
import { entryFromMacros, atOf } from './engine.js'

describe('fuelFromFatigue', () => {
  it('is low and asks for nothing when rested', () => {
    const f = fuelFromFatigue({ quadriceps: 0.1, chest: 0.05 })
    expect(f.level).toBe('low'); expect(f.carbsAdd).toBe(0)
  })
  it('adds carbs for a fatigued lower body, more when heavier and larger', () => {
    const a = fuelFromFatigue({ quadriceps: 0.8, gluteal: 0.75, hamstring: 0.7, chest: 0.1 }, 75)
    expect(a.level).toBe('high'); expect(a.region).toBe('Lower body')
    expect(a.carbsAdd).toBeGreaterThanOrEqual(50); expect(a.carbsAdd).toBeLessThanOrEqual(80)
    expect(fuelFromFatigue({ quadriceps: 0.8, gluteal: 0.75, hamstring: 0.7 }, 100).carbsAdd).toBeGreaterThanOrEqual(a.carbsAdd)
    expect(a.top[0].slug).toBe('quadriceps')
  })
  it('weights upper body a little less', () => {
    const f = fuelFromFatigue({ chest: 0.6, 'upper-back': 0.6, deltoids: 0.6 })
    expect(f.region).toBe('Upper body'); expect(f.level).toBe('moderate')
  })
})

describe('dailySeries', () => {
  it('buckets entries and water into the last n days', () => {
    const at = (iso, t) => atOf(iso, t)
    const entries = [entryFromMacros('a', 500, 30, 50, 10, at('2026-10-30', '09:00'), '1'), entryFromMacros('b', 300, 10, 40, 5, at('2026-10-30', '19:00'), '2'), entryFromMacros('c', 700, 40, 80, 20, at('2026-10-31', '13:00'), '3')]
    const days = dailySeries(entries, [{ at: at('2026-10-31', '10:00'), ml: 500 }], '2026-10-31', 7)
    expect(days).toHaveLength(7)
    expect(days[5].k).toBe(800); expect(days[6].k).toBe(700); expect(days[6].water).toBe(500)
    expect(averageOf(days, 'k')).toBe(750)
    expect(days[0].logged).toBe(false)
  })
})
