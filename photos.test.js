import { describe, it, expect } from 'vitest'
import { fitSize, orphanShots } from './photos.js'
import { entryFromMacros, atOf } from './engine.js'

describe('photo size', () => {
  it('shrinks the long side to the limit and keeps the shape', () => {
    expect(fitSize(4000, 3000)).toEqual({ w: 1280, h: 960 })
    expect(fitSize(3000, 4000)).toEqual({ w: 960, h: 1280 })
  })
  it('never enlarges and survives bad input', () => {
    expect(fitSize(800, 600)).toEqual({ w: 800, h: 600 })
    expect(fitSize(0, 10)).toEqual({ w: 0, h: 0 })
    expect(fitSize(10000, 1)).toEqual({ w: 1280, h: 1 })
  })
})

describe('orphaned photos', () => {
  it('flags photos whose meal has no entries left', () => {
    const entries = [entryFromMacros('Eggs', 200, 18, 1, 14, atOf('2026-11-02', '08:00'), 'e1')]
    const shots = [{ id: 's1', at: atOf('2026-11-02', '08:30') }, { id: 's2', at: atOf('2026-11-02', '13:00') }, { id: 's3', at: atOf('2026-11-01', '08:00') }]
    expect(orphanShots(shots, entries).map(s => s.id)).toEqual(['s2', 's3'])
  })
})
