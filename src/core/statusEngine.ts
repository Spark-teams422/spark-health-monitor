// Status engine (Step 1.4): measurements + threshold config in, green / yellow / red out.
// The only place that interprets thresholds. No numeric limit lives in this file.
import raw from '../config/thresholds.json'
import type { EvalContext, Level, Measurement, MetricConfig, Rule, Status, ThresholdConfig } from './types'

export const thresholds = raw as unknown as ThresholdConfig
const MIN = 60_000

export function metricConfig(metricId: string): MetricConfig {
  const cfg = thresholds.metrics[metricId]
  if (!cfg) throw new Error(`Unknown metric: ${metricId}`)
  return cfg
}

const cmp = (op: string, a: number, b: number) => (op === '<' ? a < b : op === '<=' ? a <= b : op === '>' ? a > b : a >= b)
const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length
const isSimple = (r: Rule) => !('type' in r) && !r.window

/** Does `rule` hold as of reading `i`? */
function holds(rule: Rule, ms: Measurement[], i: number, ctx: EvalContext): boolean {
  const m = ms[i]
  if ('type' in rule) {
    switch (rule.type) {
      case 'suddenDrop':
        return i > 0 && ms[i - 1].value - m.value >= rule.value
      case 'belowBaseline': {
        if (!ctx.baseline) return false
        const from = m.time - rule.avgDays * 24 * 60 * MIN
        const vals = ms.slice(0, i + 1).filter((x) => x.time > from).map((x) => x.value)
        return vals.length >= rule.minReadings && mean(vals) < ctx.baseline.mean - rule.sdFactor * ctx.baseline.sd
      }
      case 'flag':
        return !!ctx.flags?.[rule.flag]
      case 'pctHrMax':
        return ctx.hrMax !== undefined && m.value > (ctx.hrMax * rule.value) / 100
    }
  }
  if (rule.env && rule.env !== ctx.env) return false
  if (rule.sex && rule.sex !== ctx.sex) return false
  if (rule.restingOnly && ctx.exercising) return false
  if (!rule.window) return cmp(rule.op, m.value, rule.value)
  const from = m.time - rule.window.minutes * MIN
  const win = ms.slice(0, i + 1).filter((x) => x.time > from)
  if (rule.window.kind === 'mean') return cmp(rule.op, mean(win.map((x) => x.value)), rule.value)
  // sustained: every reading in the window violates, and the window is actually covered by data
  const covered = ms[0].time <= from + MIN
  return covered && win.every((x) => cmp(rule.op, x.value, rule.value))
}

function describe(cfg: MetricConfig, rule: Rule): string {
  if ('type' in rule) return `${cfg.label}: ${rule.label ?? rule.type}`
  const win = rule.window ? ` (${rule.window.minutes}-min ${rule.window.kind === 'mean' ? 'average' : 'sustained'})` : ''
  return `${cfg.label} ${rule.op} ${rule.value} ${cfg.unit}${win}${rule.label ? ` – ${rule.label}` : ''}`
}

/** Level of one value against the plain limits only (chart bands, quick checks). */
export function instantLevel(metricId: string, value: number, ctx: EvalContext = {}): Level {
  const cfg = metricConfig(metricId)
  const one = [{ metricId, crewId: null, value, unit: cfg.unit, time: 0 }]
  if (cfg.critical.some((r) => isSimple(r) && holds(r, one, 0, ctx))) return 'red'
  if (cfg.caution.some((r) => isSimple(r) && holds(r, one, 0, ctx))) return 'yellow'
  return 'green'
}

export interface Band {
  level: 'yellow' | 'red'
  /** the band covers values below / above `value` */
  side: 'below' | 'above'
  value: number
}

