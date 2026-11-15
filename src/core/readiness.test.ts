// Chart Blueprint section 5.5 worked example and section 6 acceptance checks.
import { describe, expect, it } from 'vitest'
import { oxygenState } from './oxygen'
import { co2Score, readiness, sleepGate, sleepScore, zScore } from './readiness'
import { HealthSystem } from './system'
import type { Measurement } from './types'

describe('readiness score', () => {
  it('worked example A2 → 73 · Ready, breakdown sleep −19 · HRV −7 · CO₂ −1 · test 0', () => {
    const parts = { sleep: sleepScore([7, 6.5, 6, 7, 6.5, 6, 6.5]), hrv: zScore(-1.2), cognition: zScore(-0.3), co2: co2Score(2.9) }
    expect(parts.sleep).toBeCloseTo(53.5)
    expect(parts.hrv).toBeCloseTo(72)
    expect(parts.co2).toBeCloseTo(85.7, 1)
    const r = readiness(parts)
    expect(Math.round(r.score!)).toBe(73)
    expect(r.label).toBe('Ready')
    expect(r.losses.map((l) => Math.round(l.loss!))).toEqual([-19, -7, 0, -1])
    expect(r.worst).toBe('sleep')
    // contributions always explain the score
    expect(100 + r.losses.reduce((s, l) => s + l.loss!, 0)).toBeCloseTo(r.score!)
  })

  it('red gate: a short night before the EVA makes the card "Not ready" whatever the score', () => {
    expect(sleepGate([7.5, 7, 4.5], true)).toBe(true)
    expect(sleepGate([7.5, 7, 4.5], false)).toBe(false)
    expect(readiness({ sleep: 80, hrv: 100, cognition: 100, co2: 100 }, ['sleep'])).toMatchObject({ level: 'red', label: 'Not ready – red gate: sleep' })
  })

  it('missing data: no score without sleep or with two parts missing', () => {
    expect(readiness({ sleep: 90, co2: 100 }).score).toBeNull()
    expect(readiness({ hrv: 90, cognition: 100, co2: 100 }).label).toContain('missing: sleep')
    expect(readiness({ sleep: 90, hrv: 100, co2: 100 }).score).not.toBeNull()
  })

  it('sample data: A2 shows the sleep loss, A3 the red gate before the EVA, no part missing (synthetic gap fill)', () => {
    const sys = new HealthSystem(undefined)
    expect(sys.readiness('A2').worst).toBe('sleep')
    expect(sys.readiness('A3').gate).toBe('sleep')
    for (const id of ['A1', 'A2', 'A3', 'A4', 'A5']) for (let d = 0; d < 14; d++) expect(sys.readiness(id, sys.now - d * 24 * 3600_000).score, `${id} day -${d}`).not.toBeNull()
  })
})

describe('crew oxygen rule', () => {
  const now = 24 * 3600_000
  const series = (id: string, last: number) => ({ crewId: id, ms: Array.from({ length: 60 }, (_, i): Measurement => ({ metricId: 'spo2', crewId: id, value: i > 55 ? last : 97, unit: '%', time: now - (59 - i) * 60_000 })) })
  it('0 / 1 / several droppers', () => {
    expect(oxygenState([series('A1', 97), series('A2', 97), series('A3', 97)], now, false).text).toBe('Normal')
    expect(oxygenState([series('A1', 97), series('A2', 92), series('A3', 97)], now, false)).toMatchObject({ level: 'yellow', droppers: ['A2'] })
    expect(oxygenState([series('A1', 93), series('A2', 93), series('A3', 97)], now, true)).toMatchObject({ level: 'red', droppers: ['A1', 'A2'] })
  })
})

describe('radiation ledger', () => {
  it('career = earlier missions + this mission; the worst ratio is shown; levels follow 0.5 / 0.8 / 1.0', () => {
    const sys = new HealthSystem(undefined)
    const a1 = sys.radiation('A1')
    const career = a1.ratios.find((r) => r.key === 'career')!
    expect(career.dose).toBeCloseTo(118 + a1.missionDose)
    expect(a1.worst.ratio).toBe(Math.max(...a1.ratios.filter((r) => r.key !== 'rate' && r.ratio !== null).map((r) => r.ratio!)))
    expect(a1.level).toBe('green')
  })
})

describe('musculoskeletal record', () => {
  it('bone: the document example (U0 150, U 300 mg/day) gives R_Ca 1, −250 mg/day and about 0.7 %/month', async () => {
    const { boneState } = await import('./musculo')
    const m = (v: number, d: number): Measurement => ({ metricId: 'bone_urine_ca', crewId: 'A1', value: v, unit: 'mg/day', time: d * 86400000 })
    const b = boneState([m(300, 30)], [], 150, 40)
    expect(b.rCa).toBe(1)
    expect(b.dCaMgDay).toBe(-250)
    expect(b.lossPctMonth).toBeCloseTo(0.68, 2)
    expect(b.level).toBe('yellow')
  })
  it('muscle: 191 → 188 Nm gives about 1.6 % loss and R 0.08; low compliance turns it red', async () => {
    const { muscleState } = await import('./musculo')
    const m = (v: number, d: number): Measurement => ({ metricId: 'x', crewId: 'A1', value: v, unit: '', time: d * 86400000 })
    const s = muscleState([m(188, 10)], 191, [m(500, 9)], 1000, 10 * 86400000)
    expect(s.lossPct).toBeCloseTo(1.57, 1)
    expect(s.risk).toBeCloseTo(0.08, 2)
    expect(s.level).toBe('red') // compliance 0.5 < 0.6
  })
  it('sample crew: A4 skips ARED (compliance below the caution band), everyone has a bone record', () => {
    const sys = new HealthSystem(undefined)
    expect(sys.muscle('A4').compliance!).toBeLessThan(0.85)
    for (const id of ['A1', 'A2', 'A3', 'A4', 'A5']) expect(sys.bone(id).rCa).not.toBeNull()
  })
})
