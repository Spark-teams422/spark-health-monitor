// Simulator (Step 1.6): deterministic fake telemetry with selectable scenarios.
// All values here are SAMPLE DATA, not thresholds. Limits live in config/thresholds.json.
import { expectedPico2, type EvaTelemetry } from './eva'
import exercisePlan from '../config/exercise.json'
import type { Astronaut, LinkState, Measurement } from './types'

export const SCENARIOS = {
  normal: 'Normal day',
  slowTrend: 'Slow worsening trend (A3 HRV)',
  suddenCritical: 'Sudden critical (A3 SpO₂ drop)',
  linkLoss: 'Link loss during a critical alert',
  multiCrew: 'Several crew affected (cabin CO₂)',
  eva: 'EVA · nominal (A3, Mars surface)',
  evaWorkload: 'EVA · O₂ margin shrinking (high workload)',
  evaCo2: 'EVA · CO₂ scrubber degrading',
  evaLeak: 'EVA · slow suit leak',
  evaCooling: 'EVA · cooling degraded',
  evaOrtho: 'EVA · orthostatic intolerance',
  evaBackupO2: 'EVA · backup O₂ engaged',
  evaSolar: 'EVA · solar particle event',
  evaMismatch: 'EVA · HR / metabolic mismatch',
  evaPartner: 'EVA · partner not responding',
  solarEvent: 'Solar particle event (Mars transit)',
} as const
export type ScenarioId = keyof typeof SCENARIOS

const MIN = 60_000
const DAY = 24 * 60 * MIN
/** Standard conversion and water-vapour pressure used by PIO₂ = (P - 47) x FiO₂ (Chart Blueprint, panel B). */
const PSI_TO_MMHG = 51.715
const WATER_VAPOUR_MMHG = 47

// Sample resting values per crew member (illustrative; replaced by real datasets later).
const BASE: Record<string, { sys: number; dia: number; spo2: number; temp: number }> = {
  A1: { sys: 118, dia: 74, spo2: 97, temp: 37.3 },
  A2: { sys: 114, dia: 72, spo2: 98, temp: 37.2 },
  A3: { sys: 121, dia: 76, spo2: 97, temp: 37.4 },
  A4: { sys: 122, dia: 76, spo2: 97, temp: 37.1 },
  A5: { sys: 110, dia: 70, spo2: 98, temp: 37.0 },
}
const CABIN = { co2: 2.1, o2Fraction: 0.21, pressurePsia: 14.7, temp: 22.5, radRate: 0.55 }
const UNITS: Record<string, string> = {
  bp_systolic: 'mmHg', bp_diastolic: 'mmHg', hrv: 'ms', spo2: '%', body_temp: '°C',
  radiation_rate: 'mSv/day', radiation_cumulative: 'mSv', cabin_co2: 'mmHg', cabin_pio2: 'mmHg',
  cabin_pressure: 'psia', cabin_temp: '°C', sleep_hours: 'h', cognition_z: 'z', reaction_ms: 'ms', rad_daily_dose: 'mSv', rad_eva_dose: 'mSv',
  lab_hemoglobin: 'g/dL', lab_sodium: 'mmol/L', lab_potassium: 'mmol/L', lab_ionized_calcium: 'mmol/L', lab_crp: 'mg/L',
  lab_urine_sg: '', lab_hematocrit: '%', eye_vision_lines: 'lines', eye_iop: 'mmHg', nutrition_kcal_pct: '%', water_l: 'L/day', sleep_med_nights: 'nights/week',
  ecg_max_pause: 's', body_mass_loss: '%', fitness_pct: '%', fitness_vo2peak: 'mL/kg/min', strength_pct: '%', bone_urine_ca: 'mg/day', bone_ntx: 'nmol BCE/mmol Cr',
  bone_bsap: 'U/L', muscle_leg_press: 'N', muscle_knee_torque: 'Nm', ared_volume: 'kg', lab_glucose: 'mg/dL', lab_bun: 'mg/dL', lab_creatinine: 'mg/dL', lab_chloride: 'mmol/L', lab_total_co2: 'mmol/L',
}
// Sample blood panel (mid-normal values; hemoglobin and hematocrit depend on sex). [value, noise, digits]
const BLOOD: Record<string, [number, number, number]> = {
  lab_sodium: [140, 2, 0], lab_potassium: [4.2, 0.3, 1], lab_ionized_calcium: [1.22, 0.04, 2], lab_crp: [1.5, 1, 1],
  lab_glucose: [88, 8, 0], lab_bun: [14, 3, 0], lab_creatinine: [0.9, 0.12, 2], lab_chloride: [102, 2, 0], lab_total_co2: [26, 1.5, 0],
}
/** Sample sleep for the last 7 nights (oldest first): A2 = the worked example of the Chart Blueprint (5.5); A3 sleeps 4.5 h before the EVA. */
const SLEEP_WEEK: Record<string, number[]> = { A2: [7, 6.5, 6, 7, 6.5, 6, 6.5], A3: [7.5, 7, 7.5, 7.5, 7, 7.5, 4.5] }
/** Days since each person's last cognitive test (A1's is out of date on purpose). */
/** deterministic scatter in −1..1 (does not use the seeded random sequence) */
const scatter = (k: number) => 2 * ((((Math.sin(k * 12.9898 + 4.1414) * 43758.5453) % 1) + 1) % 1) - 1
const COG_OFFSET: Record<string, number> = { A1: 25, A2: 12, A3: 5, A4: 9, A5: 2 }
/** sample own-normal simple visual reaction time per person, ms (median of 5) */
const REACTION_MS: Record<string, number> = { A1: 268, A2: 282, A3: 256, A4: 291, A5: 273 }
/** Sample person effects (kept consistent across screens): A1 lost one vision line; A2 eats less and takes sleep medication;
 *  A3 lost more body mass and fitness; A4 drinks too little and skips ARED sessions (lower strength, more bone resorption). */
