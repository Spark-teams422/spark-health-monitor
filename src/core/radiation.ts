// Per-astronaut radiation ledger (Astronaut Radiation Monitoring document): three doses, each against its own limit.
// Career = earlier missions + this mission; 30-day organ dose; SPE event dose; dose rate against the normal rate.
// Limits and operational steps live in thresholds.json -> radiation. This is an estimate, not a personal dosimeter reading.
import { thresholds } from './statusEngine'
import type { Level, Measurement } from './types'

const DAY = 24 * 3600_000
const sum = (ms: Measurement[]) => ms.reduce((s, m) => s + m.value, 0)

export interface RadRatio { key: 'career' | 'd30' | 'spe' | 'rate'; label: string; dose: number | null; limit: number; unit: string; ratio: number | null; note: string }
export interface RadLedger { ratios: RadRatio[]; worst: RadRatio; level: Level; label: string; organ30: { bfo: number; eye: number; skin: number }; missionDose: number }

/**
 * R = max(R_career, R_30d, R_SPE) is the number to show, with the limit it comes from (never an average).
 * Normal < 0.5 · Caution ≥ 0.5 or dose rate ≥ 3× normal · Warning ≥ 0.8 · Critical ≥ 1.0.
 */
export function radiationLedger(x: { priorMSv: number; daily: Measurement[]; eva: Measurement[]; now: number; eventDose: number | null; rateNow: number | null; sLevel?: number }): RadLedger {
  const r = thresholds.radiation
  const in30 = (ms: Measurement[]) => ms.filter((m) => m.time > x.now - 30 * DAY && m.time <= x.now)
  const missionDose = sum(x.daily) + sum(x.eva)
  const bfo = sum(in30(x.daily)), extra = sum(in30(x.eva))
  // area monitors cannot split organs: blood-forming organs take the habitat dose, lens and skin add the EVA term
  const organ30 = { bfo, eye: bfo + extra, skin: bfo + extra }
  const o = r.organ30d
  const organRatios = [organ30.bfo / o.bfo, organ30.eye / o.eye, organ30.skin / o.skin]
  const organIdx = organRatios.indexOf(Math.max(...organRatios))
  const organName = ['blood-forming organs', 'eye lens', 'skin'][organIdx]
  const ratios: RadRatio[] = [
    { key: 'career', label: 'Career', dose: x.priorMSv + missionDose, limit: r.careerLimitMSv, unit: 'mSv', ratio: (x.priorMSv + missionDose) / r.careerLimitMSv, note: `${x.priorMSv} earlier missions + ${missionDose.toFixed(1)} this mission` },
    { key: 'd30', label: '30 days', dose: [organ30.bfo, organ30.eye, organ30.skin][organIdx], limit: [o.bfo, o.eye, o.skin][organIdx], unit: 'mGy-Eq', ratio: organRatios[organIdx], note: `worst organ: ${organName}` },
    { key: 'spe', label: 'Solar event', dose: x.eventDose, limit: r.speLimitMSv, unit: 'mSv', ratio: x.eventDose === null ? null : x.eventDose / r.speLimitMSv, note: x.eventDose === null ? 'no event running' : 'running event estimate' },
    { key: 'rate', label: 'Dose rate', dose: x.rateNow, limit: r.normalRateMSvDay, unit: 'mSv/day', ratio: x.rateNow === null ? null : x.rateNow / r.normalRateMSvDay, note: `× normal (alarm at ${r.rateAlarmFactor}×)` },
  ]
  const limited = ratios.filter((q) => q.key !== 'rate' && q.ratio !== null)
  const worst = limited.reduce((a, b) => (b.ratio! > a.ratio! ? b : a))
  const L = r.levels
  const rate = ratios[3].ratio ?? 0
  const [level, label]: [Level, string] =
    worst.ratio! >= L.critical ? ['red', 'Critical – shelter, end any EVA'] :
    worst.ratio! >= L.warning || (x.sLevel ?? 0) >= r.warningSScale ? ['yellow', 'Warning – prepare the shelter, consider postponing EVA'] :
    worst.ratio! >= L.caution || rate >= r.rateAlarmFactor ? ['yellow', 'Caution – tell the mission planner'] : ['green', 'Normal – routine monitoring']
  return { ratios, worst, level, label, organ30, missionDose }
}
