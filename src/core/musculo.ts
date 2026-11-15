// Musculoskeletal record: bone (urine calcium and NTX against the personal baseline) and muscle (strength loss and
// exercise compliance). Formulas from the bone loss and exercise program documents; constants in thresholds.json.
import { thresholds } from './statusEngine'
import type { Level, Measurement } from './types'

const DAY = 24 * 3600_000

export interface BoneState {
  rCa: number | null
  rNtx: number | null
  /** estimated net bone calcium loss, mg/day (negative = loss) */
  dCaMgDay: number | null
  lossPctMonth: number | null
  level: Level
  label: string
  lastTime: number | null
}

/**
 * R_Ca = (U − U0)/U0; ΔCa ≈ −250 mg/day × min(R_Ca, 1); loss %/month ≈ 30·|ΔCa| / skeletal Ca × 100.
 * R_NTX = (NTX/NTX0 − 1) / 1.13 (1 = the meta-analysis plateau, about 2.1× baseline).
 * Normal R < 0.5 and loss < 0.5 %/month · Caution R ≥ 0.5 or loss ≥ 0.5 · Warning R ≥ 1 or loss ≥ 1 ·
 * Critical loss ≥ 1.5 %/month or two Warnings in a row.
 */
export function boneState(uca: Measurement[], ntx: Measurement[], u0: number, ntx0: number): BoneState {
  const b = thresholds.bone
  const rOf = (u: number) => (u - u0) / u0
  const nOf = (n: number) => (n / ntx0 - 1) / b.ntxPlateauRise
  const lastU = uca.at(-1), lastN = ntx.at(-1)
  if (!lastU) return { rCa: null, rNtx: lastN ? nOf(lastN.value) : null, dCaMgDay: null, lossPctMonth: null, level: 'nodata', label: 'No urine calcium yet', lastTime: null }
  const rCa = rOf(lastU.value)
  const rNtx = lastN ? nOf(lastN.value) : null
  const dCa = -b.netLossMgDayAtR1 * Math.min(Math.max(rCa, 0), 1)
  const loss = (30 * Math.abs(dCa)) / b.skeletalCaMg * 100
  const warn = (r: number, l: number) => r >= b.levels.warning || l >= b.lossPctMonth.warning
  const R = Math.max(rCa, rNtx ?? -Infinity)
  const prev = uca.at(-2)
  const prevWarn = prev ? warn(rOf(prev.value), (30 * b.netLossMgDayAtR1 * Math.min(Math.max(rOf(prev.value), 0), 1)) / b.skeletalCaMg * 100) : false
  const [level, label]: [Level, string] =
    loss >= b.lossPctMonth.critical || (warn(R, loss) && prevWarn) ? ['red', 'Critical – confirm with ground, plan DXA / QCT'] :
    warn(R, loss) ? ['yellow', 'Warning – specialist review, check vitamin D and calcium intake'] :
    R >= b.levels.caution || loss >= b.lossPctMonth.caution ? ['yellow', 'Caution – review nutrition and exercise load'] : ['green', 'Normal – routine']
  return { rCa, rNtx, dCaMgDay: dCa, lossPctMonth: loss, level, label, lastTime: lastU.time }
}

export interface MuscleState { lossPct: number | null; risk: number | null; compliance: number | null; level: Level; label: string }

/** loss % = (1 − P/P0)·100; R_kas = min(loss/20, 1); U = completed / planned volume load over the last 7 days. */
export function muscleState(strength: Measurement[], p0: number, completed: Measurement[], plannedWeek: number, now: number): MuscleState {
  const m = thresholds.muscle
  const last = strength.at(-1)
  const lossPct = last ? Math.max(0, (1 - last.value / p0) * 100) : null
  const risk = lossPct === null ? null : Math.min(lossPct / m.lossFullPct, 1)
  const done = completed.filter((c) => c.time > now - m.days * DAY && c.time <= now).reduce((s, c) => s + c.value, 0)
  const compliance = plannedWeek > 0 ? done / plannedWeek : null
  const red = (risk !== null && risk > m.risk.critical) || (compliance !== null && compliance < m.compliance.critical)
  const yellow = (risk !== null && risk >= m.risk.caution) || (compliance !== null && compliance < m.compliance.caution)
  const [level, label]: [Level, string] = red ? ['red', 'Flight surgeon and exercise physiologist review'] : yellow ? ['yellow', 'Increase the load, review the sessions'] : risk === null ? ['nodata', 'No strength test yet'] : ['green', 'Continue the program']
  return { lossPct, risk, compliance, level, label }
}
