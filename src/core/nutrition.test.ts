// The nutrition document's three worked profiles (A, B, C) must come out of the same formulas.
import { describe, expect, it } from 'vitest'
import { coverage, eer, ironRule, targets, type NutritionProfile } from './nutrition'

const A: NutritionProfile = { sex: 'male', age: 42, kg: 82, heightM: 1.8 }
const B: NutritionProfile = { sex: 'female', age: 38, kg: 62, heightM: 1.68, menstruationSuppressed: false }
const C: NutritionProfile = { sex: 'female', age: 52, kg: 70, heightM: 1.65 }

describe('nutrition targets (document profiles A, B, C)', () => {
  it('energy AF 1.25 / 1.11 and the 6.5 h EVA day', () => {
    expect([A, B, C].map((p) => Math.round(eer(p)))).toEqual([3066, 2341, 2311])
    expect([A, B, C].map((p) => Math.round(eer(p, 1.11)))).toEqual([2747, 2089, 2052])
    expect([A, B, C].map((p) => targets(p, 6.5).energy)).toEqual([4366, 3641, 3611])
  })
  it('protein, carbohydrate, fat, fluid', () => {
    expect([A, B, C].map((p) => targets(p).protein)).toEqual([[98, 148], [74, 112], [84, 126]])
    expect([A, B, C].map((p) => targets(p).carb)).toEqual([[345, 498], [263, 380], [260, 376]])
    expect([A, B, C].map((p) => targets(p).fat)).toEqual([[68, 119], [52, 91], [51, 90]])
    expect([A, B, C].map((p) => targets(p).fluidMl)).toEqual([2624, 2100, 2240])
    expect(targets(B).fluidBase).toBe(true)
  })
  it('iron branches: A ceiling 8, B floor 18, C ceiling 8, unknown asks', () => {
    expect([A, B, C].map((p) => [ironRule(p).kind, ironRule(p).mg])).toEqual([['max', 8], ['min', 18], ['max', 8]])
    expect(ironRule({ ...B, menstruationSuppressed: null }).kind).toBe('ask')
    expect(Math.round(coverage(2600, 3066))).toBe(85)
  })
})
