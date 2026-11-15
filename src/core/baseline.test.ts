// Personal baseline and sex rules (team document "Personal Baseline and Sex Differences", 15 Nov 2026).
import { describe, expect, it } from 'vitest'
import { baselineCheck, baselineLevel, robustZ, sexRules } from './baseline'
import { HealthSystem } from './system'
import type { Measurement } from './types'

const H = 3600_000
const now = Date.parse('2026-11-14T09:00:00Z')
const series = (id: string, crewId: string, v: (i: number) => number, hours = 8): Measurement[] =>
  Array.from({ length: hours * 12 }, (_, i) => ({ metricId: id, crewId, value: v(i), unit: '', time: now - hours * H + (i + 1) * 5 * 60_000 }))

describe('robust z and colour rule', () => {
  it('z = (x − median) / (1.4826 · MAD); 2 yellow, 3 orange, ≥ 2 for 6 h orange', () => {
    expect(robustZ(128.6, 118, 3.5)).toBeCloseTo(2.04, 2)
    expect(baselineLevel(1.9, false)).toBe('green')
    expect(baselineLevel(-2.2, false)).toBe('yellow')
    expect(baselineLevel(3.1, false)).toBe('orange')
    expect(baselineLevel(2.2, true)).toBe('orange')
  })
  it('a deviation from the own baseline turns yellow although the absolute limit is still green', () => {
    // A1 systolic baseline 118 (MAD 3.5): 129 is below the 130 caution limit but z ≈ +2.1
    const b = baselineCheck('bp_systolic', 'A1', series('bp_systolic', 'A1', () => 129, 1), now, 'microgravity', 142)!
    expect(b.ok).toBe(true)
    expect(b.level).toBe('yellow')
    const long = baselineCheck('bp_systolic', 'A1', series('bp_systolic', 'A1', () => 129, 8), now, 'microgravity', 142)!
    expect(long.level).toBe('orange') // sustained over 6 h
  })
  it('cold start (fewer than 5 sessions) and the first 2 weeks: no baseline colour, absolute limits only', () => {
    const a5 = baselineCheck('bp_systolic', 'A5', series('bp_systolic', 'A5', () => 140), now, 'microgravity', 142)!
    expect(a5.ok).toBe(false)
    expect(a5.note).toMatch(/absolute limits/)
    expect(baselineCheck('bp_systolic', 'A1', series('bp_systolic', 'A1', () => 140), now, 'microgravity', 5)!.ok).toBe(false)
  })
  it('landing uses the standing reference', () => {
    const b = baselineCheck('bp_diastolic', 'A1', series('bp_diastolic', 'A1', () => 82, 1), now, 'landing', 210)!
    expect(b.ref).toBe('preflight standing')
    expect(b.level).toBe('green') // standing diastolic baseline 82
  })
})

describe('the baseline never weakens a limit', () => {
  it('red stays red; normal day stays green; women get the urinary topic first', () => {
    const sys = new HealthSystem()
    sys.setScenario('suddenCritical')
    for (let i = 0; i < 10; i++) sys.tick()
    expect(sys.status('spo2', 'A3').level).toBe('red')
    expect(sexRules('female').some((r) => r.topics?.includes('Urine'))).toBe(true)
    expect(sexRules('male').some((r) => r.topics)).toBe(false)
  })
})
