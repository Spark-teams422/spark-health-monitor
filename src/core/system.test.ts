// Step 1 "done" criterion: choosing a simulator scenario produces a notification.
import { describe, expect, it } from 'vitest'
import { crew, HealthSystem, metricIds } from './system'

const run = (scenario: Parameters<HealthSystem['setScenario']>[0], ticks: number) => {
  const sys = new HealthSystem()
  sys.setScenario(scenario)
  for (let i = 0; i < ticks; i++) sys.tick()
  return sys
}

describe('simulator scenarios through the shared layer', () => {
  it('normal day: everything green, no notification', () => {
    const sys = run('normal', 180)
    for (const c of crew) for (const id of metricIds('crew')) expect(sys.status(id, c.id).level, `${c.id} ${id}`).toBe('green')
    for (const id of metricIds('cabin')) expect(['green', 'nodata'], id).toContain(sys.status(id, null).level)
    expect(sys.notifications.list).toHaveLength(0)
  })

  it('slow worsening trend: A3 HRV turns yellow, no critical notification', () => {
    const sys = run('slowTrend', 10)
    expect(sys.status('hrv', 'A3').level).toBe('yellow')
    expect(sys.status('hrv', 'A1').level).toBe('green')
    expect(sys.notifications.list).toHaveLength(0)
  })

  it('sudden critical: red, then one notification to crew, Earth and screen', () => {
    const sys = run('suddenCritical', 10)
    expect(sys.status('spo2', 'A3')).toMatchObject({ level: 'red', confirmed: true })
    expect(sys.notifications.list).toHaveLength(1)
    const n = sys.notifications.list[0]
    expect(n).toMatchObject({ crewId: 'A3', metricId: 'spo2', earth: 'sent' })
    expect(n.targets).toEqual(['crew', 'earth', 'screen'])
    expect(sys.notifications.earth.sent).toContain(n)
  })

  it('link loss: notification is queued, then sent when the link returns', () => {
    const sys = run('linkLoss', 10)
    expect(sys.link).toBe('lost')
    expect(sys.notifications.queue).toHaveLength(1)
    expect(sys.notifications.earth.sent).toHaveLength(0)
    for (let i = 0; i < 20; i++) sys.tick()
    expect(sys.link).not.toBe('lost')
    expect(sys.notifications.queue).toHaveLength(0)
    expect(sys.notifications.list[0].earth).toBe('sent')
    expect(sys.notifications.earth.sent).toHaveLength(1)
  })

  it('several crew affected: common-cause hint, cabin CO₂ flagged', () => {
    expect(run('normal', 30).commonCause()).toEqual([])
    const sys = run('multiCrew', 30)
    expect(sys.commonCause()).toEqual([{ metricId: 'spo2', crewIds: ['A1', 'A3'] }])
    expect(sys.status('cabin_co2', null).level).not.toBe('green')
    expect(sys.crewStatus('A2').level).toBe('green')
  })

  it('a reported symptom skips the verification reading', () => {
    const sys = new HealthSystem(undefined)
    sys.setScenario('suddenCritical')
    sys.addRecord('symptom', 'A3', { symptom: 'Shortness of breath', severity: 6 })
    while (sys.status('spo2', 'A3').level !== 'red') sys.tick()
    expect(sys.status('spo2', 'A3').confirmed).toBe(true)
  })

  it('records are stamped, persisted and restored; a resolved symptom stops skipping verification', () => {
    const store = new Map<string, string>()
    const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) }
    const sys = new HealthSystem(storage)
    const water = sys.addRecord('water', 'A2', { ml: 300 })
    const symptom = sys.addRecord('symptom', 'A2', { symptom: 'Headache', severity: 4 })
    expect(water).toMatchObject({ crewId: 'A2', kind: 'water', time: sys.now })
    expect(sys.isSymptomatic('A2')).toBe(true)

    const reopened = new HealthSystem(storage)
    expect(reopened.records).toEqual(sys.records)
    expect(reopened.isSymptomatic('A2')).toBe(true)
    reopened.resolveSymptom(symptom.id)
    expect(reopened.isSymptomatic('A2')).toBe(false)
  })

  it('mental check-in maps to the bands of the mental document and raises no alarm', () => {
    const sys = new HealthSystem(undefined)
    expect(sys.mental('A1')).toBeNull()
    sys.addRecord('mental', 'A1', { score: 25 })
    expect(sys.mental('A1')?.band.label).toBe('Calm & focused')
    sys.addRecord('mental', 'A1', { score: 31 })
    expect(sys.mental('A1')?.band.label).toBe('Low energy / isolation')
    sys.addRecord('mental', 'A1', { score: 95 })
    expect(sys.mental('A1')?.band.label).toBe('High stress / anxiety')
    expect(sys.notifications.list).toHaveLength(0)
  })

  it('mission day comes from the mission config', () => {
    expect(new HealthSystem().missionDay).toEqual({ day: 142, total: 210, remaining: 68 })
  })
})

