// Radiation planning layer (team document "Route Radiation Planning Layer", 15 Nov 2026).
import { describe, expect, it } from 'vitest'
import { cautionMGyDay, classify, intervals, leoPeriodMin, leoPosition, leoRate, longestQuiet, marsCumulative, moonBelt, moonRate, saaCentre, series, windows } from './routeRadiation'

const t0 = Date.parse('2026-11-14T00:00:00Z')
const H = 3600_000

describe('route radiation planning layer', () => {
  it('ISS-type orbit: about 92 min period, latitude within ±51.6°', () => {
    expect(leoPeriodMin()).toBeGreaterThan(92)
    expect(leoPeriodMin()).toBeLessThan(93)
    const lats = Array.from({ length: 200 }, (_, i) => leoPosition(t0 + i * 60_000, t0).lat)
    expect(Math.max(...lats)).toBeLessThanOrEqual(51.61)
    expect(Math.min(...lats)).toBeGreaterThanOrEqual(-51.61)
  })
  it('caution class comes from the radiation document (1.3 mSv/day deep space at Q = 1); the SAA core is yellow, background is not', () => {
    expect(cautionMGyDay()).toBe(1.3)
    const c = saaCentre(t0)
    expect(classify(leoRate(c.lat, c.lon, t0))).toBe('yellow')
    expect(classify(leoRate(0, 120, t0))).toBe('none')
    expect(c.lon).toBeLessThan(-55) // drifts west
  })
  it('a 24 h LEO forecast has SAA passes (extra) and the range always holds the middle value', () => {
    const s = series(t0, t0 + 24 * H, 60_000, (t) => { const p = leoPosition(t, t0); return leoRate(p.lat, p.lon, t) })
    expect(intervals(s, (x) => x.extra).length).toBeGreaterThan(3)
    expect(s.every((x) => x.rate.lo <= x.rate.mid && x.rate.mid <= x.rate.hi)).toBe(true)
    expect(longestQuiet(s)).toBeGreaterThan(0)
    expect(windows(s, 0.5).length).toBeGreaterThan(0)
  })
  it('lunar transit: inner belt crossed outbound and on return; attitude change halves the belt term', () => {
    const hours = Array.from({ length: 25.5 * 24 * 12 }, (_, i) => i / 12)
    const inner = hours.filter((h) => moonBelt(h) === 'inner')
    expect(inner[0]).toBeLessThan(6)
    expect(inner.at(-1)!).toBeGreaterThan(20 * 24)
    const h = inner[Math.floor(inner.length / 4)]
    const a = moonRate(h, { shield: 'leastShielded', attitude: false }), b = moonRate(h, { shield: 'leastShielded', attitude: true })
    expect(b.belt).toBeCloseTo(a.belt * 0.5, 6)
  })
  it('Mars: cumulative band = 0.5 mSv/day ± 10 %', () => {
    const c = marsCumulative(100)
    expect([c.lo, c.mid, c.hi].map((v) => Math.round(v))).toEqual([45, 50, 55])
  })
})

describe('EVA radiation risk index', () => {
  it('ERI = max(route, own dose, solar event); steps 0.5 / 0.8 / 1.0; limit 0.8', async () => {
    const { evaRisk, riskLevel, riskZones, greenWindows, RISK } = await import('./routeRadiation')
    expect([0.3, 0.6, 0.85, 1.2].map(riskLevel)).toEqual(['green', 'yellow', 'orange', 'red'])
    expect(RISK.limit).toBe(0.8)
    const s = series(t0, t0 + 24 * H, 60_000, (t) => { const p = leoPosition(t, t0); return leoRate(p.lat, p.lon, t) })
    const quiet = greenWindows(s)[0]
    if (quiet) expect(evaRisk(s, quiet.from, 1).level).toBe('green')
    const zone = riskZones(s)[0]
    expect(evaRisk(s, zone.from, 0).index).toBeGreaterThanOrEqual(0.5)
    expect(evaRisk(s, t0, 0, { doseRatio: 0.9 }).driver).toBe('dose')
    expect(evaRisk(s, t0, 0, { sepActive: true }).level).toBe('red')
  })
})
