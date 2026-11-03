import { describe, it, expect } from 'vitest'
import { analyseNeuroFuel, caffeineRemainingMg } from './neurofuel.js'
import { atOf, entryFromMacros, DEFAULT_GOALS } from './engine.js'

const day = '2026-11-03'
const config = { sessionTime:'16:30', bedtime:'23:00', caffeineCutoffHours:8, caffeineHalfLife:5, caffeineLimit:400 }

describe('NeuroFuel offline analysis', () => {
  it('estimates caffeine decay using the selected half-life', () => {
    const now = atOf(day,'14:00')
    expect(caffeineRemainingMg([{ at:now-5*3600000, mg:200 }], now, 5)).toBeCloseTo(100)
  })
  it('uses food diary and planned workout context to create explainable insights', () => {
    const now = atOf(day,'14:00')
    const entries = [entryFromMacros('Rice',500,10,100,2,atOf(day,'10:00'),'e1')]
    const result = analyseNeuroFuel({ entries, caffeine:[], workouts:[], goals:DEFAULT_GOALS, config, S:{workouts:[]}, plannedToday:true, now })
    expect(result.loggedDays).toBe(1)
    expect(result.pLeft).toBe(140)
    expect(result.recs.some(x=>x.id==='session')).toBe(true)
    expect(result.recs.some(x=>x.id==='preworkout-carb')).toBe(true)
  })
  it('flags a caffeine timing conflict after the configured bedtime cutoff', () => {
    const now = atOf(day,'16:00')
    const result = analyseNeuroFuel({ entries:[], caffeine:[], workouts:[], goals:DEFAULT_GOALS, config, S:{workouts:[]}, now })
    expect(result.nextCaffeine.status).toBe('cutoff')
  })
})
