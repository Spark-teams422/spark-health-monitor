// Tasks & Calendar: the astronaut picks their own name; below it today's task list (commander, Earth, check-in,
// periodic health tasks that are due, EVA, exercise, own events). Right: the month calendar; a day shows what is
// planned for it. Crew birthdays are visible to everyone, family birthdays only to that astronaut. Data: system.agenda().
import { CalendarPlus, ListPlus, Cake, ChevronLeft, ChevronRight, CircleCheck, Circle, Lock, Trash2, Users } from 'lucide-react'
import { useRef, useState, type FormEvent } from 'react'
import { CheckInButton } from '../components/CheckIn'
import { clock } from '../components/NotificationList'
import { crew, useSystem, type AgendaItem } from '../core/system'
import { CheckinChain } from './CrewCharts'

const DAY = 86_400_000
const iso = (t: number) => new Date(t).toISOString().slice(0, 10)
const KIND: Record<AgendaItem['kind'], string> = { own: 'My task', assigned: 'Commander', earth: 'Earth', checkin: 'Check-in', periodic: 'Health task', eva: 'EVA', exercise: 'Exercise', event: 'Event', birthday: 'Birthday', family: 'Family' }
const WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function Item({ it, crewId, onToggle, checkinButton }: { it: AgendaItem; crewId: string; onToggle?: () => void; checkinButton?: boolean }) {
  const sys = useSystem()
  const toggle = it.done !== null && onToggle && ['own', 'assigned', 'earth', 'eva', 'exercise'].includes(it.kind)
  const ev = it.kind === 'event' ? sys.agendaState.events.find((e) => `ev${e.id}` === it.key) : null
  const own = it.kind === 'own' ? sys.agendaState.tasks.find((t) => `t${t.id}` === it.key) : null
  return (
    <li className="ag-item" data-kind={it.kind} data-done={it.done === true} data-overdue={!!it.overdue}>
      {toggle ? (
        <button className="ag-check" aria-pressed={it.done === true} onClick={onToggle} aria-label={it.done ? 'Mark as not done' : 'Mark as done'}>{it.done ? <CircleCheck size={20} /> : <Circle size={20} />}</button>
      ) : it.done === true ? <CircleCheck size={20} className="ag-auto" /> : it.done === false ? <Circle size={20} className="ag-auto" /> : it.kind === 'birthday' || it.kind === 'family' ? <Cake size={20} className="ag-auto" /> : <span className="ag-dot" />}
      <span className="ag-text">
        <b>{it.label}</b>
        <span className="muted">{KIND[it.kind]}{it.from ? ` · ${it.from}` : ''}{it.time !== null ? ` · ${clock(it.time)} UTC` : ''}{it.overdue ? ' · overdue – report' : it.kind === 'periodic' && it.done === false ? ' · due' : ''}</span>
      </span>
      {it.private && <Lock size={14} className="muted" aria-label="Only you see this" />}
      {checkinButton && <CheckInButton crewId={crewId} />}
      {ev && ev.crewId === crewId && <button className="ghost" aria-label="Delete event" onClick={() => sys.removeEvent(ev.id)}><Trash2 size={16} /></button>}
      {own && <button className="ghost" aria-label="Delete task" onClick={() => sys.removeOwnTask(own.id)}><Trash2 size={16} /></button>}
    </li>
  )
}

function AddEvent({ crewId, day, onClose, task }: { crewId: string; day: number; onClose: () => void; task?: boolean }) {
  const sys = useSystem()
  const [title, setTitle] = useState('')
  const [date, setDate] = useState(iso(day))
  const [time, setTime] = useState('')
  const [shared, setShared] = useState(false)
  const save = (e: FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    const t = Date.parse(`${date}T${time || '00:00'}:00Z`)
    if (task) sys.addOwnTask({ crewId, title: title.trim(), time: t, allDay: !time })
    else sys.addEvent({ crewId, title: title.trim(), time: t, allDay: !time, shared })
    onClose()
  }
  return (
    <form className="ag-form" onSubmit={save}>
      <h3>{task ? 'Add task' : 'Add event'} · {crew.find((c) => c.id === crewId)?.name}</h3>
      <label>Title<input value={title} onChange={(e) => setTitle(e.target.value)} required autoFocus /></label>
      <div className="ag-form-row">
        <label>Date<input type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></label>
        <label>Time (UTC, empty = all day)<input type="time" value={time} onChange={(e) => setTime(e.target.value)} /></label>
      </div>
      {!task && <div className="seg" role="group" aria-label="Who can see it">
        <button type="button" aria-pressed={!shared} onClick={() => setShared(false)}><Lock size={14} /> Only me</button>
        <button type="button" aria-pressed={shared} onClick={() => setShared(true)}><Users size={14} /> Whole crew</button>
      </div>}
      {task && <span className="muted">A task is on your own list only.</span>}
      <div className="row">
        <button type="submit" className="primary">{task ? 'Save task' : 'Save event'}</button>
        <button type="button" onClick={onClose}>Cancel</button>
      </div>
    </form>
  )
}

