// EVA calculations (Step 3): raw suit telemetry -> the nine panel metrics of "EVA Panel v2".
// Constants come from thresholds.json ("eva" section); alert limits stay in the status engine.
import GT from './gtransit/core.js'
import { thresholds } from './statusEngine'
import type { Measurement } from './types'

const cfg = thresholds.eva

export interface Consumable {
  id: string
  label: string
  unit: string
  quantity: number
  /** use per minute at 1000 BTU/h */
  ratePerMin: number
  /** true if use grows with metabolic rate (O₂, CO₂ scrubbing, cooling water) */
  scalesWithMet: boolean
  /** extra loss per minute not caused by the astronaut (leak) */
  extraPerMin?: number
}

/** One sample of suit telemetry (subset of the EvaTelemetry message in the EVA document). */
export interface EvaTelemetry {
  crewId: string
  surface: boolean
  body: 'mars' | 'moon'
  suitPressure: number
  pico2: number
  /** metabolic rate from O₂ use and from heat removed by the cooling garment (two independent sources) */
  metO2: number
  metHeat: number
  hr: number
  rmssd: number
  tcore: number
  tskin: number
  coolingOn: boolean
  backupO2Active: boolean
  backupO2Full: boolean
  consumables: Consumable[]
  returnMin: number
  suitTimeMin: number
  drinkRate: number
  drinkBagPct: number
  pvDeficit: number
  /** HR rise within 10 min upright at low effort; null when not measurable */
  orthoHrRise: number | null
  symptom: null | 'mild' | 'presyncope'
  doseRate: number
  sepWarning: boolean
  sepStarted: boolean
  doseRateRed: boolean
  partnerVoiceLossMin: number
  partnerNoResponse: boolean
  habitatLinkLossMin: number
  partner: { id: string; returnBy: number; level: 'green' | 'yellow' | 'red' }
  /** personal calibration: resting HR/HRV, BTU/h per bpm, resting metabolic rate */
  base: { hr0: number; rmssd0: number; tcore0: number; beta1: number; met_rest: number }
}

export interface TimeBudget {
  /** D: latest time to start the return, minutes from now */
  returnBy: number
  remaining: number
  margin: number
  limitingId: string
  rows: { id: string; label: string; remaining: number; returnBy: number }[]
}

export const returnMetabolicRate = (metNow: number) => Math.max(cfg.returnMetFloorBtuh, cfg.returnMetFactor * metNow)

/**
 * M1 time budget. For each consumable: what is left after setting aside the return trip
 * (at the higher return metabolic rate) and the 30-min reserve, expressed at the current use rate.
 */
export function timeBudget(consumables: Consumable[], metNow: number, returnMin: number): TimeBudget {
  const rate = (c: Consumable, met: number) => c.ratePerMin * (c.scalesWithMet ? met / 1000 : 1) + (c.extraPerMin ?? 0)
  const metRet = returnMetabolicRate(metNow)
  const rows = consumables.map((c) => {
    const now = rate(c, metNow)
    return {
      id: c.id,
      label: c.label,
      remaining: c.quantity / now,
      returnBy: (c.quantity - returnMin * rate(c, metRet) - cfg.reserveMin * now) / now,
    }
  })
  const limiting = rows.reduce((a, b) => (b.returnBy < a.returnBy ? b : a))
  const remaining = Math.min(...rows.map((r) => r.remaining))
  return { returnBy: limiting.returnBy, remaining, margin: remaining - returnMin, limitingId: limiting.id, rows }
}

/** Expected inspired CO₂ for a metabolic rate (linear interpolation of the Kim et al. 2020 points). */
export function expectedPico2(met: number): number {
  const pts = cfg.pico2ExpectedCurve
  const j = pts.findIndex(([x]) => x >= met)
  const i = j === -1 ? pts.length - 1 : Math.max(1, j)
  const [x0, y0] = pts[i - 1]
  const [x1, y1] = pts[i]
  return y0 + ((y1 - y0) * (met - x0)) / (x1 - x0)
}

export interface OriResult {
  ori: number | null
  hrExpected: number | null
  components: Record<string, number>
  excluded: Record<string, string>
  recommendations: string[]
}

/** M8: G-TRANSIT v1.1 suit mode (no blood pressure in the suit; effort-corrected heart rate). */
export function orthostaticRisk(t: EvaTelemetry, metPrimary: number): OriResult {
  const engine = new GT.Engine(GT.DEFAULT_CONFIG, { ...t.base, k_i: 1.0 }, { snapshot: true })
  const r = engine.step({
    t: 0, phase: 'eva', g: cfg.orthostatic.g[t.body], tilt_deg: 90, cos_theta: 1.0,
    tcore: t.tcore, tskin: t.tskin, pv_deficit: t.pvDeficit, hr: t.hr, rmssd: t.rmssd, met_btuh: metPrimary,
    map_heart: null, dtsi: null, map_slope: null, map_slope_se: null,
    sqi: { thermal: 0.95, cardio: 0.95, bp: null, cerebral: null },
  })
  return { ori: r.ori, hrExpected: r.hr_expected, components: r.components, excluded: r.data_quality.reasons, recommendations: r.recommendations }
}