const COMPLIANCE: Record<string, number> = { A1: 0.95, A2: 0.92, A3: 0.97, A4: 0.74, A5: 1 }
/** Daily ARED volume load of the default plan, Mon..Sun (sets × reps × summed lift loads, see config/exercise.json). */
export function plannedDayVolume(plan: { sessions: { day: string; type: string; sets: number; reps: number }[]; lifts: { loadKg: number; sets?: number }[] }, day: string): number {
  return plan.sessions.filter((s) => s.day === day && s.type === 'resistance').reduce((v, s) => v + plan.lifts.reduce((w, l) => w + (l.sets ?? s.sets) * s.reps * l.loadKg, 0), 0)
}
export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
/** Mission days with an EVA so far (sample). */
const EVA_DAYS: Record<string, number[]> = { A1: [61, 118], A3: [61, 118, 131] }

function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export interface SimFrame {
  measurements: Measurement[]
  link: LinkState
  flags: Record<string, boolean>
  eva: EvaTelemetry | null
}

export class Simulator {
  private rand: () => number
  /** simulated time at which the current scenario started */
  private t0 = 0
  private o2Used = 0
  private sepDose = 0
  scenario: ScenarioId = 'normal'

  constructor(private crew: Astronaut[], private seed: number, private missionStart: number) {
    this.rand = mulberry32(seed)
  }

  /** bounded noise in [-amp, +amp] so the normal scenario can never drift over a limit by chance */
  private noise(amp: number) {
    return (this.rand() * 2 - 1) * amp
  }

  private m(metricId: string, crewId: string | null, value: number, time: number, digits = 1): Measurement {
    return { metricId, crewId, value: Number(value.toFixed(digits)), unit: UNITS[metricId], time }
  }

  /** Round-trip time of the Earth link in seconds (sample: light time grows as the ship moves away). */
  pingSec(now: number): number {
    const day = (now - this.missionStart) / DAY
    return Math.round(2 * (90 + 3.2 * day) + this.noise(2))
  }

