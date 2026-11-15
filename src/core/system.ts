// The single shared state every screen reads (Step 1): measurements -> status engine -> notifications.
import { useSyncExternalStore } from 'react'
import mission from '../config/mission.json'
import { instructions, LEVEL_LABEL, type Answer, type EnvState } from './acute'
import { deriveEva, orthostaticRisk, type EvaDerived, type EvaTelemetry } from './eva'
import { NotificationCenter } from './notifications'
import { dailyChecklist, evaluateCheckin, type Complaint } from './checkin'
import checkinCfg from '../config/checkin.json'
import { hexagon } from './hexagon'
import { project, TRENDS, type Projection } from './trends'
import { baselineCheck, sexRules, type Phase } from './baseline'
import { oxygenState } from './oxygen'
import { co2Score, readiness, sleepGate, sleepScore, zScore, type Part } from './readiness'
import { radiationLedger } from './radiation'
import { boneState, muscleState } from './musculo'
import { taskState, tasks } from './periodic'
import { lastEvaSample, plannedDayVolume, sampleCheckinMissed, sepFlux, WEEKDAYS } from './simulator'
import exerciseDefault from '../config/exercise.json'
import agendaCfg from '../config/agenda.json'
import nutritionCfg from '../config/nutrition.json'
import { targets as nutritionTargets, type NutritionProfile } from './nutrition'
import { goesAt, radlabAt, sLevel } from './realData'
import { Simulator, type ScenarioId } from './simulator'
import { evaluate, metricConfig, thresholds, worst } from './statusEngine'
import mentalCfg from '../config/mental.json'
import type { Astronaut, EvalContext, Level, LinkState, LogRecord, Measurement, MissionDay, RecordKind, Status } from './types'

const MIN = 60_000
const DAY = 24 * 60 * MIN
const HISTORY_LIMIT = 3000
const STORAGE_KEY = 'ahm.records.v1'
type RecordStorage = Pick<Storage, 'getItem' | 'setItem'>
const browserStorage = (): RecordStorage | undefined => {
  try {
    return typeof localStorage === 'undefined' ? undefined : localStorage
  } catch {
    return undefined // storage blocked (private mode): records stay in memory
  }
}
const REAL_STEP = 5 * MIN
const start = Date.parse(mission.startDate)
const end = Date.parse(mission.endDate)

export const crew = mission.crew as Astronaut[]
export type ExercisePlan = typeof exerciseDefault
const EXERCISE_KEY = 'ahm.exercise.v1'
const EVA_TASKS_KEY = 'ahm.evatasks.v1'
const AGENDA_KEY = 'ahm.agenda.v1'
const NUTRITION_KEY = 'ahm.nutrition.v1'
export type AgendaKind = 'own' | 'assigned' | 'earth' | 'checkin' | 'periodic' | 'eva' | 'exercise' | 'event' | 'birthday' | 'family'
/** One line of the Tasks & Calendar screen. done: true / false = a task; null = information (birthday, notice). */
export interface AgendaItem { key: string; kind: AgendaKind; label: string; from?: string; time: number | null; done: boolean | null; private?: boolean; overdue?: boolean }
export interface CalEvent { id: number; crewId: string; title: string; time: number; allDay: boolean; shared: boolean }
export interface OwnTask { id: number; crewId: string; title: string; time: number; allDay: boolean }
export interface EvaTask { id: number; label: string; done: boolean }
const defaultEvaTasks = (): EvaTask[] => mission.evaPlan.tasks.map((label, i) => ({ id: i + 1, label, done: false }))
export const metricIds = (scope: 'crew' | 'cabin' | 'eva' | 'lab' | 'periodic') =>
  Object.keys(thresholds.metrics).filter((id) => thresholds.metrics[id].scope === scope)

export class HealthSystem {
  /** simulated time at which the simulation starts; the real-data replay is anchored to it */
  readonly simStart = start + (mission.sim.startDay - 1) * DAY + mission.sim.startHour * 60 * MIN
  now = this.simStart
  link: LinkState = 'connected'
  running = false
  /** latest suit telemetry and what was derived from it; null when nobody is outside */
  eva: { telemetry: EvaTelemetry; derived: EvaDerived } | null = null
  /** EVA alerts the astronaut acknowledged (metric ids) */
  readonly evaAcked = new Set<string>()
  readonly notifications = new NotificationCenter()
  private sim = new Simulator(crew, mission.sim.seed, start)
  private series = new Map<string, Measurement[]>()
  private statuses = new Map<string, Status>()
  private flags: Record<string, boolean> = {}
  /** manual log entries from the personal screen, oldest first; kept across reloads */
  records: LogRecord[] = []
  /** per-person exercise plans edited on the Physical screen; kept across reloads */
  exercisePlans: Record<string, ExercisePlan> = {}
  /** every time a value enters caution or critical (alert history), newest last; kept for this session */
  alertLog: { time: number; crewId: string | null; metricId: string; level: Level; reason: string }[] = []
  private lastLevel = new Map<string, Level>()
  private listeners = new Set<() => void>()
  private timer: ReturnType<typeof setInterval> | undefined
  private version = 0

  constructor(private storage: RecordStorage | undefined = browserStorage()) {
    try {
      this.records = JSON.parse(storage?.getItem(STORAGE_KEY) ?? '[]')
    } catch {
      this.records = []
    }
    try {
      this.exercisePlans = JSON.parse(storage?.getItem(EXERCISE_KEY) ?? '{}')
    } catch {
      this.exercisePlans = {}
    }
    try {
      this.evaTasks = JSON.parse(storage?.getItem(EVA_TASKS_KEY) ?? 'null') ?? defaultEvaTasks()
    } catch {
      this.evaTasks = defaultEvaTasks()
    }
    try {
      this.agendaState = { done: {}, events: [], tasks: [], ...JSON.parse(storage?.getItem(AGENDA_KEY) ?? '{}') }
    } catch {
      this.agendaState = { done: {}, events: [], tasks: [] }
    }
    try {
      this.nutritionEdits = JSON.parse(storage?.getItem(NUTRITION_KEY) ?? '{}')
    } catch {
      this.nutritionEdits = {}
    }
    this.setScenario('normal')
  }

