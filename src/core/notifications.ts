// Notification system (Step 1.5). A confirmed critical value produces ONE notification that goes
// to the astronaut, to Earth and to the health screen. Earth delivery uses a mock sender;
// while the link is lost, notifications wait in a queue and are sent when the link returns.
import type { LinkState, Notification } from './types'

/** Stand-in for the real ground link. Keeps a log of everything "sent to Earth". */
export class MockEarthSender {
  state: LinkState = 'connected'
  sent: Notification[] = []

  send(n: Notification): boolean {
    if (this.state === 'lost') return false
    this.sent.push(n)
    return true
  }
}

export class NotificationCenter {
  list: Notification[] = []
  queue: Notification[] = []
  private active = new Set<string>()
  private nextId = 1

  constructor(readonly earth = new MockEarthSender()) {}

  /** Raise a critical notification once per (crew, metric) while the condition lasts. */
  raise(crewId: string | null, metricId: string, message: string, time: number): Notification | null {
    const key = `${crewId}:${metricId}`
    if (this.active.has(key)) return null
    this.active.add(key)
    const n: Notification = {
      id: this.nextId++,
      time,
      crewId,
      metricId,
      level: 'red',
      message,
      targets: ['crew', 'earth', 'screen'],
      earth: 'queued',
    }
    this.list.unshift(n)
    this.deliver(n, time)
    return n
  }

  /** Condition is over: the same metric may notify again later. The record stays in the list. */
  clear(crewId: string | null, metricId: string) {
    this.active.delete(`${crewId}:${metricId}`)
  }

  setLink(state: LinkState, time: number) {
    this.earth.state = state
    if (state === 'lost') return
    const waiting = this.queue
    this.queue = []
    waiting.forEach((n) => this.deliver(n, time))
  }

  private deliver(n: Notification, time: number) {
    if (this.earth.send(n)) {
      n.earth = 'sent'
      n.earthSentAt = time
    } else {
      n.earth = 'queued'
      this.queue.push(n)
    }
  }
}