  /** Mission-long sample history: monthly blood panel, weekly urine, 14 nights of sleep, cognitive tests every 2 weeks. */
  private periodic(now: number): Measurement[] {
    const out: Measurement[] = []
    const today = Math.floor(now / DAY) * DAY
    this.crew.forEach((c, n) => {
      const male = c.sex === 'male'
      for (let t = this.missionStart + (5 + n) * DAY + 8 * 60 * MIN; t < now; t += 30 * DAY) {
        const last = t + 30 * DAY >= now
        for (const [id, [v, amp, digits]] of Object.entries(BLOOD)) {
          // A2's latest CRP is raised (5–10: repeat in a week) – sample case for the caution colour
          const value = id === 'lab_crp' && c.id === 'A2' && last ? 7.2 : Math.max(0.1, v + this.noise(amp))
          out.push(this.m(id, c.id, value, t, digits))
        }
        out.push(this.m('lab_hemoglobin', c.id, (male ? 14.8 : 13.4) + this.noise(0.6), t))
        out.push(this.m('lab_hematocrit', c.id, (male ? 44 : 40) + this.noise(1.5), t, 0))
      }
      for (let t = this.missionStart + (2 + n) * DAY + 7 * 60 * MIN; t < now; t += 7 * DAY) {
        // A4's latest urine is concentrated (drinks too little) – sample case
        const value = c.id === 'A4' && t + 7 * DAY >= now ? 1.032 : 1.018 + this.noise(0.006)
        out.push(this.m('lab_urine_sg', c.id, value, t, 3))
      }
      for (let d = 13; d >= 0; d--) {
        const t = today - d * DAY + 7 * 60 * MIN
        const week = SLEEP_WEEK[c.id]
        const h = week && d < 7 ? week[6 - d] : 7.4 + this.noise(0.5)
        if (t < now) out.push(this.m('sleep_hours', c.id, h, t))
      }
      // daily dose: cabin rate × the person's time in more or less shielded modules (sample factor per person)
      const occupancy = 0.92 + n * 0.04
      for (let t = this.missionStart + DAY - MIN; t < now; t += DAY) out.push(this.m('rad_daily_dose', c.id, CABIN.radRate * occupancy + this.noise(0.04), t, 3))
      // earlier EVAs of this mission add a skin / eye term the cabin monitors cannot see (sample)
      for (const d of EVA_DAYS[c.id] ?? []) out.push(this.m('rad_eva_dose', c.id, 0.35 + this.noise(0.08), this.missionStart + (d - 1) * DAY + 14 * 60 * MIN, 3))
      this.musculo(c, n, now, out)
      for (let t = today - COG_OFFSET[c.id] * DAY + 15 * 60 * MIN; t > this.missionStart; t -= 14 * DAY) out.push(this.m('cognition_z', c.id, this.noise(0.4), t, 2))
      // reaction time with every cognitive test; A3 also tested this morning after the short night before the EVA (slower)
      // fixed scatter instead of this.noise(), so the other sample values keep their random sequence
      for (let t = today - COG_OFFSET[c.id] * DAY + 15 * 60 * MIN, k = 0; t > this.missionStart; t -= 14 * DAY, k++) out.push(this.m('reaction_ms', c.id, REACTION_MS[c.id] + Math.round(24 * (((Math.sin(k * 12.9898 + n * 78.233) * 43758.5453) % 1 + 1) % 1) - 12), t + 20 * MIN, 0))
      if (c.id === 'A3') out.push(this.m('reaction_ms', c.id, REACTION_MS.A3 + 48, now - 30 * MIN, 0))
      // synthetic gap fill (team request, 15 Nov 2026): a test inside the 21-day freshness window when the 14-day cadence leaves none
      if (COG_OFFSET[c.id] > 14) out.push(this.m('cognition_z', c.id, Number((0.3 * scatter(n + 7)).toFixed(2)), today - (COG_OFFSET[c.id] - 14) * DAY + 15 * 60 * MIN, 2))
    })
    return out.sort((a, b) => a.time - b.time)
  }

