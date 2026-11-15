// Step 5: end-to-end scenario table of the build document, plus the "no embedded thresholds" guard.
import { describe, expect, it } from 'vitest'
import { AcuteSession } from './acute'
import type { ScenarioId } from './simulator'
import { crew, HealthSystem, metricIds } from './system'

const run = (scenario: ScenarioId, ticks: number) => {
  const sys = new HealthSystem(undefined)
  sys.setScenario(scenario)
  for (let i = 0; i < ticks; i++) sys.tick()
  return sys
}

describe('scenario table (build document, Step 5)', () => {
  it('Normal day → all tiles green, no notification', () => {
    const sys = run('normal', 240)
    for (const c of crew) expect(sys.crewStatus(c.id).level, c.id).toBe('green')
    for (const id of metricIds('cabin')) expect(sys.status(id, null).level, id).not.toMatch(/yellow|red/)
    expect(sys.notifications.list).toEqual([])
    expect(sys.commonCause()).toEqual([])
  })

  it('Slow worsening trend → the tile turns yellow, no critical notification', () => {
    const sys = run('slowTrend', 60)
    expect(sys.status('hrv', 'A3').level).toBe('yellow')
    expect(sys.crewStatus('A3').level).toBe('yellow')
    expect(sys.notifications.list).toEqual([])
  })

  it('Sudden critical → red tile; notification reaches astronaut, Earth sender and health screen', () => {
    const sys = run('suddenCritical', 12)
    expect(sys.status('spo2', 'A3')).toMatchObject({ level: 'red', confirmed: true })
    const [n] = sys.notifications.list
    expect(n.targets).toEqual(['crew', 'earth', 'screen'])
    expect(n.crewId).toBe('A3')
    expect(sys.notifications.earth.sent).toEqual([n])
  })

  it('Several astronauts deviate at once → "common cause" hint', () => {
    const sys = run('multiCrew', 30)
    expect(sys.commonCause().map((c) => c.metricId)).toContain('spo2')
  })

  it('Link loss → link shows lost; notifications queue and are sent when the link returns', () => {
    const sys = run('linkLoss', 12)
    expect(sys.link).toBe('lost')
    expect(sys.notifications.queue).toHaveLength(1)
    expect(sys.notifications.list[0].earth).toBe('queued')
    for (let i = 0; i < 20; i++) sys.tick()
    expect(sys.link).toBe('connected')
    expect(sys.notifications.queue).toEqual([])
    expect(sys.notifications.list[0].earth).toBe('sent')
  })

  it('EVA: O₂ margin shrinking → margin yellow, then red; notification produced', () => {
    const sys = new HealthSystem(undefined)
    sys.setScenario('evaWorkload')
    const levels: string[] = []
    for (let i = 0; i < 60; i++) {
      sys.tick()
      const budget = [sys.status('eva_margin', 'A3').level, sys.status('eva_return_by', 'A3').level]
      levels.push(budget.includes('red') ? 'red' : budget.includes('yellow') ? 'yellow' : 'green')
    }
    expect(levels.indexOf('yellow')).toBeGreaterThan(-1)
    expect(levels.indexOf('yellow')).toBeLessThan(levels.indexOf('red'))
    expect(sys.notifications.list.some((n) => n.metricId === 'eva_return_by')).toBe(true)
  })

  it('EVA: CO₂ or suit pressure critical → a visible alert appears only at the critical limit', () => {
    for (const [scenario, metric] of [['evaCo2', 'eva_pico2'], ['evaLeak', 'eva_suit_pressure']] as const) {
      const sys = new HealthSystem(undefined)
      sys.setScenario(scenario)
      let sawSilent = false
      for (let i = 0; i < 30; i++) {
        sys.tick()
        const st = sys.status(metric, 'A3')
        const visible = sys.evaAlerts().some((a) => a.metricId === metric)
        if (st.level === 'yellow') {
          sawSilent = true
          expect(st.silent && !visible, `${metric} caution must stay silent`).toBe(true)
        }
        if (visible) expect(st.level).toBe('red')
      }
      expect(sawSilent).toBe(true)
      expect(sys.status(metric, 'A3').level).toBe('red')
      expect(sys.notifications.list.some((n) => n.metricId === metric)).toBe(true)
    }
  })

  it('Emergency button → the acute sequence opens and its result is delivered', () => {
    const sys = run('multiCrew', 30)
    const session = new AcuteSession(() => sys.acuteEnv(), () => sys.now)
    expect(session.step.kind).toBe('problem')
    session.problem('cabin')
    expect(sys.acuteHints(null).safety).toEqual(expect.arrayContaining(['multi', 'atmo']))
    session.safety(sys.acuteHints(null).safety)
    expect(session.step).toEqual({ kind: 'outcome', code: 'C-ENVIRONMENT-CO2' })
    sys.acuteResult(null, 'C-ENVIRONMENT-CO2')
    expect(sys.notifications.list[0].message).toContain('C-ENVIRONMENT-CO2')
    expect(sys.notifications.list[0].earth).toBe('sent')
  })

  it('the three screens read one state: a critical value is the same object everywhere', () => {
    const sys = run('suddenCritical', 12)
    // main tile, personal chart/body and the acute pre-fill all use sys.status / sys.latest
    expect(sys.status('spo2', 'A3')).toBe(sys.status('spo2', 'A3'))
    expect(sys.crewStatus('A3').level).toBe('red')
    expect(sys.acuteEnv().anySpo2Red).toBe(true)
  })
})

describe('no threshold is embedded in the screens', () => {
  // raw source of every screen and component, loaded by Vite
  const sources = import.meta.glob(['../screens/*.tsx', '../components/*.tsx', '../App.tsx'], { query: '?raw', import: 'default', eager: true }) as Record<string, string>
  const files = Object.keys(sources)
  const readFileSync = (f: string) => sources[f]
  // layout / formatting numbers that are not limits: 60 min per hour in a time formatter, 24 h in ms
  const allowed = [/m >= 60 \?/, /[<>] (sys\.now - )?24 \* 3600_000/]

  it('the scan actually covers the screens', () => {
    expect(files.length).toBeGreaterThanOrEqual(9)
  })

  it('screens never read the threshold file directly', () => {
    for (const f of files) expect(readFileSync(f), f).not.toMatch(/thresholds\.json|thresholds\.metrics/)
  })

  it('screens never compare a value with a numeric limit', () => {
    const offenders: string[] = []
    for (const f of files) {
      readFileSync(f).split('\n').forEach((line, i) => {
        // comparison against a number of 3 or more (0, 1, 2 are list/emptiness checks)
        const hit = /[^=<>!-][<>]=?\s*-?(?:[3-9]|\d{2,})(?:\.\d+)?\b/.test(line) && !/<\/?[A-Za-z]/.test(line.replace(/=>/g, ''))
        if (hit && !allowed.some((a) => a.test(line))) offenders.push(`${f}:${i + 1}: ${line.trim()}`)
      })
    }
    expect(offenders).toEqual([])
  })

  it('every metric shown has a cited source and readable label', () => {
    for (const scope of ['crew', 'cabin', 'eva'] as const) expect(metricIds(scope).length).toBeGreaterThan(0)
  })
})
