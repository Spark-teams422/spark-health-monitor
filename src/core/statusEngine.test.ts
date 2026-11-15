import { describe, expect, it } from 'vitest'
import { evaluate, instantLevel, thresholdBands, thresholds, worst } from './statusEngine'
import type { Measurement } from './types'

const MIN = 60_000
/** readings `stepMin` apart, oldest first */
const series = (metricId: string, values: number[], stepMin = 1): Measurement[] =>
  values.map((value, i) => ({ metricId, crewId: 'A1', value, unit: '', time: 1_000_000_000 + i * stepMin * MIN }))

describe('caution (yellow): one bad reading is not an alarm', () => {
  it('normal readings are green', () => {
    expect(evaluate('spo2', series('spo2', [97, 98, 97])).level).toBe('green')
  })
  it('a single out-of-range reading stays green but is flagged', () => {
    const s = evaluate('spo2', series('spo2', [97, 97, 97, 97, 93.5]))
    expect(s.level).toBe('green')
    expect(s.singleDeviation).toBe(true)
  })
  it('3 consecutive out-of-range readings turn yellow', () => {
    expect(evaluate('spo2', series('spo2', [97, 94, 94, 93.5])).level).toBe('yellow')
  })
  it('24 h average out of range turns yellow even if the latest reading is normal', () => {
    const s = evaluate('bp_systolic', series('bp_systolic', [136, 128, 137, 127, 138, 128], 60))
    expect(s.level).toBe('yellow')
    expect(s.reason).toContain('24-h average')
  })
  it('sudden 3-point SpO₂ drop is yellow at once', () => {
    expect(evaluate('spo2', series('spo2', [98, 98, 95])).level).toBe('yellow')
  })
  it('no data', () => {
    expect(evaluate('spo2', []).level).toBe('nodata')
  })
})

describe('critical (red): verify with a second reading', () => {
  it('first red reading is red but unconfirmed, with a 5-minute deadline', () => {
    const ms = series('spo2', [97, 97, 90])
    const s = evaluate('spo2', ms)
    expect(s.level).toBe('red')
    expect(s.confirmed).toBe(false)
    expect(s.confirmBy).toBe(ms[2].time + thresholds.general.confirmWindowMin * MIN)
  })
  it('second red reading confirms', () => {
    const s = evaluate('spo2', series('spo2', [97, 90, 89]))
    expect(s).toMatchObject({ level: 'red', confirmed: true })
  })
  it('a symptom skips verification', () => {
    const s = evaluate('spo2', series('spo2', [97, 97, 90]), { symptomatic: true })
    expect(s).toMatchObject({ level: 'red', confirmed: true })
  })
  it('red reading followed by a normal one is dismissed', () => {
    expect(evaluate('spo2', series('spo2', [97, 97, 90, 97])).level).toBe('green')
  })
  it('SpO₂ ≤85 is flagged as emergency', () => {
    expect(evaluate('spo2', series('spo2', [86, 84])).emergency).toBe(true)
  })
})

describe('main panel limits from the checklist', () => {
  it('blood pressure, both directions', () => {
    expect(instantLevel('bp_systolic', 129)).toBe('green')
    expect(instantLevel('bp_systolic', 130)).toBe('yellow')
    expect(instantLevel('bp_systolic', 180)).toBe('yellow')
    expect(instantLevel('bp_systolic', 181)).toBe('red')
    expect(instantLevel('bp_systolic', 100)).toBe('yellow')
    expect(instantLevel('bp_systolic', 90)).toBe('red')
    expect(instantLevel('bp_diastolic', 80)).toBe('yellow')
    expect(instantLevel('bp_diastolic', 121)).toBe('red')
  })
  it('body temperature, resting vs any time', () => {
    expect(instantLevel('body_temp', 38.4)).toBe('green')
    expect(instantLevel('body_temp', 38.5)).toBe('yellow')
    expect(instantLevel('body_temp', 39.1)).toBe('red')
    expect(instantLevel('body_temp', 39.5, { exercising: true })).toBe('green')
    expect(instantLevel('body_temp', 40.0, { exercising: true })).toBe('red')
    expect(instantLevel('body_temp', 36.0)).toBe('yellow')
    expect(instantLevel('body_temp', 35.0)).toBe('red')
  })
  it('HRV: 7-day average vs personal baseline', () => {
    const baseline = { mean: 42, sd: 5 }
    const ok = evaluate('hrv', series('hrv', [41, 43, 40, 42, 41, 43, 42], 1440), { baseline })
    expect(ok.level).toBe('green')
    const low = evaluate('hrv', series('hrv', [40, 39, 38, 36, 35, 34, 33], 1440), { baseline })
    expect(low.level).toBe('yellow')
  })
  it('HRV absolute low is red', () => {
    expect(evaluate('hrv', series('hrv', [14, 13], 1440)).level).toBe('red')
  })
  it('radiation: environment-specific limit and solar event flag', () => {
    expect(instantLevel('radiation_rate', 1.0, { env: 'deepSpace' })).toBe('green')
    expect(instantLevel('radiation_rate', 1.0, { env: 'surface' })).toBe('yellow')
    const s = evaluate('radiation_rate', series('radiation_rate', [0.5]), { env: 'deepSpace', flags: { sepStarted: true } })
    expect(s).toMatchObject({ level: 'red', confirmed: true })
    expect(instantLevel('radiation_cumulative', 480)).toBe('yellow')
    expect(instantLevel('radiation_cumulative', 600)).toBe('red')
  })
  it('cabin CO₂ uses the 1-hour average', () => {
    const rising = (v: number) => series('cabin_co2', Array(60).fill(v))
    expect(evaluate('cabin_co2', rising(2.3)).level).toBe('green')
    expect(evaluate('cabin_co2', rising(2.6)).level).toBe('yellow')
    expect(evaluate('cabin_co2', rising(3.1))).toMatchObject({ level: 'red', confirmed: true })
    // one spike does not move the hourly average over the limit
    expect(evaluate('cabin_co2', series('cabin_co2', [...Array(59).fill(2.1), 3.5])).level).toBe('green')
  })
})

