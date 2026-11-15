// Radiation planning layer along the route (team document "Route Radiation Planning Layer", 15 Nov 2026).
// Pure functions: position along the route, forecast dose rate (a range, never one number), colour class against the
// radiation document's caution limit, "extra" (belt) intervals and EVA windows. FORECAST only: no alarm comes from here.
import cfg from '../config/routeRadiation.json'
import { thresholds, thresholdBands } from './statusEngine'

const HOUR = 3600_000
const DEG = Math.PI / 180
export type RouteCase = 'leo' | 'moon' | 'mars'
export type RClass = 'none' | 'yellow'
/** forecast dose rate as a range, absorbed, mGy/day */
export interface Rate { lo: number; mid: number; hi: number; belt: number; gcr: number }

const uGyHToMGyDay = (x: number) => (x * 24) / 1000
const uGyMinToMGyDay = (x: number) => (x * 1440) / 1000

/** Caution dose rate from the radiation document (mSv/day, deep space), as absorbed mGy/day at the configured Q. */
export function cautionMGyDay(): number {
  const b = thresholdBands('radiation_rate', { env: cfg.classes.env }).find((x) => x.level === 'yellow')
  return (b?.value ?? Infinity) / cfg.classes.qualityFactor
}
export const classify = (r: Rate): RClass => (r.mid >= cautionMGyDay() ? 'yellow' : 'none')
export const isExtra = (r: Rate) => r.belt > cfg.extraRatio.value * r.gcr

// ---------- LEO: circular orbit ground track + DOSTEL-calibrated GCR + SAA ----------
const L = cfg.leo
export const leoPeriodMin = () => {
  const a = L.earthRadiusKm + L.altitudeKm
  return (2 * Math.PI * Math.sqrt(a ** 3 / L.muKm3s2)) / 60
}
/** Ground track at time t (circular orbit, ascending node at lon 0 at t0; SAMPLE phase). */
export function leoPosition(t: number, t0: number) {
  const s = (t - t0) / 1000
  const u = (2 * Math.PI * s) / (leoPeriodMin() * 60)
  const i = L.inclinationDeg * DEG
  const lat = Math.asin(Math.sin(i) * Math.sin(u)) / DEG
  const lonInertial = Math.atan2(Math.cos(i) * Math.sin(u), Math.cos(u)) / DEG
  const lon = ((((lonInertial - (360 * s) / L.siderealDayS) % 360) + 540) % 360) - 180
  return { lat, lon, altKm: L.altitudeKm }
}
/** SAA centre, drifting west about 0.3°/year (SPENVIS). */
export function saaCentre(t: number) {
  const years = new Date(t).getUTCFullYear() + new Date(t).getUTCMonth() / 12 - L.saa.refYear
  return { lat: L.saa.latDeg, lon: L.saa.lonDeg - L.saa.driftWestDegPerYear * years }
}
export function leoRate(lat: number, lon: number, t: number): Rate {
  const g = L.gcrUGyH.low + (L.gcrUGyH.high - L.gcrUGyH.low) * Math.min(1, Math.abs(lat) / L.inclinationDeg) ** 2
  const c = saaCentre(t)
  const dLon = ((lon - c.lon + 540) % 360) - 180
  const belt = L.saa.peakUGyH * Math.exp(-0.5 * (((lat - c.lat) / L.saa.sigmaLatDeg) ** 2 + (dLon / L.saa.sigmaLonDeg) ** 2))
  const u = L.uncertainty
  return {
    gcr: uGyHToMGyDay(g), belt: uGyHToMGyDay(belt), mid: uGyHToMGyDay(g + belt),
    lo: uGyHToMGyDay(g * (1 - u.gcr) + belt * (1 - u.trapped)), hi: uGyHToMGyDay(g * (1 + u.gcr) + belt * (1 + u.trapped)),
  }
}

// ---------- Moon: Artemis-I-type outbound / return with belt crossings ----------
const M = cfg.moon
/** Distance from Earth's centre (km) at hours since launch (SAMPLE profile). */
export function moonDistance(h: number) {
  const R = 6371 + 185, D = M.moonDistanceKm
  const leg = (x: number) => R + (D - R) * Math.min(1, Math.max(0, x / (M.outboundHours - M.tliHour))) ** (2 / 3)
  const back = M.durationDays * 24 - h
  if (h < M.tliHour || back < 0) return R
  if (h >= M.returnStartDay * 24) return leg(back)
  return leg(h - M.tliHour)
}
export function moonRate(h: number, opts: { shield: 'mostShielded' | 'leastShielded'; attitude: boolean }): Rate {
  const alt = moonDistance(h) - 6371
  const [a, b] = M.innerBeltKm
  const inner = alt > a && alt < b ? Math.sin((Math.PI * (alt - a)) / (b - a)) : 0
  const belt = uGyMinToMGyDay(M.innerPeakUGyMin[opts.shield] * inner) * (opts.attitude ? M.attitudeFactor.value : 1)
  const gcr = thresholds.radiation.normalRateMSvDay / cfg.classes.qualityFactor * (moonDistance(h) > M.lunarShadow.fromKm ? M.lunarShadow.factor : 1)
  return { gcr, belt, mid: gcr + belt, lo: gcr + belt * (1 - M.uncertainty), hi: gcr + belt * (1 + M.uncertainty) }
}
export const moonBelt = (h: number): 'inner' | 'outer' | null => {
  const alt = moonDistance(h) - 6371
  return alt > M.innerBeltKm[0] && alt < M.innerBeltKm[1] ? 'inner' : alt > M.outerBeltKm[0] && alt < M.outerBeltKm[1] ? 'outer' : null
}

