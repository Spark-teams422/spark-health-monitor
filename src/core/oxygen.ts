// Crew oxygen chart rule (Chart Blueprint, section 3): "person or environment?". Windows in thresholds.json -> crewOxygen.
import { thresholds } from './statusEngine'
import type { Level, Measurement } from './types'

const MIN = 60_000

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

export interface OxygenState {
  level: Level
  text: string
  /** crew whose oxygen fell in the window (drawn thicker) */
  droppers: string[]
  note: string | null
}

/**
 * Every minute, over the last 10 minutes: a person "drops" when the 24 h median minus the window minimum is
 * 3 points or more, or the value is 94 % or lower. 0 → normal, 1 → single person (check the sensor first),
 * 2 or more → check the environment; red when the cabin O₂ or CO₂ is also caution or critical.
 */
export function oxygenState(spo2: { crewId: string; ms: Measurement[] }[], now: number, cabinOff: boolean): OxygenState {
  const c = thresholds.crewOxygen
  const droppers = spo2
    .filter(({ ms }) => {
      const win = ms.filter((m) => m.time > now - c.windowMin * MIN).map((m) => m.value)
      const day = ms.filter((m) => m.time > now - c.medianHours * 60 * MIN).map((m) => m.value)
      if (!win.length || !day.length) return false
      const low = Math.min(...win)
      return median(day) - low >= c.dropPoints || low <= c.lowValue
    })
    .map((x) => x.crewId)
  const note = spo2.length <= 2 ? 'Few crew: cannot tell for sure' : null
  if (droppers.length === 0) return { level: 'green', text: 'Normal', droppers, note }
  if (droppers.length === 1) return { level: 'yellow', text: `Drop in one person: ${droppers[0]} · check the sensor first`, droppers, note }
  return { level: cabinOff ? 'red' : 'yellow', text: 'Drop in more than one person: check the environment', droppers, note }
}

/** Trailing mean over `minutes` at every reading (cabin CO₂ is charted as a 1-hour average). */
export function rollingMean(ms: Measurement[], minutes: number): Measurement[] {
  let from = 0, sum = 0
  return ms.map((m, i) => {
    sum += m.value
    while (ms[from].time <= m.time - minutes * MIN) sum -= ms[from++].value
    return { ...m, value: sum / (i - from + 1) }
  })
}
