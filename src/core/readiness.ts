// Mission readiness score (Chart Blueprint, section 5). Weights, windows and bands live in thresholds.json -> readiness.
// The score helps a decision; it does not make it. Every value here is a proposal until the flight surgeon approves it.
import { thresholds } from './statusEngine'
import type { Level } from './types'

const R = () => thresholds.readiness
const clamp = (x: number) => Math.min(100, Math.max(0, x))

export type Part = 'sleep' | 'hrv' | 'cognition' | 'co2'
export const PART_LABEL: Record<Part, string> = { sleep: 'sleep', hrv: 'HRV', cognition: 'test', co2: 'CO₂' }

/** U = 100 − 10·d₁ − 3·D₇ (d₁ = last night's shortfall, D₇ = sum of the week's shortfalls), clamped to 0–100. */
export function sleepScore(week: number[], need = R().defaultSleepNeedH): number {
  const short = (h: number) => Math.max(0, need - h)
  const d1 = short(week[week.length - 1])
  const d7 = week.reduce((s, h) => s + short(h), 0)
  return clamp(100 - R().sleep.lastNightFactor * d1 - R().sleep.weekFactor * d7)
}

/** HRV and cognitive test: no penalty inside the normal band (z ≥ −0.5), then 40 points per SD. */
export function zScore(z: number): number {
  const m = R().zMap
  return z >= m.freeAbove ? 100 : Math.max(0, 100 - m.slope * (Math.abs(z) - Math.abs(m.freeAbove)))
}

/** Cabin CO₂ (24 h mean, mmHg): no penalty below 2.5, zero at 5.3 (old 7–180 day SMAC). */
export function co2Score(mean: number): number {
  const c = R().co2
  return clamp(100 - (100 * (mean - c.freeBelow)) / (c.zeroAt - c.freeBelow))
}

export interface Readiness {
  score: number | null
  level: Level
  label: string
  /** points each part takes off the score (k_i); null = no data */
  losses: { part: Part; loss: number | null }[]
  /** the part that costs the most points */
  worst: Part | null
  missing: Part[]
  gate: string | null
}

/**
 * S = Σ wᵢPᵢ / Σ wᵢ over the parts with data; kᵢ = wᵢ(Pᵢ − 100) / Σ wᵢ so that S = 100 + Σ kᵢ.
 * Red gate: a part that is red on its own checklist makes the card "Not ready" whatever the score.
 * No score without sleep, or with two or more parts missing.
 */
export function readiness(parts: Partial<Record<Part, number>>, gates: string[] = []): Readiness {
  const all: Part[] = ['sleep', 'hrv', 'cognition', 'co2']
  const have = all.filter((p) => parts[p] !== undefined)
  const missing = all.filter((p) => parts[p] === undefined)
  const w = R().weights
  const sumW = have.reduce((s, p) => s + w[p], 0)
  const losses = all.map((part) => ({ part, loss: parts[part] === undefined ? null : (w[part] * (parts[part]! - 100)) / sumW }))
  const worst = losses.filter((l) => l.loss !== null && l.loss < 0).sort((a, b) => a.loss! - b.loss!)[0]?.part ?? null
  const gate = gates.length ? gates.join(', ') : null
  if (missing.includes('sleep') || missing.length >= 2) {
    return { score: null, level: gate ? 'red' : 'nodata', label: `Score could not be calculated – missing: ${missing.map((p) => PART_LABEL[p]).join(', ')}`, losses, worst, missing, gate }
  }
  const score = 100 + losses.reduce((s, l) => s + (l.loss ?? 0), 0)
  const b = R().bands
  const level: Level = gate || score < b.caution ? 'red' : score < b.ready ? 'yellow' : 'green'
  const label = gate ? `Not ready – red gate: ${gate}` : level === 'green' ? 'Ready' : level === 'yellow' ? 'Caution' : 'Not ready'
  return { score, level, label, losses, worst, missing, gate }
}

/** Sleep red gate: the last `nightsInRow` nights all short, or a short night before a critical task. */
export function sleepGate(week: number[], taskSoon: boolean): boolean {
  const g = R().redGate
  const lastN = week.slice(-g.nightsInRow)
  const shortRun = lastN.length === g.nightsInRow && lastN.every((h) => h < g.sleepBelowH)
  return shortRun || (taskSoon && week.length > 0 && week[week.length - 1] < g.sleepBelowH)
}

/** Score lines for the readiness chart (ready / caution). */
export const readinessBands = () => R().bands

/** The whole readiness configuration, for the explanation next to the panel. */
export const readinessConfig = () => R()