/** Threshold bands of a metric for charts: every numeric limit that applies in this context. */
export function thresholdBands(metricId: string, ctx: EvalContext = {}): Band[] {
  const cfg = metricConfig(metricId)
  const of = (rules: Rule[], level: Band['level']): Band[] =>
    rules.flatMap((r): Band[] => {
      if ('type' in r) {
        if (r.type === 'belowBaseline' && ctx.baseline) return [{ level, side: 'below', value: ctx.baseline.mean - r.sdFactor * ctx.baseline.sd }]
        return []
      }
      if ((r.env && r.env !== ctx.env) || (r.sex && r.sex !== ctx.sex) || (r.restingOnly && ctx.exercising)) return []
      return [{ level, side: r.op.startsWith('<') ? 'below' : 'above', value: r.value }]
    })
  return [...of(cfg.caution, 'yellow'), ...of(cfg.critical, 'red')]
}

/**
 * Evaluate a metric from its reading history (oldest first).
 * - Red: a red reading must be verified by a second reading within `confirmWindowMin`
 *   (status stays red/unconfirmed meanwhile). A symptom skips verification.
 * - Yellow: 3 consecutive out-of-range readings or the 24 h average out of range.
 *   A single out-of-range reading is only flagged as `singleDeviation`.
 */
export function evaluate(metricId: string, ms: Measurement[], ctx: EvalContext = {}): Status {
  const cfg = metricConfig(metricId)
  const base = { confirmed: false, singleDeviation: false, silent: false, emergency: false, reason: '' }
  if (ms.length === 0) return { ...base, level: 'nodata', reason: 'No data' }
  const g = thresholds.general
  const last = ms.length - 1
  const emergency = !!cfg.emergency && holds(cfg.emergency, ms, last, ctx)

  const red = cfg.critical.find((r) => holds(r, ms, last, ctx))
  if (red) {
    const needsConfirm = cfg.criticalConfirm && isSimple(red) && !ctx.symptomatic
    const prevRed = last > 0 && cfg.critical.some((r) => isSimple(r) && holds(r, ms, last - 1, ctx))
    const confirmed = !needsConfirm || prevRed
    return {
      ...base,
      level: 'red',
      confirmed,
      confirmBy: confirmed ? undefined : ms[last].time + g.confirmWindowMin * MIN,
      emergency,
      reason: describe(cfg, red),
    }
  }

  const outOfRange = (i: number) => [...cfg.critical, ...cfg.caution].some((r) => isSimple(r) && holds(r, ms, i, ctx))
  const yellowNow = cfg.caution.find((r) => holds(r, ms, last, ctx))
  const yellow = (rule: Rule, suffix = ''): Status => ({
    ...base,
    level: 'yellow',
    silent: !!cfg.cautionSilent,
    emergency,
    reason: describe(cfg, rule) + suffix,
  })

  if (yellowNow && (cfg.cautionConfirm === 'direct' || !isSimple(yellowNow))) return yellow(yellowNow)

  if (cfg.cautionConfirm === 'trend') {
    const n = g.consecutiveCount
    if (yellowNow && ms.length >= n && ms.slice(-n).every((_, k) => outOfRange(ms.length - n + k))) {
      return yellow(yellowNow, ` (${n} consecutive readings)`)
    }
    const from = ms[last].time - g.averageWindowHours * 60 * MIN
    const day = ms.filter((x) => x.time > from)
    if (day.length >= n) {
      const avg = [{ ...ms[last], value: mean(day.map((x) => x.value)) }]
      const avgRule = cfg.caution.find((r) => isSimple(r) && holds(r, avg, 0, ctx))
      if (avgRule) return yellow(avgRule, ` (${g.averageWindowHours}-h average)`)
    }
  }

  return {
    ...base,
    level: 'green',
    singleDeviation: outOfRange(last),
    emergency,
    reason: outOfRange(last) ? 'Single out-of-range reading – repeat the measurement' : 'Within normal range',
  }
}

/** Worst level of several statuses (e.g. systolic + diastolic in one tile). */
export function worst(...statuses: Status[]): Status {
  const rank = { nodata: 0, green: 1, yellow: 2, red: 3 }
  return statuses.reduce((a, b) => (rank[b.level] > rank[a.level] ? b : a))
}