  /** Per-person nutrition inputs the crew can change (activity factor, menstruation suppressed); kept across reloads. */
  nutritionEdits: Record<string, { af?: number; menstruationSuppressed?: boolean | null }> = {}
  setNutrition(crewId: string, patch: { af?: number; menstruationSuppressed?: boolean | null }) {
    this.nutritionEdits[crewId] = { ...this.nutritionEdits[crewId], ...patch }
    try {
      this.storage?.setItem(NUTRITION_KEY, JSON.stringify(this.nutritionEdits))
    } catch {
      // storage blocked: kept in memory
    }
    this.emit()
  }
  nutritionProfile(crewId: string): NutritionProfile {
    const c = crew.find((x) => x.id === crewId)!
    const sample = (nutritionCfg.sample.menstruationSuppressed as Record<string, boolean | null>)[crewId]
    return { sex: c.sex as 'male' | 'female', age: c.age, kg: Math.round(c.preflight.massKg * (1 - (this.latest('body_mass_loss', crewId)?.value ?? 0) / 100) * 10) / 10, heightM: c.preflight.heightM, menstruationSuppressed: sample ?? null, ...this.nutritionEdits[crewId] }
  }
  /** Targets today and on the next EVA day, and what was eaten (meal records, the daily % and the water log). */
  nutrition(crewId: string) {
    const p = this.nutritionProfile(crewId)
    const eva = mission.criticalTasks.filter((t) => t.label === 'EVA' && t.crewIds.includes(crewId)).map((t) => ({ day: t.day, time: start + (t.day - 1) * DAY + t.hour * 60 * MIN })).find((t) => t.time > this.now - DAY)
    const today = Math.floor(this.now / DAY)
    const meals = this.recordsOf(crewId, 'meal').filter((r) => Math.floor(r.time / DAY) === today)
    const mealKcal = meals.reduce((s, r) => s + (Number(r.data.kcal) || 0), 0)
    return {
      profile: p,
      today: nutritionTargets(p),
      eva: eva ? { day: eva.day, ...nutritionTargets(p, mission.evaPlan.plannedHours) } : null,
      kcalPct: this.latest('nutrition_kcal_pct', crewId) ?? null,
      waterL: this.latest('water_l', crewId) ?? null,
      massLoss: this.latest('body_mass_loss', crewId) ?? null,
      mealKcal, mealCount: meals.length,
    }
  }

  /** Tasks & Calendar: ticks of tasks and the events astronauts add; kept across reloads. */
  agendaState: { done: Record<string, number>; events: CalEvent[]; tasks: OwnTask[] } = { done: {}, events: [], tasks: [] }
  private saveAgenda() {
    try {
      this.storage?.setItem(AGENDA_KEY, JSON.stringify(this.agendaState))
    } catch {
      // storage blocked: kept in memory
    }
    this.emit()
  }
  toggleAgenda(crewId: string, key: string) {
    const k = `${crewId}:${key}`
    if (k in this.agendaState.done) delete this.agendaState.done[k]
    else this.agendaState.done[k] = this.now
    this.saveAgenda()
  }
  addEvent(e: Omit<CalEvent, 'id'>) {
    this.agendaState.events.push({ ...e, id: Math.max(0, ...this.agendaState.events.map((x) => x.id)) + 1 })
    this.saveAgenda()
  }
  /** A task the astronaut adds for themself (Add task). */
  addOwnTask(t: Omit<OwnTask, 'id'>) {
    this.agendaState.tasks.push({ ...t, id: Math.max(0, ...this.agendaState.tasks.map((x) => x.id)) + 1 })
    this.saveAgenda()
  }
  removeOwnTask(id: number) {
    this.agendaState.tasks = this.agendaState.tasks.filter((t) => t.id !== id)
    this.saveAgenda()
  }
  removeEvent(id: number) {
    this.agendaState.events = this.agendaState.events.filter((e) => e.id !== id)
    this.saveAgenda()
  }

