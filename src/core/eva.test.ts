// Step 3 "done" criterion: in the EVA scenarios every item reaches the right level,
// and suit pressure / inspired CO₂ only show an alert when critical.
import { describe, expect, it } from 'vitest'
import { expectedPico2, returnMetabolicRate, timeBudget } from './eva'
import GT from './gtransit/core.js'
import { HealthSystem, metricIds } from './system'
import type { ScenarioId } from './simulator'
import type { Level } from './types'

/** Run a scenario and record, per metric, the first minute each level was reached. */
function trace(scenario: ScenarioId, ticks: number) {
  const sys = new HealthSystem()
  sys.setScenario(scenario)
  const first = new Map<string, number>()
  const shown = new Map<string, number>() // first minute the metric appeared as a visible alert
  for (let t = 1; t <= ticks; t++) {
    sys.tick()
    for (const id of metricIds('eva')) {
      const st = sys.status(id, 'A3')
      const key = `${id}:${st.level}${st.silent ? ':silent' : ''}`
      if (!first.has(key)) first.set(key, t)
    }
    for (const a of sys.evaAlerts()) if (!shown.has(`${a.metricId}:${a.status.level}`)) shown.set(`${a.metricId}:${a.status.level}`, t)
  }
  const at = (id: string, level: Level, silent = false) => first.get(`${id}:${level}${silent ? ':silent' : ''}`)
  return { sys, at, shown }
}

describe('time budget (M1)', () => {
  const o2 = { id: 'o2', label: 'O₂', unit: 'L', quantity: 300, ratePerMin: 0.86, scalesWithMet: true }
  const battery = { id: 'battery', label: 'Battery', unit: 'min', quantity: 430, ratePerMin: 1, scalesWithMet: false }
  it('return uses at least 2374 BTU/h or 1.35 x the current rate', () => {
    expect(returnMetabolicRate(900)).toBe(2374)
    expect(returnMetabolicRate(2000)).toBe(2700)
  })
  it('return-by keeps the return trip and the 30-min reserve aside', () => {
    const b = timeBudget([o2, battery], 1000, 40)
    expect(b.remaining).toBeCloseTo(300 / 0.86, 3)
    expect(b.margin).toBeCloseTo(300 / 0.86 - 40, 3)
    // (300 - 40 min x 0.86 x 2.374 - 30 min x 0.86) / 0.86
    expect(b.returnBy).toBeCloseTo((300 - 40 * 0.86 * 2.374 - 30 * 0.86) / 0.86, 3)
    expect(b.limitingId).toBe('o2')
  })
  it('expected PICO₂ follows the Kim 2020 points', () => {
    expect(expectedPico2(1000)).toBeCloseTo(8.09)
    expect(expectedPico2(1500)).toBeCloseTo(9.74)
  })
})

describe('G-TRANSIT suit mode matches the team reference scenarios', () => {
  const base = { tcore0: 36.8, hr0: 62, rmssd0: 45, k_i: 1.0, beta1: 15, met_rest: 400 }
  const sample = { phase: 'eva', g: 3.721, tilt_deg: 90, cos_theta: 1, tcore: 38.8, tskin: 36.0, pv_deficit: 0.18, map_heart: null, dtsi: null, sqi: { thermal: 0.95, cardio: 0.95 } }
  const ori = (extra: object) => new GT.Engine(GT.DEFAULT_CONFIG, base, { snapshot: true }).step({ ...sample, ...extra }).ori
  it('S6 tired and hot: ORI 61.7', () => expect(ori({ hr: 125, rmssd: 20, met_btuh: 600 })).toBeCloseTo(61.7, 1))
  it('S7 high effort: heart rate excluded, ORI 68.0', () => expect(ori({ hr: 150, rmssd: 12, met_btuh: 1500 })).toBeCloseTo(68.0, 1))
})