export interface EvaDerived {
  measurements: Measurement[]
  flags: Record<string, boolean>
  budget: TimeBudget
  metPrimary: number
  ori: OriResult | null
}

/**
 * Turn one telemetry sample into panel measurements and flags.
 * `history(metricId)` returns earlier readings of this EVA (oldest first), without the current sample.
 */
export function deriveEva(t: EvaTelemetry, time: number, history: (metricId: string) => Measurement[]): EvaDerived {
  const out: Measurement[] = []
  const add = (metricId: string, value: number, digits = 1) =>
    out.push({ metricId, crewId: t.crewId, value: Number(value.toFixed(digits)), unit: thresholds.metrics[metricId]?.unit ?? '', time })

  // M2 leak suspicion: O₂-derived rate above the heat-derived rate for the whole window while pressure falls
  const n = cfg.leak.windowMin
  const o2 = [...history('eva_met_o2').slice(-(n - 1)).map((m) => m.value), t.metO2]
  const heat = [...history('eva_met_heat').slice(-(n - 1)).map((m) => m.value), t.metHeat]
  const pressureBefore = history('eva_suit_pressure').at(-n)
  const leakSuspected =
    o2.length >= n &&
    o2.every((v, i) => v > heat[i] * (1 + cfg.leak.excessPct / 100)) &&
    !!pressureBefore && t.suitPressure < pressureBefore.value

  // M6 primary metabolic rate: both sources, heat only when a leak inflates the O₂ figure
  const metPrimary = leakSuspected ? t.metHeat : (t.metO2 + t.metHeat) / 2
  const budget = timeBudget(t.consumables, metPrimary, t.returnMin)

  // M7 reference = average of the first minutes of the EVA
  const ref = (id: string, now: number) => {
    const first = [...history(id), { value: now }].slice(0, cfg.heatReferenceMin).map((m) => m.value)
    return first.reduce((a, b) => a + b, 0) / first.length
  }

  add('eva_met_o2', t.metO2, 0)
  add('eva_met_heat', t.metHeat, 0)
  add('eva_metabolic_rate', metPrimary, 0)
  add('eva_heart_rate', t.hr, 0)
  add('eva_suit_pressure', t.suitPressure, 2)
  add('eva_pico2', t.pico2)
  add('eva_pico2_excess', t.pico2 - expectedPico2(metPrimary))
  add('eva_o2', budget.rows.find((r) => r.id === 'o2')?.remaining ?? 0, 0)
  add('eva_margin', budget.margin, 0)
  add('eva_return_by', budget.returnBy, 0)
  add('eva_suit_time', t.suitTimeMin / 60, 2)
  add('eva_suit_time_with_return', (t.suitTimeMin + t.returnMin) / 60, 2)
  add('eva_drink_rate', t.drinkRate, 0)
  add('eva_drink_bag', t.drinkBagPct, 0)
  add('eva_core_temp', t.tcore, 2)
  add('eva_skin_temp', t.tskin, 2)
  add('eva_core_rise', t.tcore - ref('eva_core_temp', t.tcore), 2)
  add('eva_skin_rise', t.tskin - ref('eva_skin_temp', t.tskin), 2)
  add('eva_radiation', t.doseRate)
  add('eva_partner_voice_loss', t.partnerVoiceLossMin, 0)
  add('eva_habitat_link_loss', t.habitatLinkLossMin, 0)

  // M8 only on a surface EVA; the HR-rise rule only at low effort
  let ori: OriResult | null = null
  if (t.surface) {
    ori = orthostaticRisk(t, metPrimary)
    if (ori.ori !== null) add('eva_ori', ori.ori)
    if (t.orthoHrRise !== null && metPrimary <= cfg.orthostatic.gateBtuh) add('eva_orthostatic_hr_rise', t.orthoHrRise, 0)
  }

  return {
    measurements: out,
    budget,
    metPrimary,
    ori,
    flags: {
      backupO2Active: t.backupO2Active,
      backupO2NotFull: !t.backupO2Full,
      leakSuspected,
      metabolicMismatch: t.hr > cfg.mismatch.hrAbove && metPrimary < cfg.mismatch.metabolicBelow,
      coolingOff: !t.coolingOn,
      sepWarning: t.sepWarning,
      sepStarted: t.sepStarted,
      doseRateRed: t.doseRateRed,
      partnerNoResponse: t.partnerNoResponse,
      orthoMildSymptom: t.symptom === 'mild',
      preSyncope: t.symptom === 'presyncope',
    },
  }
}