// ---------- Mars: GCR only, cumulative band ----------
export function marsCumulative(days: number) {
  const r = thresholds.radiation.normalRateMSvDay, u = cfg.mars.uncertainty
  return { lo: r * (1 - u) * days, mid: r * days, hi: r * (1 + u) * days }
}

// ---------- series, extra intervals and EVA windows (step 5) ----------
export interface Sample { time: number; rate: Rate; cls: RClass; extra: boolean }
export function series(from: number, to: number, stepMs: number, rateAt: (t: number) => Rate): Sample[] {
  const out: Sample[] = []
  for (let t = from; t <= to; t += stepMs) {
    const rate = rateAt(t)
    out.push({ time: t, rate, cls: classify(rate), extra: isExtra(rate) })
  }
  return out
}
/** Continuous intervals where `test` holds. */
export function intervals(s: Sample[], test: (x: Sample) => boolean) {
  const out: { from: number; to: number }[] = []
  let start: number | null = null
  s.forEach((x, i) => {
    if (test(x) && start === null) start = x.time
    if ((!test(x) || i === s.length - 1) && start !== null) { out.push({ from: start, to: test(x) ? x.time : s[i - 1].time }); start = null }
  })
  return out
}
/** Green (uncoloured) windows at least `hours` long: candidates for an EVA or risky work (document step 5, proposal). */
export const windows = (s: Sample[], hours = cfg.requiredWindowH) => intervals(s, (x) => x.cls === 'none' && !x.extra).filter((w) => w.to - w.from >= hours * HOUR)
export const longestQuiet = (s: Sample[]) => intervals(s, (x) => x.cls === 'none' && !x.extra).reduce((m, w) => Math.max(m, w.to - w.from), 0)

/** Ground-track polylines (SVG x = lon + 180, y = 90 − lat), split where the longitude wraps or the class changes. */
export function trackSegments(s: Sample[], t0: number) {
  const segs: { pts: string[]; cls: string }[] = []
  s.forEach((x, i) => {
    const p = leoPosition(x.time, t0), prev = i ? leoPosition(s[i - 1].time, t0) : null
    const key = x.extra ? 'extra' : x.cls
    if (!segs.length || segs[segs.length - 1].cls !== key || (prev && Math.abs(p.lon - prev.lon) > 180)) segs.push({ pts: [], cls: key })
    segs[segs.length - 1].pts.push(`${(p.lon + 180).toFixed(1)},${(90 - p.lat).toFixed(1)}`)
  })
  return segs
}

/** SAA field on a 4° grid for the map: cells where the forecast belt term is above the background. */
export function saaCells(t: number, size = 4) {
  const cells: { x: number; y: number; o: number; size: number }[] = []
  for (let lat = -60; lat < 60; lat += size) for (let lon = -180; lon < 180; lon += size) {
    const r = leoRate(lat + size / 2, lon + size / 2, t)
    if (r.belt > r.gcr) cells.push({ x: lon + 180, y: 90 - lat - size, o: Math.min(0.75, 0.15 + r.belt / 12), size })
  }
  return cells
}

// ---------- EVA radiation risk index (team design; config: routeRadiation.json -> evaRisk) ----------
export type RiskLevel = 'green' | 'yellow' | 'orange' | 'red'
/** Radiation document steps 0.5 / 0.8 / 1.0 (Caution / Warning / Critical). */
export function riskLevel(x: number): RiskLevel {
  const L = thresholds.radiation.levels
  return x >= L.critical ? 'red' : x >= L.warning ? 'orange' : x >= L.caution ? 'yellow' : 'green'
}
export const RISK = cfg.evaRisk
export const riskInfo = (l: RiskLevel) => cfg.evaRisk.levels.find((x) => x.id === l)!
/** R_route of one sample: upper-bound forecast dose rate ÷ caution dose rate. */
export const routeRatio = (r: Rate) => r.hi / cautionMGyDay()

export interface EvaRisk { index: number; level: RiskLevel; route: number; dose: number; sep: number; driver: 'route' | 'dose' | 'sep' }
/** ERI for an EVA from `from` lasting `hours`: max(R_route over the window, R_dose, R_sep). */
export function evaRisk(s: Sample[], from: number, hours: number, opts: { doseRatio?: number | null; sepActive?: boolean } = {}): EvaRisk {
  let inWin = s.filter((x) => x.time >= from && x.time <= from + hours * HOUR)
  if (!inWin.length && s.length) inWin = [s.reduce((a, x) => (Math.abs(x.time - from) < Math.abs(a.time - from) ? x : a))] // "now": nearest sample
  const route = Math.max(0, ...inWin.map((x) => routeRatio(x.rate)))
  const dose = opts.doseRatio ?? 0
  const sep = opts.sepActive ? 1 : 0
  const index = Math.max(route, dose, sep)
  const driver = index === sep && sep > 0 ? 'sep' : index === dose && dose >= route ? 'dose' : 'route'
  return { index, level: riskLevel(index), route, dose, sep, driver }
}
/** Radiation zones: continuous stretches whose route ratio is at or above the Caution step, with their worst level. */
export function riskZones(s: Sample[]) {
  return intervals(s, (x) => riskLevel(routeRatio(x.rate)) !== 'green').map((z) => {
    const peak = Math.max(...s.filter((x) => x.time >= z.from && x.time <= z.to).map((x) => routeRatio(x.rate)))
    return { ...z, peak, level: riskLevel(peak) }
  })
}
/** EVA windows: stretches of at least `hours` where the route ratio stays green. */
export const greenWindows = (s: Sample[], hours = cfg.requiredWindowH) => intervals(s, (x) => riskLevel(routeRatio(x.rate)) === 'green').filter((w) => w.to - w.from >= hours * HOUR)
