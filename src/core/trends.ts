// Early warning by trend projection (config/trends.json). Daily means, Theil–Sen slope with a 25–75 % range, projected
// to the limits that already exist in thresholds.json. Never an alarm, never a diagnosis or a probability.
import cfg from '../config/trends.json'
import { thresholdBands, type Band } from './statusEngine'
import type { EvalContext, Level, Measurement } from './types'

const DAY = 86_400_000
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}
const quantile = (xs: number[], q: number) => {
  const s = [...xs].sort((a, b) => a - b)
  const i = (s.length - 1) * q, lo = Math.floor(i), hi = Math.ceil(i)
  return s[lo] + (s[hi] - s[lo]) * (i - lo)
}

/** Mean per UTC day over the last `days` days. */
export function dailyMeans(ms: Measurement[], now: number, days = cfg.windowDays): { day: number; value: number }[] {
  const from = Math.floor(now / DAY) - days + 1
  const g = new Map<number, number[]>()
  for (const m of ms) {
    const d = Math.floor(m.time / DAY)
    if (d >= from && m.time <= now) g.set(d, [...(g.get(d) ?? []), m.value])
  }
  return [...g.entries()].sort((a, b) => a[0] - b[0]).map(([day, v]) => ({ day, value: v.reduce((s, x) => s + x, 0) / v.length }))
}

/** Theil–Sen: median of the pairwise slopes (per day) and their 25th / 75th percentiles. */
export function theilSen(pts: { day: number; value: number }[]) {
  const slopes: number[] = []
  for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) slopes.push((pts[j].value - pts[i].value) / (pts[j].day - pts[i].day))
  if (!slopes.length) return null
  const slope = median(slopes)
  const intercept = median(pts.map((p) => p.value - slope * p.day))
  return { slope, lo: quantile(slopes, 0.25), hi: quantile(slopes, 0.75), intercept }
}

export type TrendState = 'beyond' | 'approaching' | 'stable' | 'nodata'
export interface Projection {
  metricId: string
  points: { day: number; value: number }[]
  recent: number | null
  slope: number
  fit: (day: number) => number
  /** the limit the trend is heading to (or already past) */
  band: Band | null
  /** a limit the recent mean is already past (while heading to the next one) */
  passed: Band | null
  state: TrendState
  /** days until the median trend crosses `band`, and the range from the slope quartiles (null = beyond the horizon) */
  days: number | null
  range: [number | null, number | null] | null
  level: Level
}

const past = (b: Band, v: number) => (b.side === 'below' ? v < b.value : v > b.value)

/** Where the trend of one metric goes, relative to its caution and critical values. */
export function project(metricId: string, ms: Measurement[], now: number, ctx: EvalContext = {}, windowDays = cfg.windowDays): Projection {
  const points = dailyMeans(ms, now, windowDays)
  const today = Math.floor(now / DAY)
  const empty: Projection = { metricId, points, recent: null, slope: 0, fit: () => NaN, band: null, passed: null, state: 'nodata', days: null, range: null, level: 'nodata' }
  if (points.length < cfg.minDays) return empty
  const ts = theilSen(points)!
  const fit = (d: number) => ts.intercept + ts.slope * d
  const recentPts = points.filter((p) => p.day > today - cfg.recentDays)
  const recent = (recentPts.length ? recentPts : points.slice(-1)).reduce((s, p) => s + p.value, 0) / (recentPts.length || 1)
  const bands = thresholdBands(metricId, ctx).filter((b) => b.level === 'yellow' || b.level === 'red')
  const base = { metricId, points, recent, slope: ts.slope, fit }
  // already past a limit (recent mean): the worst one
  const passed = bands.filter((b) => past(b, recent)).sort((a) => (a.level === 'red' ? -1 : 1))[0]
  // the next limit the trend is heading to
  const passedBand = passed ?? null
  const ahead = bands
    .filter((b) => !past(b, recent) && ((b.side === 'below' && ts.slope < 0) || (b.side === 'above' && ts.slope > 0)))
    .map((b) => ({ b, d: (b.value - fit(today)) / ts.slope }))
    .filter((x) => x.d > 0)
    .sort((a, b) => a.d - b.d)[0]
  const daysWith = (s: number, b: Band) => { const d = (b.value - fit(today)) / s; return s !== 0 && d > 0 && d <= cfg.horizonDays ? d : null }
  if (passed && passed.level === 'red') return { ...base, band: passed, passed: passedBand, state: 'beyond', days: 0, range: null, level: 'red' }
  if (ahead && ahead.d <= cfg.horizonDays) {
    const r1 = daysWith(ts.lo, ahead.b), r2 = daysWith(ts.hi, ahead.b)
    const range: [number | null, number | null] = [Math.min(...[r1, r2].filter((x): x is number => x !== null), ahead.d), [r1, r2].some((x) => x === null) ? null : Math.max(r1!, r2!)]
    return { ...base, band: ahead.b, passed: passedBand, state: 'approaching', days: ahead.d, range, level: passed ? 'yellow' : ahead.b.level === 'red' ? 'red' : 'yellow' }
  }
  if (passed) return { ...base, band: passed, passed: passedBand, state: 'beyond', days: 0, range: null, level: 'yellow' }
  return { ...base, band: null, passed: null, state: 'stable', days: null, range: null, level: 'green' }
}

export const TRENDS = cfg