  /**
   * Periodic tasks and the musculoskeletal record (sample data shaped by published means: body mass −3–4 % in the
   * first 30 days, bone resorption half-maximum at about 11 days and plateau +113 % (PMC7200725), formation flat for
   * 30 days then +7 % a month, VO2peak about −7 % (npj Microgravity 2023)).
   */
  private musculo(c: Astronaut, n: number, now: number, out: Measurement[]) {
    const pre = c.preflight
    const at = (day: number, hour = 8) => this.missionStart + (day - 1) * DAY + hour * 60 * MIN
    const missionDay = (now - this.missionStart) / DAY
    const today = Math.floor(missionDay) + 1 // mission day number of `now` (day 1 = start date)
    const id = c.id
    const comp = COMPLIANCE[id] ?? 0.95
    const push = (metric: string, value: number, t: number, digits = 1) => { if (t < now) out.push(this.m(metric, id, value, t, digits)) }
    for (let d = 15 + n; d < missionDay; d += 30) {
      const last = d + 30 >= missionDay
      push('eye_vision_lines', id === 'A1' && last ? 1 : 0, at(d, 10), 0)
      const pct = 100 - Math.min(d, 60) / 60 * (id === 'A3' ? 14 : 6) + this.noise(1)
      push('fitness_pct', pct, at(d, 16))
      push('fitness_vo2peak', pre.vo2peak * pct / 100, at(d, 16))
      const strength = 100 - Math.min(d, 90) / 90 * (id === 'A4' ? 12 : 5) + this.noise(1)
      push('strength_pct', strength, at(d + 1, 16))
      push('muscle_leg_press', pre.legPressN * strength / 100, at(d + 1, 16), 0)
      push('muscle_knee_torque', pre.kneeTorqueNm * (1 - (1 - strength / 100) * 0.8), at(d + 1, 16), 0)
      // bone: resorption rises with half-maximum at ~11 days; less with good ARED compliance
      const rise = (1 - Math.pow(2, -d / 11)) * (id === 'A4' ? 0.9 : 0.55)
      push('bone_urine_ca', pre.urineCaMgDay * (1 + rise) + this.noise(6), at(d, 7), 0)
      push('bone_ntx', pre.ntx * (1 + 1.13 * (1 - Math.pow(2, -d / 11)) * (id === 'A4' ? 0.95 : 0.7)) + this.noise(1.5), at(d, 7))
      push('bone_bsap', 15 * (1 + Math.max(0, d - 30) / 30 * 0.07) + this.noise(0.6), at(d, 7))
    }
    if (id === 'A1') push('eye_iop', 18, at(today - 14, 11), 0)
    for (let d = 1; d < missionDay; d += 7) push('body_mass_loss', Math.min(d, 30) / 30 * (id === 'A3' ? 4.6 : 3.2) + this.noise(0.2), at(d + n % 3, 6))
    for (let w = 8; w >= 1; w--) push('sleep_med_nights', id === 'A2' && w === 1 ? 3 : Math.round(this.rand()), at(today - w * 7 + 1, 20), 0)
    for (let d = 14; d >= 1; d--) {
      const day = today - d
      // sample trends for the early-warning panel: A2 eats a little less every day, A4 drinks a little less every day
      push('nutrition_kcal_pct', id === 'A2' && d <= 6 ? 95 - (7 - d) * 3.4 + this.noise(2) : 95 + this.noise(4), at(day, 21), 0)
      push('water_l', id === 'A4' && d <= 7 ? 2.8 - (8 - d) * 0.085 + this.noise(0.06) : 2.8 + this.noise(0.2), at(day, 21))
      push('ecg_max_pause', 1.1 + this.noise(0.2), at(day, 6))
    }
    push('ecg_max_pause', 1.1 + this.noise(0.2), at(today, 6)) // continuous recording: today's night is already analysed
    for (let d = 1; d < missionDay; d++) {
      const t = at(d, 15)
      const v = plannedDayVolume(exercisePlan, WEEKDAYS[new Date(t).getUTCDay()])
      if (v > 0) push('ared_volume', v * comp * (0.9 + this.rand() * 0.2), t, 0)
    }
  }