describe('real NASA data replay', () => {
  it('RadLab dose rate is ingested with 24 h of history and never evaluated as an alarm', () => {
    const sys = new HealthSystem(undefined)
    const hist = sys.history('radiation_measured', null)
    expect(hist.length).toBe(289) // 24 h in 5-minute steps
    expect(hist.every((m) => m.value > 0 && m.unit === 'µGy/h')).toBe(true)
    for (let i = 0; i < 30; i++) sys.tick()
    expect(sys.history('radiation_measured', null).length).toBe(295)
    expect(metricIds('cabin')).not.toContain('radiation_measured')
    expect(sys.notifications.list).toHaveLength(0)
  })
})

describe('demo additions (15 Nov 2026)', () => {
  it('health hexagon has all six axes and an ORI for every astronaut outside an EVA (last EVA sample)', () => {
    const sys = new HealthSystem()
    for (const c of crew) {
      const hx = sys.hexagon(c.id)
      expect(hx.sample, c.id).toBe(true)
      expect(hx.axes.every((a) => a.value !== null), c.id).toBe(true)
      expect(hx.ori, c.id).not.toBeNull()
    }
  })

  it('a reaction time test done on the panel is kept across a reload and a scenario change', () => {
    const store = new Map<string, string>()
    const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) }
    const sys = new HealthSystem(storage)
    sys.addReaction('A2', 301, [290, 301, 310, 295, 320])
    expect(sys.latest('reaction_ms', 'A2')?.value).toBe(301)
    const reopened = new HealthSystem(storage)
    reopened.setScenario('slowTrend')
    expect(reopened.history('reaction_ms', 'A2').some((m) => m.value === 301)).toBe(true)
  })
})

describe('EVA tasks and Returning (15 Nov 2026)', () => {
  it('task checklist is kept across a reload; Returning notifies partner, habitat and Earth', () => {
    const store = new Map<string, string>()
    const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) }
    const sys = new HealthSystem(storage)
    const first = sys.evaTasks[0]
    sys.toggleEvaTask(first.id)
    sys.setEvaTasks([...sys.evaTasks, { id: 99, label: 'Extra task', done: false }])
    const again = new HealthSystem(storage)
    expect(again.evaTasks.find((t) => t.id === first.id)?.done).toBe(true)
    expect(again.evaTasks.at(-1)?.label).toBe('Extra task')
    again.setScenario('eva')
    again.tick()
    again.evaReturning()
    expect(again.notifications.list.some((n) => n.message.includes('RETURNING'))).toBe(true)
  })
})

