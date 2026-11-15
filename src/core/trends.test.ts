// Early warning: Theil–Sen trend projected to the existing limits.
import { describe, expect, it } from 'vitest'
import { dailyMeans, project, theilSen } from './trends'
import { HealthSystem } from './system'
import type { Measurement } from './types'

const DAY = 86_400_000
const now = Date.parse('2026-11-14T09:00:00Z')
const series = (id: string, f: (d: number) => number, days = 14): Measurement[] =>
  Array.from({ length: days }, (_, i) => ({ metricId: id, crewId: 'A1', value: f(i), unit: '', time: now - (days - 1 - i) * DAY - 3600_000 }))

describe('trend projection', () => {
  it('Theil–Sen ignores one bad day', () => {
    const pts = Array.from({ length: 10 }, (_, i) => ({ day: i, value: 2 * i + (i === 5 ? 50 : 0) }))
    expect(theilSen(pts)!.slope).toBeCloseTo(2, 5)
  })
  it('a falling water intake is projected to its limits; a flat one is stable', () => {
    const falling = project('water_l', series('water_l', (i) => 3.2 - 0.03 * i), now)
    expect(falling.state).toBe('approaching')
    expect(falling.band?.value).toBe(2.5)
    expect(falling.days!).toBeGreaterThan(0)
    expect(falling.days!).toBeLessThan(21)
    expect(project('water_l', series('water_l', () => 2.8), now).state).toBe('stable')
    expect(project('water_l', series('water_l', () => 1.2), now)).toMatchObject({ state: 'beyond', level: 'red' })
    expect(dailyMeans(series('water_l', () => 1), now)).toHaveLength(14)
  })
  it('sample crew: A4 kidney stone risk factors, A2 fatigue factors; no card for A1', () => {
    const sys = new HealthSystem()
    expect(sys.earlyWarning('A4').cards.map((c) => c.id)).toContain('kidney')
    expect(sys.earlyWarning('A2').cards.map((c) => c.id)).toContain('fatigue')
    expect(sys.earlyWarning('A1').cards).toHaveLength(0)
  })
})
