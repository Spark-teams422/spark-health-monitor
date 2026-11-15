// Shared data model (Step 1.2). Every screen reads these types; none defines its own.

export type Level = 'green' | 'yellow' | 'red' | 'nodata'
export type LinkState = 'connected' | 'weak' | 'lost'
export type Mode = 'main' | 'personal' | 'tasks' | 'periodic' | 'physical' | 'cabin' | 'eva'
export type Op = '<' | '<=' | '>' | '>='

export interface Astronaut {
  id: string
  name: string
  role: string
  sex: 'male' | 'female'
  /** effective dose from earlier missions (mSv) */
  priorDoseMSv: number
  /** preflight baselines ("own normal") */
  preflight: { source: string; massKg: number; heightM: number; vo2peak: number; urineCaMgDay: number; ntx: number; legPressN: number; kneeTorqueNm: number }
  age: number
  hrvBaseline: { mean: number; sd: number }
}

export interface Measurement {
  metricId: string
  /** null = shared cabin / crew-wide value */
  crewId: string | null
  value: number
  unit: string
  /** epoch ms, mission (simulated) time */
  time: number
}

export type Rule =
  | { op: Op; value: number; label?: string; window?: { kind: 'mean' | 'sustained'; minutes: number }; restingOnly?: boolean; env?: string; sex?: 'male' | 'female' }
  | { type: 'suddenDrop'; value: number; label?: string }
  | { type: 'belowBaseline'; sdFactor: number; avgDays: number; minReadings: number; label?: string }
  | { type: 'flag'; flag: string; label?: string }
  | { type: 'pctHrMax'; value: number; label?: string }

export interface MetricConfig {
  label: string
  unit: string
  /** 'info' = shown but never evaluated (no limit in the documents) */
  scope: 'crew' | 'cabin' | 'eva' | 'lab' | 'periodic' | 'info'
  caution: Rule[]
  critical: Rule[]
  emergency?: Rule
  absoluteLimit?: Rule
  /** 'trend' = 3 consecutive readings or 24 h average; 'direct' = the rule itself decides */
  cautionConfirm: 'trend' | 'direct'
  /** true = a red reading must be verified by a second reading (unless symptomatic) */
  criticalConfirm: boolean
  /** Caution is logged but not shown as an alert (EVA suit pressure, PICO₂) */
  cautionSilent?: boolean
  /** plain-language explanation for crew without medical training (from the alarm checklist) */
  explain?: string
  /** what to do, shown as the second line of an alert */
  action?: { caution?: string; critical?: string }
  openItems?: string[]
  source: string
}

export interface ThresholdConfig {
  baseline: {
    metrics: string[]; madScale: number; sigmaFloor: Record<string, number | null>; zCaution: number; zOrange: number; sustainedHours: number
    xWindowMin: number; minSessions: number; flightWindowDays: number; earlyFlightDays: number
    reference: Record<'microgravity' | 'landing' | 'surface', 'supine' | 'seated' | 'standing'>; landingHours: number; openItems: string[]; source: string
  }
  sexRules: Record<string, { sex?: string; topics?: string[]; rule: string; source?: string }>
  symptomDiary: { source: string; yellowSeverityMin: number; redSeverityMin: number; repeatDays: number }
  general: { confirmWindowMin: number; consecutiveCount: number; averageWindowHours: number }
  metrics: Record<string, MetricConfig>
  eva: {
    reserveMin: number
    returnMetFloorBtuh: number
    returnMetFactor: number
    o2LitrePerMinPerBtuh: number
    leak: { excessPct: number; windowMin: number }
    heatReferenceMin: number
    orthostatic: { gateBtuh: number; g: Record<string, number> }
    mismatch: { hrAbove: number; metabolicBelow: number }
    pico2ExpectedCurve: [number, number][]
    alertPriority: string[]
  }
  readiness: {
    defaultSleepNeedH: number
    sleep: { lastNightFactor: number; weekFactor: number; days: number }
    zMap: { freeAbove: number; slope: number }
    co2: { freeBelow: number; zeroAt: number; hours: number }
    weights: { sleep: number; hrv: number; cognition: number; co2: number }
    bands: { ready: number; caution: number }
    redGate: { sleepBelowH: number; nightsInRow: number }
    freshness: { hrvHours: number; cognitionDays: number; co2Hours: number }
  }
  crewOxygen: { windowMin: number; dropPoints: number; medianHours: number; lowValue: number; co2MeanMin: number }
  bone: { netLossMgDayAtR1: number; skeletalCaMg: number; ntxPlateauRise: number; levels: { caution: number; warning: number }; lossPctMonth: { caution: number; warning: number; critical: number } }
  muscle: { lossFullPct: number; risk: { caution: number; critical: number }; compliance: { caution: number; critical: number }; days: number }
  radiation: {
    careerLimitMSv: number
    speLimitMSv: number
    organ30d: { bfo: number; eye: number; skin: number }
    organYear: { bfo: number; eye: number; skin: number }
    normalRateMSvDay: number
    levels: { caution: number; warning: number; critical: number }
    rateAlarmFactor: number
    warningSScale: number
  }
  hexagon: { hrDeviationFullBpm: number; cautionRing: number; axes: { label: string; zero: string; full: string; basis: string; status: string }[] }
}

export interface EvalContext {
  symptomatic?: boolean
  exercising?: boolean
  baseline?: { mean: number; sd: number }
  flags?: Record<string, boolean>
  env?: string
  hrMax?: number
  sex?: 'male' | 'female'
}

export interface Status {
  level: Level
  /** red only: false while waiting for the verification reading */
  confirmed: boolean
  /** red only, unconfirmed: verify before this time (epoch ms) */
  confirmBy?: number
  /** latest reading is out of range but not yet an alarm ("one bad reading is not an alarm") */
  singleDeviation: boolean
  /** yellow that must be logged without a visible alert */
  silent: boolean
  emergency: boolean
  reason: string
  /** personal-baseline check (crew vitals): adds an early warning only */
  baseline?: import('./baseline').BaselineResult
}

export interface Notification {
  id: number
  time: number
  crewId: string | null
  metricId: string
  level: 'red'
  message: string
  /** who it is delivered to; always all three for a critical value */
  targets: ('crew' | 'earth' | 'screen')[]
  earth: 'sent' | 'queued'
  earthSentAt?: number
}

export type RecordKind = 'mental' | 'exercise' | 'meal' | 'mass' | 'water' | 'medication' | 'symptom' | 'menstrual' | 'value' | 'checkin'

/** Manual log entry from the personal input screen (Step 4a). */
export interface LogRecord {
  id: number
  kind: RecordKind
  crewId: string
  time: number
  data: Record<string, string | number | boolean | string[]>
}

export interface MissionDay {
  day: number
  total: number
  remaining: number
}