describe('Tasks & Calendar and the check-in chain (15 Nov 2026)', () => {
  const at = (isoDate: string) => Date.parse(`${isoDate}T00:00:00Z`)
  it('crew birthdays are visible to everyone, family birthdays only to that astronaut; private events stay private', () => {
    const sys = new HealthSystem()
    expect(sys.agenda('A1', at('2026-11-20')).some((x) => x.kind === 'birthday' && x.label.includes('Kenji'))).toBe(true) // A2's birthday
    expect(sys.agenda('A1', at('2026-11-18')).some((x) => x.kind === 'family')).toBe(true) // A1's son
    expect(sys.agenda('A2', at('2026-11-18')).some((x) => x.kind === 'family')).toBe(false)
    sys.addEvent({ crewId: 'A1', title: 'Private note', time: at('2026-11-21'), allDay: true, shared: false })
    sys.addEvent({ crewId: 'A1', title: 'Movie night', time: at('2026-11-21') + 20 * 3600_000, allDay: false, shared: true })
    expect(sys.agenda('A1', at('2026-11-21')).filter((x) => x.kind === 'event')).toHaveLength(2)
    expect(sys.agenda('A3', at('2026-11-21')).filter((x) => x.kind === 'event').map((x) => x.label)).toEqual(['Movie night'])
  })
  it("today's list has commander, Earth, check-in and due periodic tasks; a tick is kept", () => {
    const sys = new HealthSystem()
    const today = sys.agenda('A2', sys.now)
    for (const k of ['assigned', 'earth', 'checkin', 'periodic']) expect(today.some((x) => x.kind === k), k).toBe(true)
    const a = today.find((x) => x.kind === 'assigned')!
    sys.toggleAgenda('A2', a.key)
    expect(sys.agenda('A2', sys.now).find((x) => x.key === a.key)?.done).toBe(true)
  })
  it('chain: sample past breaks the streak where a day was missed; a check-in today extends it and clears the reminder', () => {
    const sys = new HealthSystem()
    expect(sys.chain('A4').streak).toBe(0) // A4 missed yesterday (sample)
    expect(sys.chain('A2').streak).toBe(2) // missed 3 days ago
    expect(sys.reminders.some((r) => r.crewId === 'A2' && r.part === 'morning')).toBe(true)
    sys.addCheckin('A2', 'morning', [], [], {})
    expect(sys.chain('A2').streak).toBe(3)
    expect(sys.reminders.some((r) => r.crewId === 'A2' && r.part === 'morning')).toBe(false)
    expect(sys.chain('A2').links).toHaveLength(21)
  })
})

describe('Add task (15 Nov 2026)', () => {
  it('an own task shows on the day and can be ticked and removed', () => {
    const sys = new HealthSystem()
    sys.addOwnTask({ crewId: 'A3', title: 'Call home', time: sys.now + 3600_000, allDay: false })
    const it = sys.agenda('A3', sys.now).find((x) => x.kind === 'own')!
    expect(it.label).toBe('Call home')
    sys.toggleAgenda('A3', it.key)
    expect(sys.agenda('A3', sys.now).find((x) => x.kind === 'own')?.done).toBe(true)
    expect(sys.agenda('A1', sys.now).some((x) => x.kind === 'own')).toBe(false)
    sys.removeOwnTask(sys.agendaState.tasks[0].id)
    expect(sys.agenda('A3', sys.now).some((x) => x.kind === 'own')).toBe(false)
  })
})

describe('nutrition per person (15 Nov 2026)', () => {
  it('uses the person profile; the iron branch asks until answered; EVA crew get an EVA-day target', () => {
    const sys = new HealthSystem()
    const a1 = sys.nutrition('A1')
    expect(a1.today.iron.kind).toBe('ask')
    expect(a1.eva?.energy).toBe(a1.today.energy + 1300)
    sys.setNutrition('A1', { menstruationSuppressed: false })
    expect(sys.nutrition('A1').today.iron).toMatchObject({ kind: 'min', mg: 18 })
    expect(sys.nutrition('A2').eva).toBeNull()
    expect(sys.nutrition('A2').today.iron.kind).toBe('max')
  })
})

describe('solar particle event during the Mars transit (sample scenario)', () => {
  it('protons pass 10 pfu, the dose rate turns red (event started), Cabin Radiation sees the event', () => {
    const sys = new HealthSystem()
    sys.setScenario('solarEvent')
    for (let i = 0; i < 30; i++) sys.tick()
    expect(sys.latest('goes_proton_flux', null)!.value).toBeGreaterThanOrEqual(10)
    expect(sys.status('radiation_rate', null).level).toBe('red')
    expect(sys.latest('radiation_event_dose', null)!.value).toBeGreaterThan(0)
    expect(sys.radiation('A1').level).not.toBe('green')
  })
})