export function TasksScreen({ crewId, onSelect }: { crewId: string; onSelect: (id: string) => void }) {
  const sys = useSystem()
  const today = Math.floor(sys.now / DAY) * DAY
  const [sel, setSel] = useState(today)
  const [month, setMonth] = useState(() => { const d = new Date(today); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1) })
  const dialog = useRef<HTMLDialogElement>(null)
  const [adding, setAdding] = useState<null | 'event' | 'task'>(null)
  const tasks = sys.agenda(crewId, today)
  const open = tasks.filter((t) => t.done === false).length
  const m = new Date(month)
  const days = new Date(Date.UTC(m.getUTCFullYear(), m.getUTCMonth() + 1, 1)).getTime() / DAY - month / DAY
  const counts = sys.agendaDays(crewId, month, days)
  const lead = m.getUTCDay()
  const shift = (n: number) => setMonth(Date.UTC(m.getUTCFullYear(), m.getUTCMonth() + n, 1))
  const dayItems = sys.agenda(crewId, sel)
  const birthdayOn = (t: number) => sys.agenda(crewId, t).some((x) => x.kind === 'birthday' || x.kind === 'family')
  const { day: missionDay } = sys.missionDay
  const openAdd = (what: 'event' | 'task') => { setAdding(what); dialog.current?.showModal() }
  const closeAdd = () => { dialog.current?.close(); setAdding(null) }

  return (
    <main className="screen tasks">
      <section className="panel ag-left" aria-label="My tasks">
        <div className="panel-head">
          <h2>My tasks</h2>
          <label className="ag-who">I am
            <select value={crewId} onChange={(e) => onSelect(e.target.value)}>
              {crew.map((c) => <option key={c.id} value={c.id}>{c.name} · {c.id} · {c.role}</option>)}
            </select>
          </label>
        </div>
        <CheckinChain crewId={crewId} compact />
        <div className="ag-box">
          <div className="ag-box-head"><b>Today · {iso(today)} · mission day {missionDay}</b><span className="muted">{open} open</span><button className="primary" onClick={() => openAdd('task')}><ListPlus size={16} /> Add task</button></div>
          <ul className="ag-list">
            {tasks.length === 0 ? <li className="muted">Nothing planned.</li> : tasks.map((t) => <Item key={t.key} it={t} crewId={crewId} onToggle={() => sys.toggleAgenda(crewId, t.key)} checkinButton={t === tasks.find((x) => x.kind === 'checkin' && x.done === false)} />)}
          </ul>
          <span className="muted note">Commander and Earth tasks, birthdays and events are sample data. <span className="tag">SIM</span></span>
        </div>
      </section>

      <section className="panel ag-right" aria-label="Calendar">
        <div className="panel-head">
          <h2>Calendar</h2>
          <div className="row">
            <button onClick={() => shift(-1)} aria-label="Previous month"><ChevronLeft size={18} /></button>
            <b className="ag-month">{m.toLocaleString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })}</b>
            <button onClick={() => shift(1)} aria-label="Next month"><ChevronRight size={18} /></button>
            <button className="primary" onClick={() => openAdd('event')}><CalendarPlus size={16} /> Add Event</button>
          </div>
        </div>
        <div className="ag-cal" role="grid" aria-label="Month">
          {WEEK.map((w) => <span key={w} className="ag-wd">{w}</span>)}
          {Array.from({ length: lead }, (_, i) => <span key={`l${i}`} />)}
          {Array.from({ length: days }, (_, i) => {
            const t = month + i * DAY
            return (
              <button key={t} className="ag-day" aria-pressed={t === sel} data-today={t === today} data-past={t < today} onClick={() => setSel(t)}>
                <span className="num">{i + 1}</span>
                <span className="ag-marks">
                  {birthdayOn(t) && <Cake size={13} />}
                  {counts[i] > 0 && <b className="num">{counts[i]}</b>}
                </span>
              </button>
            )
          })}
        </div>
        <div className="ag-daylist">
          <div className="ag-box-head"><b>{new Date(sel).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })}{sel === today ? ' · today' : ''}</b><span className="muted">{dayItems.length} item{dayItems.length === 1 ? '' : 's'}</span></div>
          <ul className="ag-list">
            {dayItems.length === 0 ? <li className="muted">Nothing planned.</li> : dayItems.map((t) => <Item key={t.key} it={t} crewId={crewId} onToggle={sel === today ? () => sys.toggleAgenda(crewId, t.key) : undefined} checkinButton={sel === today && t === dayItems.find((x) => x.kind === 'checkin' && x.done === false)} />)}
          </ul>
        </div>
      </section>
      <dialog ref={dialog} className="panel ag-dialog" onClose={() => setAdding(null)}>
        {adding && <AddEvent key={adding} crewId={crewId} day={adding === 'task' ? today : sel} onClose={closeAdd} task={adding === 'task'} />}
      </dialog>
    </main>
  )
}