describe('EVA scenarios', () => {
  it('nominal: everything green, no alert, no notification', () => {
    const { sys } = trace('eva', 60)
    // the HR-rise rule is not evaluated above the 700 BTU/h effort gate -> "no data", never a false green
    for (const id of metricIds('eva')) expect(sys.status(id, 'A3').level, id).toBe(id === 'eva_orthostatic_hr_rise' ? 'nodata' : 'green')
    expect(sys.evaAlerts()).toEqual([])
    expect(sys.notifications.list).toHaveLength(0)
    expect(sys.eva?.derived.budget.limitingId).toBe('o2')
  })

  it('O₂ margin shrinking: margin goes yellow, then return-by goes red and notifies', () => {
    const { sys, at } = trace('evaWorkload', 60)
    expect(at('eva_margin', 'yellow')).toBeLessThan(at('eva_return_by', 'red')!)
    expect(at('eva_metabolic_rate', 'yellow')).toBeDefined()
    expect(sys.notifications.list.some((n) => n.metricId === 'eva_return_by' && n.crewId === 'A3')).toBe(true)
    expect(sys.evaAlerts()[0].action).toContain('return')
  })

  it('CO₂ rising: silent while Caution, visible alert only when Critical', () => {
    const { sys, at, shown } = trace('evaCo2', 30)
    expect(at('eva_pico2_excess', 'yellow', true)).toBeLessThan(at('eva_pico2', 'red')!)
    expect(at('eva_pico2', 'yellow', true)).toBeDefined()
    expect(shown.has('eva_pico2:yellow')).toBe(false)
    expect(shown.has('eva_pico2_excess:yellow')).toBe(false)
    expect(shown.get('eva_pico2:red')).toBe(at('eva_pico2', 'red'))
    expect(sys.notifications.list.some((n) => n.metricId === 'eva_pico2')).toBe(true)
  })

  it('slow leak: silent Caution, leak suspicion, then Critical; one root cause gives one alert', () => {
    const { sys, at, shown } = trace('evaLeak', 20)
    expect(at('eva_suit_pressure', 'yellow', true)).toBeLessThan(at('eva_suit_pressure', 'red')!)
    expect(shown.has('eva_suit_pressure:yellow')).toBe(false)
    expect(at('eva_o2', 'yellow')).toBeDefined()
    expect(sys.status('eva_suit_pressure', 'A3').level).toBe('red')
    expect(sys.evaAlerts()[0].metricId).toBe('eva_suit_pressure')
    expect(sys.evaAlerts().some((a) => a.metricId === 'eva_o2')).toBe(false)
  })

  it('cooling degraded: Caution on temperature rise, Critical at the core limit', () => {
    const { at } = trace('evaCooling', 35)
    expect(at('eva_core_rise', 'yellow')).toBeLessThan(at('eva_core_temp', 'red')!)
  })

  it('orthostatic intolerance: Caution on HR rise, Critical on pre-syncope', () => {
    const { sys, at } = trace('evaOrtho', 20)
    expect(at('eva_orthostatic_hr_rise', 'yellow')).toBeLessThan(at('eva_ori', 'red')!)
    expect(sys.eva?.derived.ori?.ori).toBeGreaterThan(40)
  })

  it('backup O₂, solar event, mismatch and partner scenarios go Critical', () => {
    expect(trace('evaBackupO2', 6).at('eva_o2', 'red')).toBeDefined()
    const solar = trace('evaSolar', 14)
    expect(solar.at('eva_radiation', 'yellow')).toBeLessThan(solar.at('eva_radiation', 'red')!)
    expect(trace('evaMismatch', 6).at('eva_heart_rate', 'red')).toBeDefined()
    const partner = trace('evaPartner', 12)
    expect(partner.at('eva_partner_voice_loss', 'yellow')).toBeLessThan(partner.at('eva_partner_voice_loss', 'red')!)
  })

  it('every EVA metric with a visible alert has an action line', () => {
    const { sys } = trace('evaLeak', 20)
    for (const a of sys.evaAlerts()) expect(a.action, a.metricId).not.toBe('')
  })
})
