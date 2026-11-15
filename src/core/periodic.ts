// Periodic health tasks (Periodic Health Tasks Checklist): when each task was last done, when it is due,
// and whether it is overdue. Task list and intervals live in config/periodic.json; limits in thresholds.json.
import cfg from '../config/periodic.json'
import type { Measurement } from './types'

const DAY = 24 * 3600_000

export type Task = (typeof cfg.tasks)[number]
export const tasks: Task[] = cfg.tasks

export interface TaskState { last: number | null; next: number; state: 'done' | 'due' | 'overdue' }

/**
 * Next due time = last done + interval; a task with fixed mission days (eye exam) is also due on the next of those days.
 * Overdue = more than `overdueReportDays` past due (the checklist says to report it to the flight surgeon).
 */
export function taskState(task: Task, readings: Measurement[], now: number, missionStart: number, missionEnd: number): TaskState {
  const last = readings.length ? Math.max(...readings.map((m) => m.time)) : null
  let next = (last ?? missionStart) + task.everyDays * DAY
  for (const d of (task as { missionDays?: number[] }).missionDays ?? []) {
    const t = d > 0 ? missionStart + (d - 1) * DAY : missionEnd + d * DAY
    if (t > (last ?? missionStart) && t < next) next = t
  }
  const state = now < next ? 'done' : now - next > cfg.overdueReportDays * DAY ? 'overdue' : 'due'
  return { last, next, state }
}