  /** Restart with a scenario; returns 24 h of normal history (5-min steps), 14 days of daily HRV and the periodic tests. */
  start(scenario: ScenarioId, now: number): Measurement[] {
    this.scenario = scenario
    this.rand = mulberry32(this.seed)
    this.t0 = now
    this.o2Used = 0
    this.sepDose = 0
    const out: Measurement[] = []
    // synthetic gap fill (team request, 15 Nov 2026): hourly cabin CO₂ for the 14 days before the detailed 24 h,
    // so the readiness score of earlier days has its CO₂ part. Fixed scatter, not this.noise(), keeps the other values.
    for (let t = now - 15 * DAY, k = 0; t < now - DAY; t += 60 * MIN, k++) out.push(this.m('cabin_co2', null, CABIN.co2 + 0.1 * scatter(k), t, 2))
    for (let t = now - DAY; t < now; t += 5 * MIN) out.push(...this.vitals(t, -1), ...this.cabin(t))
    this.crew.forEach((c) => {
      for (let d = 13; d >= 0; d--) {
        // slowTrend: A3's HRV sinks a little more every day of the last week
        const drop = scenario === 'slowTrend' && c.id === 'A3' && d <= 6 ? 2 + (6 - d) * 1.2 : 0
        const t = Math.floor(now / DAY) * DAY - d * DAY + 7 * 60 * MIN
        if (t < now) out.push(this.m('hrv', c.id, c.hrvBaseline.mean - drop + this.noise(c.hrvBaseline.sd * 0.3), t))
      }
    })
    return [...this.periodic(now), ...out]
  }

  /** One simulated step. */
  tick(now: number): SimFrame {
    const t = Math.round((now - this.t0) / MIN) // minutes into the scenario
    const s = this.scenario
    let link: LinkState = 'connected'
    if (s === 'linkLoss') link = t >= 1 && t < 23 ? 'lost' : t >= 23 && t < 26 ? 'weak' : 'connected'
    const measurements = [...this.vitals(now, t), ...this.cabin(now)]
    // solarEvent: the event "starts" when ≥10 MeV protons reach 10 pfu (NOAA SWPC event threshold)
    const flux = s === 'solarEvent' ? sepFlux(t) : null
    const flags: Record<string, boolean> = flux !== null && flux >= 10 ? { sepStarted: true } : {}
    return { measurements, link, flags, eva: s.startsWith('eva') ? this.eva(t) : null }
  }

  private vitals(time: number, t: number): Measurement[] {
    const s = this.scenario
    return this.crew.flatMap((c) => {
      const b = BASE[c.id]
      let spo2 = b.spo2 + this.noise(0.4)
      // suddenCritical / linkLoss: A3's SpO₂ falls 3 points a minute from minute 3 and settles at 88 %
      if ((s === 'suddenCritical' || s === 'linkLoss') && c.id === 'A3' && t >= 3) spo2 = Math.max(88, b.spo2 - 3 * (t - 2)) + this.noise(0.3)
      // multiCrew: A1 and A3 lose a point a minute down to 93 % while cabin CO₂ is high
      if (s === 'multiCrew' && (c.id === 'A1' || c.id === 'A3') && t >= 2) spo2 = Math.max(93, b.spo2 - (t - 1)) + this.noise(0.3)
      return [
        this.m('bp_systolic', c.id, b.sys + this.noise(3), time, 0),
        this.m('bp_diastolic', c.id, b.dia + this.noise(2), time, 0),
        this.m('spo2', c.id, spo2, time),
        this.m('body_temp', c.id, b.temp + this.noise(0.1), time),
      ]
    })
  }

  private cabin(time: number): Measurement[] {
    // solarEvent: sample solar particle event during the Mars transit (dose rate and event dose from the proton flux)
    const flux = this.scenario === 'solarEvent' ? sepFlux((time - this.t0) / MIN) : null
    const extra = flux === null ? 0 : sepExtraRate(flux)
    if (flux !== null) this.sepDose += extra / 1440 // one tick = 1 min
    const pressure = CABIN.pressurePsia + this.noise(0.03)
    const day = (time - this.missionStart) / DAY
    // multiCrew: CO₂ scrubber degrades at scenario start (history before t0 stays normal)
    const co2 = this.scenario === 'multiCrew' && time > this.t0 ? 3.3 : CABIN.co2
    return [
      this.m('cabin_co2', null, co2 + this.noise(0.08), time, 2),
      this.m('cabin_pressure', null, pressure, time, 2),
      this.m('cabin_pio2', null, (pressure * PSI_TO_MMHG - WATER_VAPOUR_MMHG) * CABIN.o2Fraction, time),
      this.m('cabin_temp', null, CABIN.temp + this.noise(0.3), time),
      this.m('radiation_rate', null, CABIN.radRate + extra + this.noise(0.05), time, 2),
      this.m('radiation_cumulative', null, CABIN.radRate * day + this.sepDose, time),
      ...(flux === null ? [] : [this.m('radiation_event_dose', null, this.sepDose, time, 2)]),
    ]
  }