  /**
   * Everything on one UTC day for one astronaut: tasks from the commander and from Earth, check-in, periodic health
   * tasks that are due, EVA, the exercise session, own and shared events, crew birthdays and the person's own family
   * birthdays (private). Today also lists periodic tasks that are already overdue.
   */
  agenda(crewId: string, dayStart: number): AgendaItem[] {
    const day0 = Math.floor(dayStart / DAY) * DAY, day1 = day0 + DAY
    const today = Math.floor(this.now / DAY) * DAY
    const missionDay = Math.round((day0 - start) / DAY) + 1
    const mine = (ids: string[]) => ids.includes('all') || ids.includes(crewId)
    const tick = (key: string) => `${crewId}:${key}` in this.agendaState.done
    const at = (h: number) => day0 + h * 60 * MIN
    const md = (iso: string) => iso.slice(5, 10) === new Date(day0).toISOString().slice(5, 10)
    const out: AgendaItem[] = []
    for (const t of this.agendaState.tasks) if (t.crewId === crewId && t.time >= day0 && t.time < day1) out.push({ key: `t${t.id}`, kind: 'own', label: t.title, from: 'Added by me', time: t.allDay ? null : t.time, done: tick(`t${t.id}`) })
    agendaCfg.assigned.forEach((t, i) => t.day === missionDay && mine(t.crewIds) && out.push({ key: `a${i}`, kind: 'assigned', label: t.label, from: t.from, time: at(t.hour), done: tick(`a${i}`) }))
    agendaCfg.earth.forEach((t, i) => t.day === missionDay && mine(t.crewIds) && out.push({ key: `e${i}`, kind: 'earth', label: t.label, from: t.from, time: at(t.hour), done: tick(`e${i}`) }))
    mission.criticalTasks.forEach((t, i) => t.day === missionDay && t.crewIds.includes(crewId) && out.push({ key: `c${i}`, kind: 'eva', label: t.label, from: 'Flight plan', time: at(t.hour), done: tick(`c${i}`) }))
    if (day0 === today) {
      for (const c of this.checklist(crewId)) out.push({ key: `chk-${c.id}`, kind: 'checkin', label: c.label, from: 'Daily check-in', time: c.time, done: c.done })
    } else if (day0 > today) out.push({ key: 'chk', kind: 'checkin', label: 'Daily check-in (morning and evening)', from: 'Daily check-in', time: null, done: null })
    for (const r of this.periodicTasks(crewId)) {
      const dueToday = day0 === today && r.state !== 'done'
      if (dueToday || (r.next >= day0 && r.next < day1 && day0 > today)) out.push({ key: `p-${r.task.id}`, kind: 'periodic', label: r.task.label, from: 'Periodic health task', time: null, done: dueToday ? false : null, overdue: r.state === 'overdue' })
    }
    const wd = WEEKDAYS[new Date(day0).getUTCDay()]
    this.exercisePlan(crewId).sessions.forEach((s, i) => s.day === wd && s.type !== 'rest' && out.push({ key: `x${missionDay}-${i}`, kind: 'exercise', label: s.label, from: 'Exercise plan', time: null, done: tick(`x${missionDay}-${i}`) }))
    for (const e of this.agendaState.events) if (e.time >= day0 && e.time < day1 && (e.crewId === crewId || e.shared)) out.push({ key: `ev${e.id}`, kind: 'event', label: e.title, from: e.crewId === crewId ? (e.shared ? 'My event · crew can see' : 'My event · only me') : `Event by ${e.crewId}`, time: e.allDay ? null : e.time, done: null, private: !e.shared })
    for (const c of crew) if (md((agendaCfg.birthdays as Record<string, string>)[c.id] ?? '')) out.push({ key: `b-${c.id}`, kind: 'birthday', label: `${c.name}'s birthday`, from: 'Crew', time: null, done: null })
    for (const f of (agendaCfg.family as Record<string, { name: string; relation: string; date: string }[]>)[crewId] ?? []) if (md(f.date)) out.push({ key: `f-${f.name}`, kind: 'family', label: `${f.name}'s birthday (${f.relation})`, from: 'Family · only you see this', time: null, done: null, private: true })
    return out.sort((a, b) => (a.time ?? -1) - (b.time ?? -1))
  }

  /** Days of a month (UTC) that have something for this astronaut, for the calendar dots. */
  agendaDays(crewId: string, monthStart: number, days: number) {
    return Array.from({ length: days }, (_, i) => this.agenda(crewId, monthStart + i * DAY).filter((x) => x.kind !== 'checkin' && x.kind !== 'exercise').length)
  }

