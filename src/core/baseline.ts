// Personal baseline colour (team document "Personal Baseline and Sex Differences", 15 Nov 2026).
// Robust z against the person's own baseline; adds an early warning only. Red and the absolute limits stay in
// statusEngine. All constants in thresholds.json -> baseline; the preflight values in config/baselines.json (synthetic).
import baselines from '../config/baselines.json'
import { thresholds } from './statusEngine'
import type { Measurement } from './types'

const HOUR = 3600_000
const DAY = 24 * HOUR
const B = () => thresholds.baseline
export type Posture = 'supine' | 'seated' | 'standing'
export type Phase = 'microgravity' | 'landing' | 'surface'
export type BaselineLevel = 'green' | 'yellow' | 'orange'
export const POSTURE_LABEL: Record<Posture, string> = { supine: 'preflight supine', seated: 'preflight seated', standing: 'preflight standing' }

export interface BaselineResult {
  /** false = no robust personal baseline: absolute limits only (cold start, early flight, no reading) */
  ok: boolean
  note: string
  level: BaselineLevel
  z: number | null
  median: number | null
  scale: number | null
  ref: string | null
  sessions: number
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

/** z = (x − median) / max(1.4826 · MAD, σ_floor) */
export const robustZ = (x: number, med: number, mad: number, floor = 0) => (x - med) / Math.max(B().madScale * mad, floor, 1e-9)

/** |z| < 2 green; 2 ≤ |z| < 3 yellow; |z| ≥ 3, or |z| ≥ 2 for longer than 6 h, orange (asks the person to confirm). */
export function baselineLevel(z: number, sustained: boolean): BaselineLevel {
  const a = Math.abs(z)
  if (a >= B().zOrange || (a >= B().zCaution && sustained)) return 'orange'
  return a >= B().zCaution ? 'yellow' : 'green'
}

const none = (note: string, sessions = 0): BaselineResult => ({ ok: false, note, level: 'green', z: null, median: null, scale: null, ref: null, sessions })

/**
 * Baseline check of one vital. Microgravity: the preflight supine value, replaced by the 14-day rolling median of
 * flight readings once 14 days of flight data exist; landing and planet surface: the preflight standing value.
 */
export function baselineCheck(metricId: string, crewId: string, history: Measurement[], now: number, phase: Phase, flightDay: number): BaselineResult | null {
  if (!B().metrics.includes(metricId)) return null
  const person = (baselines.crew as Record<string, { baseline: Record<string, Record<Posture, { median: number; mad: number; sessions: number }>> }>)[crewId]
  const posture = B().reference[phase]
  const pre = person?.baseline[metricId]?.[posture]
  if (!pre || pre.sessions < B().minSessions) return none(`No personal baseline (${pre?.sessions ?? 0} of ${B().minSessions} preflight sessions) – absolute limits in use`, pre?.sessions ?? 0)
  if (phase === 'microgravity' && flightDay <= B().earlyFlightDays) return none('First 2 weeks of flight: wide band, absolute limits in use', pre.sessions)
  const recent = history.filter((m) => m.time > now - B().xWindowMin * 60_000).map((m) => m.value)
  if (!recent.length) return none('No recent reading', pre.sessions)
  // flight baseline: median of daily medians over the last 14 days, when the window is full
  let med = pre.median, ref = POSTURE_LABEL[posture]
  if (phase === 'microgravity') {
    const days = new Map<number, number[]>()
    for (const m of history) if (m.time > now - B().flightWindowDays * DAY && m.time <= now - B().xWindowMin * 60_000) days.set(Math.floor(m.time / DAY), [...(days.get(Math.floor(m.time / DAY)) ?? []), m.value])
    if (days.size >= B().flightWindowDays) { med = median([...days.values()].map(median)); ref = 'flight 14-day median' }
  }
  const floor = B().sigmaFloor[metricId] ?? 0
  const z = robustZ(median(recent), med, pre.mad, floor)
  // sustained: every hourly median of the last 6 h at |z| ≥ 2
  const hours = Array.from({ length: B().sustainedHours }, (_, h) => history.filter((m) => m.time > now - (h + 1) * HOUR && m.time <= now - h * HOUR).map((m) => m.value))
  const sustained = hours.every((v) => v.length > 0 && Math.abs(robustZ(median(v), med, pre.mad, floor)) >= B().zCaution)
  const level = baselineLevel(z, sustained)
  const scale = Math.max(B().madScale * pre.mad, floor)
  const dir = z > 0 ? 'above' : 'below'
  const note = level === 'green' ? `Within own baseline (${ref} ${med})` : `${dir === 'above' ? 'Above' : 'Below'} own baseline: z ${z > 0 ? '+' : ''}${z.toFixed(1)} vs ${ref} ${med}${level === 'orange' ? ' · please confirm' : ''}`
  return { ok: true, note, level, z, median: med, scale, ref, sessions: pre.sessions }
}

/** Sex-specific rules that apply to this person (only the documented ones). */
export function sexRules(sex: string | undefined) {
  return Object.entries(thresholds.sexRules).filter(([, r]) => !r.sex || r.sex === sex).map(([id, r]) => ({ id, ...r }))
}
