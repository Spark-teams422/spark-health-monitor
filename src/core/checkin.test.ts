import { describe, expect, it } from 'vitest'
import { checkinStreak, dailyChecklist, evaluateCheckin } from './checkin'
import { HealthSystem } from './system'
import type { LogRecord } from './types'

const DAY = 24 * 3600_000
const now = 100 * DAY + 20 * 3600_000
const past = (daysAgo: number, topics: string[]): LogRecord => ({ id: daysAgo, kind: 'checkin', crewId: 'A1', time: now - daysAgo * DAY, data: { topics } })

describe('daily check-in (symptom diary rules)', () => {
  it('nothing reported is green', () => {
    expect(evaluateCheckin([], [], [], now).level).toBe('green')
  })
  it('severity 4-6 is yellow, 7+ is red', () => {
    expect(evaluateCheckin([], [{ topic: 'Headache', severity: 3 }], [], now).level).toBe('green')
    expect(evaluateCheckin([], [{ topic: 'Headache', severity: 4 }], [], now).level).toBe('yellow')
    expect(evaluateCheckin([], [{ topic: 'Headache', severity: 7 }], [], now).level).toBe('red')
  })
  it('a red-flag complaint is red whatever else is reported', () => {
    expect(evaluateCheckin(['Chest pain'], [], [], now).level).toBe('red')
  })
  it('the same complaint 3 days in a row is yellow, with a gap it is not', () => {
    expect(evaluateCheckin([], [{ topic: 'Nausea', severity: 2 }], [past(1, ['Nausea']), past(2, ['Nausea'])], now).level).toBe('yellow')
    expect(evaluateCheckin([], [{ topic: 'Nausea', severity: 2 }], [past(1, ['Nausea']), past(3, ['Nausea'])], now).level).toBe('green')
  })
  it('streak counts consecutive days', () => {
    expect(checkinStreak([past(0, []), past(1, []), past(2, []), past(4, [])], now)).toBe(3)
    expect(checkinStreak([past(1, []), past(2, [])], now)).toBe(2)
    expect(checkinStreak([], now)).toBe(0)
  })
  it('a red check-in is stored and notifies astronaut, screen and Earth', () => {
    const sys = new HealthSystem()
    const before = sys.notifications.list.length
    const r = sys.addCheckin('A2', 'evening', [], [{ topic: 'Headache', severity: 8 }], {})
    expect(r.level).toBe('red')
    expect(sys.recordsOf('A2', 'checkin')).toHaveLength(1)
    expect(sys.notifications.list.length).toBe(before + 1)
    expect(sys.notifications.list[0].targets).toEqual(['crew', 'earth', 'screen'])
  })
})

describe('daily checklist', () => {
  it('ticks the parts done today; the evening diary is due only after noon', () => {
    const at = (h: number) => Date.UTC(2026, 10, 14, h)
    const rec = (kind: 'checkin' | 'mental', h: number, part?: string): LogRecord => ({ id: h, kind, crewId: 'A1', time: at(h), data: part ? { part } : {} })
    const morning = dailyChecklist([rec('checkin', 8, 'morning'), rec('mental', 8)], at(9), 12)
    expect(morning.map((i) => [i.id, i.done, i.due])).toEqual([['morning', true, true], ['evening', false, false], ['mood', true, true]])
    expect(dailyChecklist([], at(20), 12).find((i) => i.id === 'evening')?.due).toBe(true)
  })
})