  /**
   * Suit telemetry for A3 on a Mars surface EVA with partner A1. Each scenario bends one input;
   * the panel metrics and alerts are derived from it in eva.ts, never set here.
   */
  private eva(t: number): EvaTelemetry {
    const s = this.scenario
    const ramp = (from: number, to: number, start: number, minutes: number) => from + (to - from) * Math.min(1, Math.max(0, (t - start) / minutes))
    const base = { hr0: 68, rmssd0: 42, tcore0: 37.2, beta1: 15, met_rest: 400 }

    let met = 900
    if (s === 'evaWorkload') met = ramp(900, 1700, 2, 10)
    if (s === 'evaCo2' || s === 'evaMismatch') met = 800
    if (s === 'evaOrtho') met = 500
    met += this.noise(25)

    const leak = s === 'evaLeak' ? Math.max(0, t - 1) : 0 // minutes of leaking
    this.o2Used += met * 0.00086 + (leak > 0 ? 0.35 : 0)
    const returnMin = 40

    let hr = base.hr0 + (met - base.met_rest) / base.beta1 + this.noise(3)
    if (s === 'evaMismatch' && t >= 3) hr = 150 + this.noise(2)
    const orthoRise = s === 'evaOrtho' ? ramp(6, 34, 2, 8) : 6
    if (s === 'evaOrtho') hr += orthoRise

    const heat = s === 'evaCooling' ? Math.max(0, t - 2) * 0.09 : s === 'evaOrtho' ? ramp(0, 1.5, 2, 10) : 0
    const voiceLoss = s === 'evaPartner' ? Math.max(0, t - 2) : 0

    return {
      crewId: 'A3',
      surface: true,
      body: 'mars',
      suitPressure: 4.3 - leak * 0.04 + this.noise(0.005),
      pico2: (s === 'evaCo2' ? ramp(9, 16.5, 2, 18) : expectedPico2(met) - 0.7) + this.noise(0.15),
      metO2: met * (leak > 0 ? 1.35 : 1) + this.noise(15),
      metHeat: met + this.noise(15),
      hr,
      rmssd: s === 'evaOrtho' ? ramp(42, 20, 2, 10) : 40 + this.noise(2),
      tcore: 37.3 + heat + this.noise(0.03),
      tskin: 33.5 + heat * 1.6 + this.noise(0.05),
      coolingOn: true,
      backupO2Active: s === 'evaBackupO2' && t >= 3,
      backupO2Full: true,
      consumables: [
        { id: 'o2', label: 'O₂', unit: 'L', quantity: Math.max(0, (s === 'evaWorkload' ? 180 : 300) - this.o2Used), ratePerMin: 0.86, scalesWithMet: true, extraPerMin: leak > 0 ? 0.35 : 0 },
        { id: 'scrubber', label: 'CO₂ scrubbing', unit: 'min', quantity: 470 - t, ratePerMin: 1, scalesWithMet: true },
        { id: 'water', label: 'Cooling water', unit: 'min', quantity: 520 - t, ratePerMin: 1, scalesWithMet: true },
        { id: 'battery', label: 'Battery', unit: 'min', quantity: 430 - t, ratePerMin: 1, scalesWithMet: false },
      ],
      returnMin,
      suitTimeMin: 150 + t,
      drinkRate: 260,
      drinkBagPct: Math.max(25, 70 - t * 0.4),
      pvDeficit: s === 'evaOrtho' ? ramp(0.15, 0.18, 2, 10) : 0.15,
      orthoHrRise: orthoRise,
      symptom: s === 'evaOrtho' ? (t >= 16 ? 'presyncope' : t >= 9 ? 'mild' : null) : null,
      doseRate: (s === 'evaSolar' && t >= 10 ? 400 : 25) + this.noise(3),
      sepWarning: s === 'evaSolar' && t >= 2,
      sepStarted: s === 'evaSolar' && t >= 10,
      doseRateRed: false,
      partnerVoiceLossMin: voiceLoss,
      partnerNoResponse: s === 'evaPartner' && t >= 8,
      habitatLinkLossMin: 0,
      partner: { id: 'A1', returnBy: 200 - t, level: 'green' },
      base,
    }
  }
}

