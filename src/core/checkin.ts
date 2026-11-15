// Daily check-in evaluation (symptom diary rules, Periodic Health Tasks section 6). Limits come from thresholds.json.
import { thresholds } from './statusEngine'
import type { Level, LogRecord } from './types'

export interface Complaint { topic: string; severity: number; where?: string; started?: string; helped?: string }
export interface CheckinResult { level: Exclude<Level, 'nodata'>; reasons: string[] }

const DAY = 24 * 3600_000
const dayOf = (t: number) => Math.floor(t / DAY)

/**
 * Red: a red-flag complaint or severity >= redSeverityMin.
 * Yellow: severity >= yellowSeverityMin, or the same topic reported on `repeatDays` consecutive days (today included).
 */
export function evaluateCheckin(redFlags: string[], complaints: Complaint[], past: LogRecord[], now: number): CheckinResult {
  const r = thresholds.symptomDiary
  const reasons: string[] = []
  let level: CheckinResult['level'] = 'green'
  const raise = (to: 'yellow' | 'red', why: string) => {
    reasons.push(why)
    if (to === 'red' || level === 'green') level = to
  }
  for (const f of redFlags) raise('red', `Red-flag complaint: ${f}`)
  for (const c of complaints) {
    if (c.severity >= r.redSeverityMin) raise('red', `${c.topic} severity ${c.severity}/10`)
    else if (c.severity >= r.yellowSeverityMin) raise('yellow', `${c.topic} severity ${c.severity}/10`)
    // same complaint on consecutive days: today plus the previous (repeatDays - 1) days each have it
    const days = new Set(past.filter((p) => p.kind === 'checkin' && Array.isArray(p.data.topics) && (p.data.topics as string[]).includes(c.topic)).map((p) => dayOf(p.time)))
    let run = 1
    while (run < r.repeatDays && days.has(dayOf(now) - run)) run++
    if (run >= r.repeatDays) raise('yellow', `${c.topic} reported ${r.repeatDays} days in a row`)
  }
  return { level, reasons }
}

/** Consecutive days (ending today or yesterday) with at least one check-in. */
export function checkinStreak(past: LogRecord[], now: number): number {
  const days = new Set(past.filter((p) => p.kind === 'checkin').map((p) => dayOf(p.time)))
  let d = days.has(dayOf(now)) ? dayOf(now) : dayOf(now) - 1
  let n = 0
  while (days.has(d)) { n++; d-- }
  return n
}

export interface ChecklistItem { id: 'morning' | 'evening' | 'mood'; label: string; done: boolean; time: number | null; due: boolean }

/**
 * Today's check-in checklist: the morning sleep diary (section 11), the evening symptom diary (section 6) and the
 * state-of-mind check-in. An item is due once its part of the day has started (`morningUntilHour` splits the day).
 */
export function dailyChecklist(records: LogRecord[], now: number, morningUntilHour: number): ChecklistItem[] {
  const today = records.filter((r) => dayOf(r.time) === dayOf(now))
  const last = (f: (r: LogRecord) => boolean) => today.filter(f).at(-1)?.time ?? null
  const evening = new Date(now).getUTCHours() >= morningUntilHour
  const items: [ChecklistItem['id'], string, number | null, boolean][] = [
    ['morning', 'Morning · sleep diary', last((r) => r.kind === 'checkin' && r.data.part === 'morning'), true],
    ['evening', 'Evening · symptom diary', last((r) => r.kind === 'checkin' && r.data.part === 'evening'), evening],
    ['mood', 'State of mind', last((r) => r.kind === 'mental'), true],
  ]
  return items.map(([id, label, time, due]) => ({ id, label, done: time !== null, time, due }))
}
