import { describe, it, expect } from 'vitest'
import { daysUntil, addDaysIso, validIso, phaseOf, carbTarget, meetTargets, meetPlan, meetDaySchedule, tipsFor } from './meet.js'

const goals = { kcal: 2400, p: 150, c: 280, f: 70, water: 3000 }

describe('meet dates', () => {
  it('counts whole days, across month ends and daylight-saving changes', () => {
    expect(daysUntil('2026-11-30', '2026-11-02')).toBe(28)
    expect(daysUntil('2026-12-03', '2026-11-27')).toBe(6)
    expect(daysUntil('2026-11-02', '2026-11-02')).toBe(0)
    expect(daysUntil('2026-11-01', '2026-11-02')).toBe(-1)
    expect(daysUntil('2026-03-30', '2026-03-28')).toBe(2)
  })
  it('adds days and validates dates', () => {
    expect(addDaysIso('2026-11-28', 5)).toBe('2026-12-03')
    expect(addDaysIso('2026-03-01', -1)).toBe('2026-02-28')
    expect(validIso('2026-02-30')).toBe(false)
    expect(validIso('2026-12-03')).toBe(true)
    expect(validIso('soon')).toBe(false)
  })
  it('maps days to phases', () => {
    expect([12, 7, 4, 3, 2, 1, 0, -1].map(phaseOf)).toEqual(['build', 'practice', 'practice', 'topup', 'topup', 'eve', 'meet', 'after'])
  })
})

describe('meet targets', () => {
  it('leaves everything alone outside the last 3 days when protein is already fine', () => {
    const t = meetTargets({ days: 10, bodyKg: 59, goals })
    expect(t).toMatchObject({ kcal: 2400, p: 150, c: 280, f: 70, changed: false, fibreMax: null })
  })
  it('gentle top-up: +5% three days out, +10% from two days out, fat trimmed the day before', () => {
    expect(carbTarget({ days: 3, kg: 59, baseC: 280, level: 'gentle' })).toBe(295)
    expect(carbTarget({ days: 2, kg: 59, baseC: 280, level: 'gentle' })).toBe(310)
    const eve = meetTargets({ days: 1, bodyKg: 59, goals, level: 'gentle' })
    expect(eve.c).toBe(310); expect(eve.f).toBe(65); expect(eve.fibreMax).toBe(25)
  })
  it('standard top-up reaches about 6 to 6.5 g/kg and never passes 7 g/kg', () => {
    expect(carbTarget({ days: 3, kg: 80, baseC: 300, level: 'standard' })).toBe(480)
    expect(carbTarget({ days: 2, kg: 80, baseC: 300, level: 'standard' })).toBe(520)
    expect(carbTarget({ days: 2, kg: 60, baseC: 500, level: 'standard' })).toBe(500)   // never below the usual goal
    expect(carbTarget({ days: 1, kg: 60, baseC: 300, level: 'standard' })).toBeLessThanOrEqual(7 * 60)
  })
  it('off changes no carbs at any distance', () => {
    for (const d of [0, 1, 2, 3, 6]) expect(carbTarget({ days: d, kg: 70, baseC: 280, level: 'off' })).toBe(280)
  })
  it('raises protein only when the goal is below 1.6 g/kg, and never lowers it', () => {
    expect(meetTargets({ days: 5, bodyKg: 100, goals }).p).toBe(160)
    expect(meetTargets({ days: 5, bodyKg: 59, goals: { ...goals, p: 190 } }).p).toBe(190)
  })
  it('keeps calories consistent with the macro changes', () => {
    const t = meetTargets({ days: 1, bodyKg: 59, goals, level: 'gentle' })
    expect(t.kcal).toBe(2400 + 4 * (t.c - 280) + 9 * (t.f - 70))
  })
  it('never touches the water target', () => {
    for (const d of [0, 1, 2, 3, 9]) expect(meetTargets({ days: d, bodyKg: 70, goals }).water).toBe(3000)
  })
  it('falls back to 75 kg when body weight is unknown', () => {
    expect(meetTargets({ days: 2, bodyKg: 0, goals, level: 'standard' }).c).toBe(490)   // 6.5 g/kg x 75 kg = 487.5, to the nearest 5
  })
})

describe('meet-day schedule', () => {
  it('counts back from the first lift and scales to body weight', () => {
    const s = meetDaySchedule({ firstLift: '09:00', bodyKg: 60 })
    expect(s.map(x => x.at).slice(0, 4)).toEqual(['05:00', '07:30', '08:10', '08:40'])
    expect(s[0].text).toMatch(/90 g carbs/)
    expect(s[2].text).toMatch(/180 mg/)
  })
  it('wraps past midnight for a very early start', () => {
    expect(meetDaySchedule({ firstLift: '03:00', bodyKg: 70 })[0].at).toBe('23:00')
  })
})

describe('plan and tips', () => {
  it('describes every phase and warns against manipulation', () => {
    for (const d of [10, 6, 3, 2, 1, 0, -1]) {
      const p = meetPlan({ days: d, bodyKg: 59, goals })
      expect(p.tips.length).toBeGreaterThan(0); expect(p.headline.length).toBeGreaterThan(3)
    }
    expect(tipsFor({ days: 2, bodyKg: 59, goals }).join(' ')).toMatch(/no water loading/)
    expect(meetPlan({ days: 1, bodyKg: 59, goals }).schedule.length).toBeGreaterThan(0)
    expect(meetPlan({ days: 8, bodyKg: 59, goals }).schedule).toEqual([])
  })
})