/**
 * Demo only (sample data): suit values at the end of each astronaut's last EVA, so the health hexagon is filled for
 * everyone outside an EVA. The frame is the walk back at low effort (metEnd, below the model's 700 BTU/h effort gate,
 * so the heart-rate axis counts); met = mean rate over the whole EVA (for the effort axis); rmssd = share of the
 * person's own baseline; heat = core rise °C; pv = plasma deficit share; ortho = upright HR rise bpm; hours = time in
 * the suit. Same model as the live EVA frame above.
 */
const LAST_EVA: Record<string, { met: number; metEnd: number; rmssd: number; heat: number; pv: number; ortho: number; hours: number }> = {
  A1: { met: 950, metEnd: 600, rmssd: 0.82, heat: 0.4, pv: 0.12, ortho: 9, hours: 5.5 },
  A2: { met: 1150, metEnd: 680, rmssd: 0.7, heat: 0.9, pv: 0.17, ortho: 14, hours: 6.2 },
  A3: { met: 900, metEnd: 550, rmssd: 0.9, heat: 0.3, pv: 0.15, ortho: 6, hours: 2.5 },
  A4: { met: 820, metEnd: 520, rmssd: 0.95, heat: 0.2, pv: 0.08, ortho: 5, hours: 4.0 },
  A5: { met: 1050, metEnd: 650, rmssd: 0.76, heat: 0.6, pv: 0.2, ortho: 11, hours: 5.0 },
}
export function lastEvaSample(crewId: string, rmssd0: number): { telemetry: EvaTelemetry; metEnd: number; energy: number } {
  const s = LAST_EVA[crewId] ?? LAST_EVA.A3
  const base = { hr0: 68, rmssd0, tcore0: 37.2, beta1: 15, met_rest: 400 }
  const telemetry = {
    crewId, body: 'mars', base, rmssd: rmssd0 * s.rmssd,
    hr: base.hr0 + (s.metEnd - base.met_rest) / base.beta1 + s.ortho,
    tcore: 37.3 + s.heat, tskin: 33.5 + s.heat * 1.6, pvDeficit: s.pv,
  } as EvaTelemetry // only the fields the orthostatic model reads
  return { telemetry, metEnd: s.metEnd, energy: s.met * s.hours }
}

/** Sample check-in history before the simulation starts (days ago with no check-in), so the streak chain has a past. */
const CHECKIN_MISSED: Record<string, number[]> = { A1: [12, 25], A2: [3, 9, 17], A3: [6, 20], A4: [1, 14], A5: [28] }
export const sampleCheckinMissed = (crewId: string, daysAgo: number) => (CHECKIN_MISSED[crewId] ?? []).includes(daysAgo)

/**
 * Sample solar particle event for the Mars transit scenario (SIM): ≥10 MeV proton flux in pfu, `m` minutes after the
 * scenario starts — a rise over 30 min to an S2-level peak (NOAA scale: S1 10, S2 100, S3 1000 pfu), then a slow decay.
 * null before the start. The shape and the dose-rate factor below are sample values, not a forecast.
 */
export function sepFlux(m: number): number | null {
  if (m < 0) return null
  return m <= 30 ? 0.3 * Math.pow(900 / 0.3, m / 30) : 900 * Math.exp(-(m - 30) / 600)
}
/** Extra cabin dose rate (mSv/day) for a proton flux (sample: 4 mSv/day at the 900 pfu peak). */
export const sepExtraRate = (flux: number) => (4 * flux) / 900