describe('EVA limits', () => {
  it('margin: yellow <60, red ≤30, immediate', () => {
    expect(evaluate('eva_margin', series('eva_margin', [61])).level).toBe('green')
    expect(evaluate('eva_margin', series('eva_margin', [59])).level).toBe('yellow')
    expect(evaluate('eva_margin', series('eva_margin', [30]))).toMatchObject({ level: 'red', confirmed: true })
  })
  it('suit pressure: caution is silent, critical is immediate', () => {
    expect(evaluate('eva_suit_pressure', series('eva_suit_pressure', [4.3])).level).toBe('green')
    expect(evaluate('eva_suit_pressure', series('eva_suit_pressure', [4.0]))).toMatchObject({ level: 'yellow', silent: true })
    expect(evaluate('eva_suit_pressure', series('eva_suit_pressure', [3.7]))).toMatchObject({ level: 'red', confirmed: true, silent: false })
  })
  it('PICO₂: silent caution only after 15 sustained minutes', () => {
    expect(evaluate('eva_pico2', series('eva_pico2', Array(10).fill(9))).level).toBe('green')
    expect(evaluate('eva_pico2', series('eva_pico2', Array(17).fill(9)))).toMatchObject({ level: 'yellow', silent: true })
    expect(evaluate('eva_pico2', series('eva_pico2', [5, 16])).level).toBe('red')
  })
  it('heart rate vs personal HRmax', () => {
    expect(evaluate('eva_heart_rate', series('eva_heart_rate', [150]), { hrMax: 180 }).level).toBe('yellow')
    expect(evaluate('eva_heart_rate', series('eva_heart_rate', [163]), { hrMax: 180 }).level).toBe('red')
  })
  it('backup O₂ engaged is critical', () => {
    expect(evaluate('eva_o2', series('eva_o2', [400]), { flags: { backupO2Active: true } }).level).toBe('red')
  })
})

describe('chart bands come from the same config', () => {
  it('SpO₂ and blood pressure bands', () => {
    expect(thresholdBands('spo2')).toEqual([
      { level: 'yellow', side: 'below', value: 94 },
      { level: 'red', side: 'below', value: 91 },
    ])
    expect(thresholdBands('bp_systolic')).toContainEqual({ level: 'red', side: 'above', value: 180 })
  })
  it('HRV band follows the personal baseline', () => {
    expect(thresholdBands('hrv', { baseline: { mean: 42, sd: 5 } })).toContainEqual({ level: 'yellow', side: 'below', value: 39.5 })
  })
  it('environment-specific limits are filtered', () => {
    expect(thresholdBands('radiation_rate', { env: 'surface' })).toEqual([{ level: 'yellow', side: 'above', value: 0.8 }])
  })
})

describe('config hygiene', () => {
  it('every metric cites its source document', () => {
    for (const [id, m] of Object.entries(thresholds.metrics)) expect(m.source, id).toBeTruthy()
  })
  it('worst() picks the most severe status', () => {
    const a = evaluate('bp_systolic', series('bp_systolic', [118]))
    const b = evaluate('bp_diastolic', series('bp_diastolic', [82, 83, 84]))
    expect(worst(a, b).level).toBe('yellow')
  })
})