  /** EVA task checklist: edited outside an EVA, ticked off during it; kept across reloads. */
  evaTasks: EvaTask[] = []
  setEvaTasks(tasks: EvaTask[] | null) {
    this.evaTasks = tasks ?? defaultEvaTasks()
    try {
      this.storage?.setItem(EVA_TASKS_KEY, JSON.stringify(this.evaTasks))
    } catch {
      // storage blocked: the list stays in memory
    }
    this.emit()
  }
  toggleEvaTask(id: number) {
    this.setEvaTasks(this.evaTasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t)))
  }

  /** "Returning" (held on the EVA panel when voice is lost): partner, habitat and Earth get a notification. */
  evaReturning() {
    const id = this.evaCrewId
    this.notifications.clear(id, 'eva_returning')
    this.notifications.raise(id, 'eva_returning', `EVA · ${id} · RETURNING to the airlock (sent from the suit panel)`, this.now)
    this.emit()
  }

  get evaCrewId(): string | null {
    return this.eva?.telemetry.crewId ?? null
  }

  /** Earth link round trip in seconds (sample data); null while the link is lost. */
  get pingSec(): number | null {
    return this.link === 'lost' ? null : this.sim.pingSec(this.now)
  }

  get scenario(): ScenarioId {
    return this.sim.scenario
  }

  get missionDay(): MissionDay {
    const total = Math.round((end - start) / DAY) + 1
    const day = Math.floor((this.now - start) / DAY) + 1
    return { day, total, remaining: total - day }
  }

  /** sim time at which the current scenario started */
  scenarioStart = 0
  /** Restart the simulation with a scenario. Notification history is kept. */
  setScenario(id: ScenarioId) {
    this.scenarioStart = this.now
    this.series.clear()
    this.evaAcked.clear()
    this.eva = null
    this.flags = {}
    this.sim.start(id, this.now).forEach((m) => this.ingest(m))
    this.ingestSaved()
    for (let t = this.now - DAY; t <= this.now; t += REAL_STEP) this.ingestReal(t)
    this.evaluateAll()
    this.remind()
    this.emit()
  }

  /** Check-in reminders to the astronaut (not an alarm: no Earth, no sound): sent once a day per open part. */
  reminders: { crewId: string; part: 'morning' | 'evening'; time: number; message: string }[] = []
  private remind() {
    const r = checkinCfg.reminders
    const hour = new Date(this.now).getUTCHours()
    const today = Math.floor(this.now / DAY)
    for (const c of crew) {
      const items = this.checklist(c.id)
      for (const part of ['morning', 'evening'] as const) {
        const item = items.find((i) => i.id === part)
        const sent = this.reminders.find((x) => x.crewId === c.id && x.part === part && Math.floor(x.time / DAY) === today)
        if (item?.done) { if (sent) this.reminders = this.reminders.filter((x) => x !== sent); continue }
        if (!sent && hour >= (part === 'morning' ? r.morningHour : r.eveningHour)) {
          const streak = this.chain(c.id).streak
          this.reminders.push({ crewId: c.id, part, time: this.now, message: `${part === 'morning' ? 'Sleep diary' : 'Symptom diary'} not done yet${streak ? ` · keep your ${streak}-day chain` : ''}` })
        }
      }
    }
  }
  dismissReminder(crewId: string, part: string) {
    this.reminders = this.reminders.filter((x) => !(x.crewId === crewId && x.part === part))
    this.emit()
  }

  /**
   * "Don't break the chain": one link per day (any check-in that day). Days before the simulation come from the sample
   * history (SIM); from the simulation start on, only real check-ins count. streak = days in a row up to today
   * (today counts once done; an open today does not break it yet).
   */
  chain(crewId: string) {
    const r = checkinCfg.reminders
    const today = Math.floor(this.now / DAY)
    const simDay = Math.floor(this.simStart / DAY)
    const real = new Set(this.recordsOf(crewId, 'checkin').map((x) => Math.floor(x.time / DAY)))
    const done = (d: number) => real.has(d) || (d < simDay && d >= simDay - r.sampleDays && !sampleCheckinMissed(crewId, today - d))
    const links = Array.from({ length: r.chainDays }, (_, i) => {
      const d = today - (r.chainDays - 1 - i)
      return { time: d * DAY, done: done(d), sample: d < simDay && !real.has(d), today: d === today }
    })
    let streak = 0
    for (let d = done(today) ? today : today - 1; done(d) && streak < 1000; d--) streak++
    let best = 0, run = 0
    for (let d = simDay - r.sampleDays; d <= today; d++) { run = done(d) ? run + 1 : 0; best = Math.max(best, run) }
    const next = r.milestones.find((m) => m > streak) ?? null
    return { links, streak, best, next, todayDone: done(today) }
  }

  /** Advance simulated time by one step and re-evaluate everything. */
  tick() {
    this.now += mission.sim.minutesPerTick * MIN
    const frame = this.sim.tick(this.now)
    frame.measurements.forEach((m) => this.ingest(m))
    if ((this.now - this.simStart) % REAL_STEP === 0) this.ingestReal(this.now)
    this.flags = frame.flags
    if (frame.eva) {
      const id = frame.eva.crewId
      const derived = deriveEva(frame.eva, this.now, (metricId) => this.history(metricId, id))
      derived.measurements.forEach((m) => this.ingest(m))
      this.flags = { ...this.flags, ...derived.flags }
      this.eva = { telemetry: frame.eva, derived }
    } else this.eva = null
    if (frame.link !== this.link) {
      this.link = frame.link
      this.notifications.setLink(frame.link, this.now)
    }
    this.evaluateAll()
    this.remind()
    this.emit()
  }

  /** mission minutes per real second (demo speed; the simulation still steps one minute at a time) */
  speed = mission.sim.defaultSpeed
  setRunning(on: boolean) {
    clearInterval(this.timer)
    this.running = on
    if (on) this.timer = setInterval(() => this.tick(), mission.sim.tickMs / this.speed)
    this.emit()
  }
  setSpeed(x: number) {
    this.speed = x
    if (this.running) this.setRunning(true)
    else this.emit()
  }

  /** Save a log entry with crew member and mission time stamp. */
  addRecord(kind: RecordKind, crewId: string, data: LogRecord['data']): LogRecord {
    const rec: LogRecord = { id: (this.records.at(-1)?.id ?? 0) + 1, kind, crewId, time: this.now, data }
    this.records.push(rec)
    this.saveRecords()
    return rec
  }

  /**
   * Save a daily check-in (sleep or symptom diary + mental). The diary rules decide the level;
   * a red result is delivered like any critical notification (astronaut, health screen, Earth).
   */
  addCheckin(crewId: string, part: 'morning' | 'evening', redFlags: string[], complaints: Complaint[], extra: LogRecord['data']) {
    const result = evaluateCheckin(redFlags, complaints, this.recordsOf(crewId, 'checkin'), this.now)
    const rec = this.addRecord('checkin', crewId, {
      ...extra,
      part,
      redFlags,
      topics: complaints.map((c) => c.topic),
      complaints: complaints.map((c) => [`${c.topic} ${c.severity}/10`, c.where, c.started, c.helped].filter(Boolean).join(' · ')),
      level: result.level,
      reasons: result.reasons,
    })
    this.remind() // a done part takes its reminder away
    if (result.level !== 'green') this.logAlert(crewId, 'checkin', result.level, `Daily check-in · ${result.reasons.join('; ')}`)
    if (result.level === 'red') this.notifications.raise(crewId, `checkin:${rec.id}`, `CHECK-IN · CRITICAL · ${crewId} · ${result.reasons.join('; ')}`, this.now)
    this.emit()
    return result
  }

  private logAlert(crewId: string | null, metricId: string, level: Level, reason: string) {
    this.alertLog.push({ time: this.now, crewId, metricId, level, reason })
    if (this.alertLog.length > 500) this.alertLog.shift()
  }

  /** Next critical task (EVA, robot arm, docking) of a crew member, from the mission plan. */
  nextTask(crewId: string) {
    return mission.criticalTasks
      .filter((t) => t.crewIds.includes(crewId))
      .map((t) => ({ label: t.label, time: start + (t.day - 1) * DAY + t.hour * 60 * MIN }))
      .filter((t) => t.time > this.now)
      .sort((a, b) => a.time - b.time)[0] ?? null
  }

  /**
   * Mission readiness of one person at time `at` (Chart Blueprint, section 5), from the stored sleep, HRV,
   * cognitive test and cabin CO₂ readings. Freshness windows come from thresholds.json -> readiness.
   */
  readiness(crewId: string, at = this.now) {
    const r = thresholds.readiness
    const c = crew.find((x) => x.id === crewId)!
    const upto = (id: string, who: string | null, hours: number) => this.history(id, who).filter((m) => m.time <= at && m.time > at - hours * 60 * MIN)
    const parts: Partial<Record<Part, number>> = {}
    const week = upto('sleep_hours', crewId, r.sleep.days * 24).map((m) => m.value)
    const freshSleep = upto('sleep_hours', crewId, 36).length > 0
    if (week.length && freshSleep) parts.sleep = sleepScore(week)
    const hrv = upto('hrv', crewId, r.sleep.days * 24)
    if (upto('hrv', crewId, r.freshness.hrvHours).length) {
      // ln rMSSD: z of the 7-day mean of ln values against ln(baseline mean), SD ≈ SD / mean (delta method)
      const lnMean = hrv.reduce((s, m) => s + Math.log(m.value), 0) / hrv.length
      parts.hrv = zScore((lnMean - Math.log(c.hrvBaseline.mean)) / (c.hrvBaseline.sd / c.hrvBaseline.mean))
    }
    const test = upto('cognition_z', crewId, r.freshness.cognitionDays * 24).at(-1)
    if (test) parts.cognition = zScore(test.value)
    const co2 = upto('cabin_co2', null, r.co2.hours)
    if (upto('cabin_co2', null, r.freshness.co2Hours).length) parts.co2 = co2Score(co2.reduce((s, m) => s + m.value, 0) / co2.length)
    const task = this.nextTask(crewId)
    const gates: string[] = []
    if (week.length && sleepGate(week, !!task && task.time - at < DAY)) gates.push('sleep')
    if (at === this.now && this.status('cabin_co2', null).level === 'red') gates.push('CO₂')
    return { ...readiness(parts, gates), task, week, parts }
  }

  /** Crew oxygen chart strip: one person or the environment? */
  crewOxygen() {
    const cabinOff = ['cabin_pio2', 'cabin_co2'].some((id) => ['yellow', 'red'].includes(this.status(id, null).level))
    return oxygenState(crew.map((c) => ({ crewId: c.id, ms: this.history('spo2', c.id) })), this.now, cabinOff)
  }

  /** Radiation ledger of one person: career, 30-day organ, solar event and dose rate against their limits. */
  radiation(crewId: string, at = this.now) {
    const c = crew.find((x) => x.id === crewId)!
    const upto = (id: string) => this.history(id, crewId).filter((m) => m.time <= at)
    const event = this.latest('radiation_event_dose', null)
    return radiationLedger({ priorMSv: c.priorDoseMSv, daily: upto('rad_daily_dose'), eva: upto('rad_eva_dose'), now: at, eventDose: event?.value ?? null, rateNow: this.latest('radiation_rate', null)?.value ?? null, sLevel: sLevel(this.latest('goes_proton_flux', null)?.value ?? 0) })
  }

  /** Exercise plan of one person (the default Sprint week until someone edits it). */
  exercisePlan = (crewId: string): ExercisePlan => this.exercisePlans[crewId] ?? exerciseDefault

  setExercisePlan(crewId: string, plan: ExercisePlan | null) {
    if (plan) this.exercisePlans[crewId] = plan
    else delete this.exercisePlans[crewId]
    try {
      this.storage?.setItem(EXERCISE_KEY, JSON.stringify(this.exercisePlans))
    } catch {
      // storage blocked: the plan stays in memory
    }
    this.emit()
  }

  /** Planned ARED volume load of one person for one week (sets × reps × load of every resistance session). */
  plannedWeekVolume = (crewId: string) => WEEKDAYS.reduce((v, d) => v + plannedDayVolume(this.exercisePlan(crewId), d), 0)

  bone(crewId: string) {
    const c = crew.find((x) => x.id === crewId)!
    return boneState(this.history('bone_urine_ca', crewId), this.history('bone_ntx', crewId), c.preflight.urineCaMgDay, c.preflight.ntx)
  }

  muscle(crewId: string) {
    const c = crew.find((x) => x.id === crewId)!
    return muscleState(this.history('muscle_leg_press', crewId), c.preflight.legPressN, this.history('ared_volume', crewId), this.plannedWeekVolume(crewId), this.now)
  }

  /** Periodic tasks of one person with their schedule state and the worst level of their values. */
  periodicTasks(crewId: string) {
    return tasks.map((task) => {
      const readings = task.metrics.flatMap((id) => this.history(id, crewId))
      const symptoms = task.id === 'symptoms' ? this.recordsOf(crewId, 'checkin').map((r) => ({ metricId: 'checkin', crewId, value: 0, unit: '', time: r.time })) : []
      const statuses = task.metrics.map((id) => this.status(id, crewId)).filter((st) => st.level !== 'nodata')
      return { task, ...taskState(task, [...readings, ...symptoms], this.now, start, end), status: statuses.length ? worst(...statuses) : null }
    })
  }

  /** Early warning: trend projections of one astronaut (and the cabin CO₂), plus risk-factor cards. Never an alarm. */
  earlyWarning(crewId: string) {
    const proj = Object.fromEntries(TRENDS.metrics.map(({ id, windowDays }) => {
      const who = metricConfig(id).scope === 'cabin' ? null : crewId
      return [id, project(id, this.history(id, who), this.now, this.context(who), windowDays)]
    })) as Record<string, Projection>
    const moving = (id: string) => ['beyond', 'approaching'].includes(proj[id]?.state)
    const off = (id: string) => ['yellow', 'red'].includes(this.status(id, crewId).level)
    const bone = this.bone(crewId)
    const f = (on: boolean, label: string) => ({ on, label })
    const C = TRENDS.cards
    const symptomatic = crew.filter((c) => this.isSymptomatic(c.id)).length
    const cards = [
      { id: 'kidney', ...C.kidney, factors: [f(moving('water_l'), 'less water'), f(off('lab_urine_sg') || moving('lab_urine_sg'), 'concentrated urine'), f(bone.level !== 'green' && bone.level !== 'nodata', 'calcium from bones')], min: 2 },
      { id: 'fatigue', ...C.fatigue, factors: [f(moving('sleep_hours') || off('sleep_hours'), 'short sleep'), f(moving('hrv') || off('hrv'), 'lower heart-rate variability'), f(off('sleep_med_nights'), 'sleep pills')], min: 2 },
      { id: 'energy', ...C.energy, factors: [f(moving('nutrition_kcal_pct') || off('nutrition_kcal_pct'), 'eating below need'), f(moving('body_mass_loss') || off('body_mass_loss'), 'losing weight')], min: 2 },
      { id: 'co2', ...C.co2, factors: [f(moving('cabin_co2'), 'cabin CO₂ going up'), f(symptomatic > 0, `${symptomatic} crew with symptoms`)], min: 1 },
    ].filter((c) => c.factors.filter((x) => x.on).length >= c.min)
    return { proj, cards }
  }

  /** Health hexagon: six loads; live during an EVA, otherwise the person's last EVA (sample data). */
  hexagon(crewId: string) {
    const c = crew.find((x) => x.id === crewId)!
    const eva = this.evaCrewId === crewId ? this.eva : null
    if (eva) {
      // energy so far = mean metabolic rate × time in the suit; planned = the mission's EVA plan
      const met = this.history('eva_metabolic_rate', crewId).map((m) => m.value)
      const done = met.length ? (met.reduce((s, v) => s + v, 0) / met.length) * (eva.telemetry.suitTimeMin / 60) : 0
      const effort = { done, planned: mission.evaPlan.plannedHours * mission.evaPlan.plannedMetBtuh }
      return { ...hexagon({ rmssd: eva.telemetry.rmssd, rmssd0: eva.telemetry.base.rmssd0, hr: eva.telemetry.hr, ori: eva.derived.ori, effort }), sample: false }
    }
    // demo: outside an EVA the hexagon shows the person's last EVA (sample data), computed once per person
    let hx = this.lastEvaHex.get(crewId)
    if (!hx) {
      const s = lastEvaSample(crewId, c.hrvBaseline.mean)
      const effort = { done: s.energy, planned: mission.evaPlan.plannedHours * mission.evaPlan.plannedMetBtuh }
      hx = { ...hexagon({ rmssd: s.telemetry.rmssd, rmssd0: c.hrvBaseline.mean, hr: s.telemetry.hr, ori: orthostaticRisk(s.telemetry, s.metEnd), effort }), sample: true }
      this.lastEvaHex.set(crewId, hx)
    }
    return hx
  }
  private lastEvaHex = new Map<string, ReturnType<typeof hexagon> & { sample: boolean }>()

  /** Today's check-in checklist of one person. */
  checklist = (crewId: string) => dailyChecklist(this.recordsOf(crewId), this.now, checkinCfg.morningUntilHour)

  /** Mark a symptom as over (it no longer skips the verification reading). */
  resolveSymptom(id: number) {
    const rec = this.records.find((r) => r.id === id)
    if (rec) rec.data.resolved = true
    this.saveRecords()
  }

  private saveRecords() {
    try {
      this.storage?.setItem(STORAGE_KEY, JSON.stringify(this.records))
    } catch {
      // storage full or blocked: keep working from memory
    }
    this.evaluateAll()
    this.emit()
  }

  recordsOf = (crewId: string, kind?: RecordKind) => this.records.filter((r) => r.crewId === crewId && (!kind || r.kind === kind))

  /**
   * An open symptom record lets a red value count without waiting for the verification reading
   * (checklist rule 2: "if the person feels unwell, do not wait for verification").
   */
  isSymptomatic = (crewId: string) => this.records.some((r) => r.kind === 'symptom' && r.crewId === crewId && !r.data.resolved)

  /** Latest mental check-in as score + band (label, face, colour). Display only; raises no alarm. */
  mental(crewId: string) {
    const rec = this.recordsOf(crewId, 'mental').at(-1)
    if (!rec) return null
    const score = Number(rec.data.score)
    return { score, time: rec.time, band: mentalBand(score) }
  }

  history = (metricId: string, crewId: string | null) => this.series.get(`${crewId}:${metricId}`) ?? []
  latest = (metricId: string, crewId: string | null) => this.history(metricId, crewId).at(-1)
  status = (metricId: string, crewId: string | null): Status =>
    this.statuses.get(`${crewId}:${metricId}`) ?? evaluate(metricId, [])

  /** Worst status across one crew member's vitals (for the crew selector). */
  crewStatus = (crewId: string): Status => worst(...metricIds('crew').map((id) => this.status(id, crewId)))

  /**
   * "Common cause" hint (checklist rule 4): if the same metric is off for more than one person,
   * the cause is probably the environment. Returns the affected metrics with who is affected.
   */
  commonCause(): { metricId: string; crewIds: string[] }[] {
    return metricIds('crew')
      .map((metricId) => ({
        metricId,
        crewIds: crew.filter((c) => ['yellow', 'red'].includes(this.status(metricId, c.id).level)).map((c) => c.id),
      }))
      .filter((x) => x.crewIds.length > 1)
  }

  /**
   * Visible EVA alerts, most important first (priority list from the EVA document).
   * Silent cautions are left out; one root cause gives one alert (a leak shows as pressure, not also as O₂).
   */
  evaAlerts(): { metricId: string; status: Status; action: string; acked: boolean }[] {
    const id = this.evaCrewId
    if (!id) return []
    const all = thresholds.eva.alertPriority
      .map((metricId) => ({ metricId, status: this.status(metricId, id) }))
      .filter((a) => (a.status.level === 'red' || a.status.level === 'yellow') && !a.status.silent)
    const pressureAlert = all.some((a) => a.metricId === 'eva_suit_pressure')
    return all
      .filter((a) => !(pressureAlert && a.metricId === 'eva_o2' && a.status.level === 'yellow'))
      .sort((a, b) => Number(b.status.level === 'red') - Number(a.status.level === 'red'))
      .map((a) => ({
        ...a,
        action: metricConfig(a.metricId).action?.[a.status.level === 'red' ? 'critical' : 'caution'] ?? '',
        acked: this.evaAcked.has(a.metricId),
      }))
  }

  ackEvaAlert(metricId: string) {
    this.evaAcked.add(metricId)
    this.emit()
  }

  /** Opening the EVA emergency menu notifies partner, habitat and Earth at once. */
  evaEmergency(option: string) {
    this.notifications.clear(this.evaCrewId, 'eva_emergency')
    this.notifications.raise(this.evaCrewId, 'eva_emergency', `EVA EMERGENCY · ${this.evaCrewId} · ${option}`, this.now)
    this.emit()
  }

  /** Real NASA measurement (RadLab replay) for a simulated time. */
  private ingestReal(time: number) {
    this.ingest({ metricId: 'radiation_measured', crewId: null, value: radlabAt(time, this.simStart), unit: metricConfig('radiation_measured').unit, time })
    // solarEvent scenario: the sample event replaces the real (quiet) GOES week after the scenario starts
    const ev = this.scenario === 'solarEvent' ? sepFlux((time - this.scenarioStart) / MIN) : null
    this.ingest({ metricId: 'goes_proton_flux', crewId: null, value: ev === null ? goesAt(time, this.simStart) : Number(ev.toPrecision(3)), unit: 'pfu', time })
  }

  /** Reaction time tests done on the panel: saved as records, so they survive a reload or a scenario change. */
  addReaction(crewId: string, ms: number, trials: number[]) {
    const rec = this.addRecord('value', crewId, { metricId: 'reaction_ms', value: ms, trials: trials.join(', ') })
    this.ingest({ metricId: 'reaction_ms', crewId, value: ms, unit: 'ms', time: rec.time })
    this.emit()
  }

  private ingestSaved() {
    for (const r of this.records) {
      if (r.kind !== 'value' || r.data.metricId !== 'reaction_ms') continue
      this.ingest({ metricId: 'reaction_ms', crewId: r.crewId, value: Number(r.data.value), unit: 'ms', time: r.time })
    }
    for (const c of crew) this.series.get(`${c.id}:reaction_ms`)?.sort((a, b) => a.time - b.time)
  }

  private ingest(m: Measurement) {
    const key = `${m.crewId}:${m.metricId}`
    const list = this.series.get(key) ?? []
    list.push(m)
    if (list.length > HISTORY_LIMIT) list.shift()
    this.series.set(key, list)
  }

  /** Cabin and crew state for the environment routing rule of the acute tree. */
  acuteEnv(): EnvState {
    const cabin = ['cabin_pio2', 'cabin_pressure', 'cabin_co2'].map((id) => this.status(id, null))
    return {
      cabinRed: cabin.slice(0, 2).some((s) => s.level === 'red'),
      co2Emergency: cabin[2].emergency,
      anySpo2Red: crew.some((c) => this.status('spo2', c.id).level === 'red'),
      noData: cabin.some((s) => s.level === 'nodata'),
    }
  }

  /**
   * What the panel already knows for the acute tree ("pre-fill and confirm"): suggested answers
   * with the reason, and the safety options to pre-tick. The person always confirms.
   */
  acuteHints(personId: string | null) {
    const off = (id: string, who: string | null) => ['yellow', 'red'].includes(this.status(id, who).level)
    const show = (id: string, who: string | null) => {
      const m = this.latest(id, who)
      return m ? `${metricConfig(id).label} ${m.value} ${m.unit}` : metricConfig(id).label
    }
    const answers: Record<string, { answer: Answer; why: string }> = {}
    const fever = personId && off('body_temp', personId)
    if (fever) for (const id of ['T6', 'R1', 'GN3']) answers[id] = { answer: 'yes', why: show('body_temp', personId) }
    if (this.evaCrewId) answers.X1 = { answer: 'yes', why: 'EVA in progress or just ended' }
    if (off('radiation_rate', null) || this.flags.sepWarning || this.flags.sepStarted) answers.X2 = { answer: 'yes', why: show('radiation_rate', null) }
    const others = crew.filter((c) => c.id !== personId && this.isSymptomatic(c.id)).map((c) => c.id)
    const common = this.commonCause()
    if (others.length || common.length) answers.GN2a = { answer: 'yes', why: others.length ? `open symptom: ${others.join(', ')}` : `${metricConfig(common[0].metricId).label} off for ${common[0].crewIds.join(', ')}` }
    const cabinOk = !off('cabin_pio2', null) && !off('cabin_pressure', null)
    answers.GN2b = { answer: cabinOk ? 'yes' : 'no', why: `${show('cabin_pio2', null)}, ${show('cabin_pressure', null)}` }
    if (off('cabin_co2', null)) answers.H1a = { answer: 'yes', why: show('cabin_co2', null) }
    const safety: string[] = []
    if (this.status('cabin_pressure', null).level === 'red') safety.push('pressure')
    if (off('cabin_co2', null) || off('cabin_pio2', null)) safety.push('atmo')
    if (common.length || crew.filter((c) => this.isSymptomatic(c.id)).length > 1) safety.push('multi')
    // a confirming question can be pre-filled from a sensor: the panel shows the reading, the person confirms
    const reading = (metricId: string) => (personId && this.latest(metricId, personId) ? { text: show(metricId, personId), off: off(metricId, personId) } : null)
    // baseline deviation only adds a yellow note to the fever question (T6); the absolute 38.5 °C limit stays
    const notes: Record<string, string> = {}
    const tb = personId ? this.status('body_temp', personId).baseline : null
    if (tb?.ok && tb.level !== 'green') for (const id of ['T6', 'GN3']) notes[id] = `Body temperature: ${tb.note}`
    return { answers, safety, reading, notes }
  }

  /** The result of the acute sequence goes to the astronaut, the screen and Earth (queued while the link is lost). */
  acuteResult(personId: string | null, code: string) {
    const i = instructions[code]
    this.notifications.raise(personId, `acute:${code}:${this.now}`, `ACUTE · ${LEVEL_LABEL[i.level]} · ${personId ?? 'Crew'} · ${code} ${i.title}`, this.now)
    this.emit()
  }

  /** Evaluation context of a crew member (or the cabin): the same one the engine and the charts use. */
  context(crewId: string | null): EvalContext {
    const shared = { env: mission.environment, flags: this.flags }
    const c = crew.find((x) => x.id === crewId)
    // HRmax fallback formula from the EVA document: 208 - 0.7 x age
    return c ? { ...shared, sex: c.sex, baseline: c.hrvBaseline, symptomatic: this.isSymptomatic(c.id), hrMax: 208 - 0.7 * c.age } : shared
  }

  private evaluateAll() {
    const crewIds = metricIds('crew')
    const run = (metricId: string, crewId: string | null, ctx: EvalContext) => {
      let st = evaluate(metricId, this.history(metricId, crewId), ctx)
      // personal baseline: early warning only (a green can turn yellow; red and yellow stay as the limits say)
      const b = crewId && crewIds.includes(metricId) ? baselineCheck(metricId, crewId, this.history(metricId, crewId), this.now, this.phase, this.missionDay.day) : null
      if (b) {
        st = { ...st, baseline: b }
        if (b.ok && b.level !== 'green' && st.level === 'green') {
          // landing rule (sex rules, rule 1): women get the visible caution with "Sit down first"; others are logged quietly
          const female = this.phase === 'landing' && crew.find((c) => c.id === crewId)?.sex === 'female'
          st = { ...st, level: 'yellow', reason: `${b.note}${female ? ' · Sit down first' : ''}`, silent: this.phase === 'landing' && !female }
        }
      }
      const key = `${crewId}:${metricId}`
      const was = this.lastLevel.get(key)
      this.lastLevel.set(key, st.level)
      if (st.level !== was && (st.level === 'yellow' || st.level === 'red') && !st.silent) this.logAlert(crewId, metricId, st.level, st.reason)
      this.statuses.set(key, st)
      if (st.level === 'red' && st.confirmed) {
        const who = crewId ?? 'All crew'
        this.notifications.raise(crewId, metricId, `CRITICAL · ${who} · ${st.reason}`, this.now)
      } else if (st.level !== 'red') {
        this.notifications.clear(crewId, metricId)
      }
    }
    metricIds('cabin').forEach((id) => run(id, null, this.context(null)))
    crew.forEach((c) => {
      const ctx = this.context(c.id)
      metricIds('crew').forEach((id) => run(id, c.id, ctx))
      metricIds('lab').forEach((id) => run(id, c.id, ctx))
      metricIds('periodic').forEach((id) => run(id, c.id, ctx))
      if (this.evaCrewId === c.id) metricIds('eva').forEach((id) => run(id, c.id, ctx))
    })
  }

  /** Mission phase for the baseline reference: landing = the first 72 h after the mission end date. */
  get phase(): Phase {
    const end = Date.parse(mission.endDate)
    return this.now >= end && this.now < end + thresholds.baseline.landingHours * 60 * MIN ? 'landing' : 'microgravity'
  }

  /** Sex-specific rules that apply to one astronaut (documented ones only). */
  sexRules = (crewId: string) => sexRules(crew.find((c) => c.id === crewId)?.sex)

  private emit() {
    this.version++
    this.listeners.forEach((l) => l())
  }

  subscribe = (l: () => void) => {
    this.listeners.add(l)
    return () => this.listeners.delete(l)
  }
  getVersion = () => this.version
}

export const mentalBand = (score: number) => mentalCfg.bands.find((b) => score <= b.max) ?? mentalCfg.bands[mentalCfg.bands.length - 1]

export const system = new HealthSystem()

/** React hook: re-render whenever the shared state changes. */
export function useSystem(): HealthSystem {
  useSyncExternalStore(system.subscribe, system.getVersion)
  return system
}

export { metricConfig }
