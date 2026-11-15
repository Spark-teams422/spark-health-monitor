// EVA panel (Step 3, "EVA Panel v2"): black, big type, 5 physical keys. Touch works on the main (summary) view
// only; every view also works with the keys.
// Everything shown comes from the shared layer; no limit lives here.
import { useCallback, useEffect, useRef, useState } from 'react'
import { CheckSquare, ListChecks, Square, ChevronDown, ChevronUp, CornerDownLeft, Undo2, TriangleAlert, Home, Wind, Gauge, CloudFog, Activity, Thermometer, Footprints, Radio, type LucideIcon } from 'lucide-react'
import { Limits } from '../components/Limits'
import { Spark } from '../components/Spark'
import { LEVEL_UI, Shape as Mark } from '../components/StatusBadge'
import menu from '../config/evaEmergency.json'
import acuteTree from '../config/acuteTree.json'
import { instructions } from '../core/acute'
import { returnMetabolicRate } from '../core/eva'
import { thresholds } from '../core/statusEngine'
import { crew, metricConfig, useSystem, type EvaTask } from '../core/system'
import type { Level, Status } from '../core/types'

const HOLD_MS = 3000 // emergency_hold_s in the EVA document
const MARGIN_BAR_MIN = 120 // full width of the margin bar (display scale only)
type View = { name: 'summary' } | { name: 'consumables' } | { name: 'health'; block: number } | { name: 'emergency'; chosen: number | null; sub?: number }
/** S4 labels of the decision tree, suit version of "Something else" (EVA document, emergency menu) */
const S4 = acuteTree.redFlags.options

/** The six health blocks of the summary screen and the metrics each one stands for. */
const BLOCKS: { title: string; sub: string; icon: LucideIcon; metrics: string[] }[] = [
  { title: 'O₂', sub: 'Primary O₂ time left', icon: Wind, metrics: ['eva_o2'] },
  { title: 'Suit pressure', sub: 'Suit internal pressure', icon: Gauge, metrics: ['eva_suit_pressure'] },
  { title: 'Inspired CO₂', sub: 'CO₂ in helmet air', icon: CloudFog, metrics: ['eva_pico2', 'eva_pico2_excess'] },
  { title: 'Workload', sub: 'Metabolic rate · heart rate', icon: Activity, metrics: ['eva_metabolic_rate', 'eva_heart_rate'] },
  { title: 'Heat', sub: 'Core temperature', icon: Thermometer, metrics: ['eva_core_temp', 'eva_core_rise', 'eva_skin_rise'] },
  { title: 'Orthostatic', sub: 'G-TRANSIT risk index', icon: Footprints, metrics: ['eva_ori', 'eva_orthostatic_hr_rise'] },
]
const ENVIRONMENT = { title: 'Environment', sub: 'Radiation · voice · habitat link', icon: Radio, metrics: ['eva_radiation', 'eva_partner_voice_loss', 'eva_habitat_link_loss'] }
const RANK: Record<Level, number> = { nodata: 0, green: 1, yellow: 2, red: 3 }
const mins = (m: number) => (m >= 60 ? `${Math.floor(m / 60)} h ${String(Math.round(m % 60)).padStart(2, '0')}` : `${Math.max(0, Math.round(m))} min`)

function Shape({ status }: { status: Status }) {
  // silent caution: small amber trend mark only, never an alert
  if (status.silent) return <span className="eva-trend" title={status.reason}><Mark level="green" size={14} /> Normal <b>trend</b></span>
  const ui = LEVEL_UI[status.level]
  return <span className="badge" data-level={status.level}><Mark level={status.level} size={14} /> {ui.word}</span>
}


/** Outside an EVA: the task list can be edited (add, rename, reorder, remove, reset). */
function TaskEditor({ tasks, onChange, onClose }: { tasks: EvaTask[]; onChange: (t: EvaTask[] | null) => void; onClose: () => void }) {
  const [text, setText] = useState('')
  const move = (i: number, d: number) => { const t = [...tasks]; const [x] = t.splice(i, 1); t.splice(i + d, 0, x); onChange(t) }
  return (
    <div className="eva-detail eva-tasks-edit">
      <h2>EVA tasks · edit before the EVA <span className="tag">SAMPLE</span></h2>
      <ol className="eva-task-list">
        {tasks.map((t, i) => (
          <li key={t.id}>
            <button className="eva-check" aria-pressed={t.done} onClick={() => onChange(tasks.map((x) => (x.id === t.id ? { ...x, done: !x.done } : x)))} aria-label="Done">{t.done ? <CheckSquare size={22} /> : <Square size={22} />}</button>
            <input value={t.label} onChange={(e) => onChange(tasks.map((x) => (x.id === t.id ? { ...x, label: e.target.value } : x)))} aria-label={`Task ${i + 1}`} />
            <button disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up"><ChevronUp size={18} /></button>
            <button disabled={i === tasks.length - 1} onClick={() => move(i, 1)} aria-label="Move down"><ChevronDown size={18} /></button>
            <button onClick={() => onChange(tasks.filter((x) => x.id !== t.id))}>Remove</button>
          </li>
        ))}
      </ol>
      <form className="eva-task-add" onSubmit={(e) => { e.preventDefault(); if (text.trim()) { onChange([...tasks, { id: Math.max(0, ...tasks.map((x) => x.id)) + 1, label: text.trim(), done: false }]); setText('') } }}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="New task" aria-label="New task" />
        <button type="submit">Add</button>
        <button type="button" onClick={() => onChange(tasks.map((x) => ({ ...x, done: false })))}>Uncheck all</button>
        <button type="button" onClick={() => onChange(null)}>Reset to mission plan</button>
        <button type="button" className="primary" onClick={onClose}>Close</button>
      </form>
    </div>
  )
}

function TaskRow({ next, left, total, selected, onOpen, hint }: { next: EvaTask | undefined; left: number; total: number; selected?: boolean; onOpen?: () => void; hint?: string }) {
  return (
    <button className={`eva-task-row eva-sel-${!!selected}`} onClick={onOpen} tabIndex={onOpen ? 0 : -1}>
      <ListChecks size={24} />
      <span className="eva-label">Next task</span>
      <b>{next ? next.label : 'All tasks done'}</b>
      <span className="eva-sub">{left} of {total} left{hint && next ? ` · ${hint}` : ''}</span>
    </button>
  )
}

export function EvaScreen() {
  const sys = useSystem()
  const [view, setView] = useState<View>({ name: 'summary' })
  const [cursor, setCursor] = useState(0)
  const [editing, setEditing] = useState(false)
  const [hold, setHold] = useState(0) // 0..1 fill of the emergency ring
  const holdStart = useRef<number | null>(null)
  const eva = sys.eva
  const id = eva?.telemetry.crewId ?? ''
  const blocks = eva?.telemetry.surface ? BLOCKS : [...BLOCKS.slice(0, 5), ENVIRONMENT]
  const worstOf = (metrics: string[]) => metrics.map((m) => sys.status(m, id)).reduce((a, b) => (RANK[b.level] > RANK[a.level] ? b : a))
  const alerts = sys.evaAlerts()
  const critical = alerts.find((a) => a.status.level === 'red')
  const tasks = sys.evaTasks
  const nextTask = tasks.find((x) => !x.done)
  const left = tasks.filter((x) => !x.done).length
  // summary cursor: 0 return budget, 1 "Returning", 2.. health blocks, last = task row
  const TASK_ROW = blocks.length + 2
  const other = view.name === 'emergency' && view.chosen !== null && menu.options[view.chosen].id === 'other' && view.sub === undefined
  const count = view.name === 'summary' ? blocks.length + 3 : view.name === 'emergency' && view.chosen === null ? menu.options.length : other ? S4.length : 0
  const [returnSent, setReturnSent] = useState<number | null>(null)

  const openMenu = useCallback(() => {
    // the option a sensor points to comes pre-selected; opening the menu already notifies (EVA document)
    const hot = menu.options.findIndex((o) => o.shows.some((m) => ['yellow', 'red'].includes(sys.status(m, id).level)))
    setCursor(Math.max(0, hot))
    setView({ name: 'emergency', chosen: null })
    sys.evaEmergency('menu opened')
  }, [id, sys])

  const press = useCallback(
    (key: 1 | 2 | 3 | 4 | 5) => {
      if (key === 1 && count) setCursor((c) => (c + count - 1) % count)
      if (key === 2 && count) setCursor((c) => (c + 1) % count)
      if (key === 3) {
        if (view.name === 'summary') {
          if (cursor === 0) setView({ name: 'consumables' })
          else if (cursor === TASK_ROW) { if (nextTask) sys.toggleEvaTask(nextTask.id) } // select = this task done, the row moves to the next
          else if (cursor >= 2) setView({ name: 'health', block: cursor - 2 })
          // cursor 1 ("Returning") needs T3 held, see holdDown
        } else if (view.name === 'emergency' && view.chosen === null) {
          setView({ name: 'emergency', chosen: cursor })
          sys.evaEmergency(menu.options[cursor].label)
          if (menu.options[cursor].id === 'other') setCursor(0)
        } else if (other) {
          setView({ ...view, sub: cursor })
          sys.evaEmergency(`Something else: ${S4[cursor].label}`)
        }
      }
      if (key === 4) {
        if (view.name === 'emergency' && view.sub !== undefined) setView({ name: 'emergency', chosen: view.chosen })
        else if (view.name === 'emergency' && view.chosen !== null) setView({ name: 'emergency', chosen: null })
        else { setView({ name: 'summary' }); setCursor(0) }
      }
      if (key === 5 && alerts[0]) sys.ackEvaAlert((alerts.find((a) => !a.acked) ?? alerts[0]).metricId)
    },
    [TASK_ROW, alerts, count, cursor, nextTask, other, sys, view],
  )

  // T5 held for 3 s opens the emergency menu; T3 (or a touch) held for 3 s on "Returning" sends it. A bar shows the hold.
  const holdKind = useRef<'emergency' | 'return'>('emergency')
  const holdDown = (kind: 'emergency' | 'return' = 'emergency') => {
    if (holdStart.current === null) { holdStart.current = Date.now(); holdKind.current = kind }
  }
  const holdUp = useCallback(() => {
    if (holdStart.current !== null && Date.now() - holdStart.current < HOLD_MS && holdKind.current === 'emergency') press(5)
    holdStart.current = null
    setHold(0)
  }, [press])
  const done = useRef({ openMenu, returning: () => { sys.evaReturning(); setReturnSent(sys.now) } })
  done.current = { openMenu, returning: () => { sys.evaReturning(); setReturnSent(sys.now) } }
  useEffect(() => {
    const timer = setInterval(() => {
      if (holdStart.current === null) return
      const f = (Date.now() - holdStart.current) / HOLD_MS
      setHold(Math.min(1, f))
      if (f >= 1) {
        holdStart.current = null
        setHold(0)
        if (holdKind.current === 'return') done.current.returning()
        else done.current.openMenu()
      }
    }, 100)
    return () => clearInterval(timer)
  }, [])

  // keyboard = the 5 physical keys: arrows / Enter / Backspace / A, or digits 1-5
  useEffect(() => {
    const map: Record<string, 1 | 2 | 3 | 4 | 5> = { ArrowUp: 1, ArrowDown: 2, Enter: 3, Backspace: 4, Escape: 4, a: 5, '1': 1, '2': 2, '3': 3, '4': 4, '5': 5 }
    const down = (e: KeyboardEvent) => {
      const k = map[e.key]
      if (!k) return
      e.preventDefault()
      if (k === 5) holdDown()
      else if (k === 3 && view.name === 'summary' && cursor === 1) holdDown('return')
      else if (!e.repeat) press(k)
    }
    const up = (e: KeyboardEvent) => (map[e.key] === 5 || map[e.key] === 3) && holdUp()
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [press, holdUp, view.name, cursor])

  if (!eva) {
    if (editing) return <main className="eva-panel eva-idle"><TaskEditor tasks={tasks} onChange={(t) => sys.setEvaTasks(t)} onClose={() => setEditing(false)} /></main>
    return (
      <main className="eva-panel eva-idle">
        <div className="eva-strip">
          <span>EVA panel · standby</span>
          <span className="eva-sub">Opens by itself when the airlock opens · choose an EVA scenario to simulate</span>
        </div>
        <div className="eva-blocks eva-standby">
          {[...BLOCKS, ENVIRONMENT].map((b) => (
            <div key={b.title} className="eva-block">
              <span className="eva-label"><b.icon size={22} strokeWidth={1.75} /> {b.title}</span>
              <span className="eva-sub">{b.sub}</span>
              <ul className="eva-list">{b.metrics.map((m) => <li key={m}>{metricConfig(m).label}<Limits metricId={m} ctx={sys.context(crew[0].id)} /></li>)}</ul>
            </div>
          ))}
          <div className="eva-block">
            <span className="eva-label">Panel keys</span>
            <ul className="eva-list">
              <li>T1 / T2 · move up / down</li>
              <li>T3 · open detail</li>
              <li>T4 · back</li>
              <li>T5 · acknowledge · hold 3 s for emergency</li>
              <li>T3 held 3 s on Returning · tell partner and habitat</li>
            </ul>
          </div>
        </div>
        <TaskRow next={nextTask} left={left} total={tasks.length} onOpen={() => setEditing(true)} />
      </main>
    )
  }

  const { telemetry: t, derived: d } = eva
  const value = (metricId: string) => {
    const m = sys.latest(metricId, id)
    return m ? `${m.value}${m.unit ? ` ${m.unit}` : ''}` : '— no data'
  }
  const blockValue = (title: string) => {
    switch (title) {
      case 'O₂': return [mins(sys.latest('eva_o2', id)?.value ?? 0), t.backupO2Active ? 'BACKUP O₂ ACTIVE' : t.backupO2Full ? 'backup full' : 'backup NOT full']
      case 'Suit pressure': return [value('eva_suit_pressure'), '']
      case 'Inspired CO₂': return [value('eva_pico2'), '']
      case 'Workload': return [value('eva_metabolic_rate'), `HR ${value('eva_heart_rate')}`]
      case 'Heat': return [value('eva_core_temp'), `core +${Math.max(0, sys.latest('eva_core_rise', id)?.value ?? 0).toFixed(1)} °C`]
      case 'Orthostatic': return [d.ori?.ori != null ? `ORI ${d.ori.ori.toFixed(0)}` : '— no data', d.ori?.hrExpected ? `HR expected ${d.ori.hrExpected.toFixed(0)} · measured ${t.hr.toFixed(0)}` : 'HR not used (effort)']
      default: return [t.sepStarted ? 'SOLAR EVENT' : t.sepWarning ? 'Solar warning' : 'Quiet', `partner voice ${t.partnerVoiceLossMin > 0 ? `lost ${t.partnerVoiceLossMin} min` : 'OK'}`]
    }
  }
  const budgetStatus = worstOf(['eva_return_by', 'eva_margin', 'eva_suit_time', 'eva_suit_time_with_return'])
  const limiting = d.budget.rows.find((r) => r.id === d.budget.limitingId)!
  const partnerRole = crew.find((c) => c.id === t.partner.id)?.role

  return (
    <main className="eva-panel">
      <div className="eva-screen">
        <div className="eva-strip">
          <span>EVA · {id} · {t.surface ? `${t.body === 'mars' ? 'Mars' : 'Moon'} surface` : 'Microgravity'}</span>
          <span>Suit time {mins(t.suitTimeMin)}</span>
          <span><Shape status={worstOf(ENVIRONMENT.metrics)} /> environment</span>
          <span className="tag">SIM</span>
        </div>

        {critical && view.name !== 'emergency' && (
          <div className="eva-critical" role="alert">
            <b><Mark level="red" size={18} /> {critical.status.reason.toUpperCase()}</b>
            <span>{critical.action}{critical.acked ? ' · acknowledged' : ''}</span>
          </div>
        )}

        {view.name === 'summary' && (
          <>
            <div className={`eva-budget eva-sel-${cursor === 0}`} data-level={budgetStatus.level}>
              <div className="eva-touch" onClick={() => { setCursor(0); setView({ name: 'consumables' }) }}>
                <span className="eva-label">Return by</span>
                <span className="eva-big">{mins(d.budget.returnBy)}</span>
                <span className="eva-label">limited by {limiting.label}</span>
              </div>
              <div className="eva-margin">
                <span className="eva-label">Margin {mins(d.budget.margin)} <Shape status={budgetStatus} /></span>
                <progress max={MARGIN_BAR_MIN} value={Math.max(0, Math.min(MARGIN_BAR_MIN, d.budget.margin))} />
                <span className="eva-label">remaining {mins(d.budget.remaining)} · return trip {mins(t.returnMin)}</span>
              </div>
              <button className={`eva-return eva-sel-${cursor === 1}`} data-sent={returnSent !== null}
                onPointerDown={() => { setCursor(1); holdDown('return') }} onPointerUp={holdUp} onPointerLeave={() => holdStart.current !== null && holdUp()}>
                <Home size={22} /> Returning
                <small>{returnSent !== null ? 'Sent to partner and habitat' : 'Hold T3 · 3 s'}</small>
                {holdKind.current === 'return' && hold > 0 && <progress max={1} value={hold} />}
              </button>
            </div>
            <div className="eva-blocks">
              {blocks.map((b, i) => {
                const st = worstOf(b.metrics)
                const [main, sub] = blockValue(b.title)
                return (
                  <div key={b.title} className={`eva-block eva-touch eva-sel-${cursor === i + 2}`} data-level={st.silent ? 'green' : st.level} onClick={() => { setCursor(i + 2); setView({ name: 'health', block: i }) }}>
                    <span className="eva-label"><b.icon size={22} strokeWidth={1.75} /> {b.title}<Limits metricId={b.metrics[0]} ctx={sys.context(id)} /></span>
                    <span className="eva-value">{main}</span>
                    <span className="eva-sub">{sub || b.sub}</span>
                    <Shape status={st} />
                  </div>
                )
              })}
            </div>
            <TaskRow next={nextTask} left={left} total={tasks.length} selected={cursor === TASK_ROW} onOpen={() => { setCursor(TASK_ROW); if (nextTask) sys.toggleEvaTask(nextTask.id) }} hint="T3 · done, next task" />
          </>
        )}

        {view.name === 'consumables' && (
          <div className="eva-detail">
            <h2>Consumables · most limiting first</h2>
            <table>
              <thead><tr><th>Item</th><th>Lasts</th><th>Return by</th></tr></thead>
              <tbody>
                {[...d.budget.rows].sort((a, b) => a.returnBy - b.returnBy).map((r) => (
                  <tr key={r.id} className={r.id === d.budget.limitingId ? 'eva-limiting' : ''}>
                    <td>{r.label}{r.id === d.budget.limitingId ? ' · limiting' : ''}</td><td>{mins(r.remaining)}</td><td>{mins(r.returnBy)}</td>
                  </tr>
                ))}
                <tr><td>Drinking water</td><td>{value('eva_drink_bag')} bag</td><td>{value('eva_drink_rate')}</td></tr>
                <tr><td>Total suit time</td><td>{mins(t.suitTimeMin)}</td><td>{value('eva_suit_time_with_return')} incl. return</td></tr>
              </tbody>
            </table>
            <span className="eva-label">
              Return trip counted at {returnMetabolicRate(d.metPrimary).toFixed(0)} BTU/h (now {d.metPrimary.toFixed(0)}) plus a {thresholds.eva.reserveMin}-min reserve.
            </span>
          </div>
        )}

        {view.name === 'health' && (
          <div className="eva-detail">
            <h2>{blocks[view.block].title} · last 15 min</h2>
            {blocks[view.block].metrics.map((m) => {
              const st = sys.status(m, id)
              return (
                <div key={m} className="eva-row">
                  <span className="eva-label">{metricConfig(m).label}</span>
                  <span className="eva-value">{value(m)}</span>
                  <Spark className="eva-spark" points={sys.history(m, id).slice(-15)} label={metricConfig(m).label} unit={metricConfig(m).unit} />
                  <Shape status={st} />
                </div>
              )
            })}
            {blocks[view.block].title === 'Orthostatic' && d.ori && (
              <span className="eva-label">
                Components {Object.entries(d.ori.components).map(([k, v]) => `${k} ${(v as number).toFixed(2)}`).join(' · ')}
                {Object.keys(d.ori.excluded).length > 0 && ` · not used: ${Object.keys(d.ori.excluded).join(', ')}`}
                {d.ori.recommendations.length > 0 && ` · suggested: ${d.ori.recommendations.join(', ')}`}
              </span>
            )}
          </div>
        )}

        {view.name === 'emergency' && view.chosen === null && (
          <div className="eva-detail">
            <h2>EVA emergency · what is wrong?</h2>
            <span className="eva-sub">Partner, habitat and Earth were notified when this menu opened. T1 / T2 move · T3 select.</span>
            {menu.options.map((o, i) => (
              <div key={o.id} className={`eva-option eva-sel-${cursor === i}`} data-hot={o.shows.some((m) => ['yellow', 'red'].includes(sys.status(m, id).level))}>
                <span>{o.label}</span>
                <span className="eva-sub">{o.shows.map(value).join(' · ')}</span>
              </div>
            ))}
          </div>
        )}
        {view.name === 'emergency' && view.chosen !== null && other && (
          <div className="eva-detail">
            <h2>Something else · which sign?</h2>
            <span className="eva-sub">Decision tree S4 signs, suit version: the suit steps are the same; the card follows after the airlock.</span>
            <div className="eva-s4">
              {S4.map((o, i) => <div key={o.label} className={`eva-option eva-sel-${cursor === i}`}><span>{o.label}</span></div>)}
            </div>
          </div>
        )}
        {view.name === 'emergency' && view.chosen !== null && !other && (() => {
          const o = menu.options[view.chosen]
          const sign = o.id === 'other' && view.sub !== undefined ? S4[view.sub] : null
          const card = sign && instructions[sign.to]
          return (
            <div className="eva-detail">
              <h2>{sign ? sign.label : o.label}</h2>
              <span className="eva-label">{menu.commonFirstSteps}</span>
              {o.steps.length > 0 && <ol>{o.steps.map((x) => <li key={x}>{x}</li>)}</ol>}
              {o.id === 'partner' && (
                <span className="eva-label">Assisted return: you return by {mins(d.budget.returnBy)}, partner {t.partner.id} by {mins(t.partner.returnBy)}; the shorter one sets the return ({mins(Math.min(d.budget.returnBy, t.partner.returnBy))}).</span>
              )}
              <span className="eva-sub">Continues with: {sign ? `${sign.to}${card ? ` · ${card.title}` : ''} after the airlock` : o.goesTo}. Partner, habitat and Earth were notified.</span>
            </div>
          )
        })()}

        <div className="eva-footer">
          <span>Partner {t.partner.id}{partnerRole ? ` (${partnerRole})` : ''} · return by {mins(t.partner.returnBy)} · <Mark level={t.partner.level} size={12} /> {LEVEL_UI[t.partner.level].word} · voice {t.partnerVoiceLossMin > 0 ? `lost ${t.partnerVoiceLossMin} min` : 'OK'}</span>
          <span className="eva-alerts">
            {alerts.filter((a) => a.status.level === 'yellow').slice(0, 1).map((a) => (
              <span key={a.metricId} className="badge" data-level="yellow"><Mark level="yellow" size={14} /> {a.status.reason}. {a.action}{a.acked ? ' · ack' : ''}</span>
            ))}
            {alerts.length > 1 && <span className="eva-sub"> +{alerts.length - 1} more</span>}
            {alerts.length === 0 && <span className="badge" data-level="green"><Mark level="green" size={14} /> No alerts</span>}
          </span>
        </div>
      </div>

      <div className="eva-keys" aria-label="Panel keys">
        <button onClick={() => press(1)}><ChevronUp size={26} />T1<small>Up</small></button>
        <button onClick={() => press(2)}><ChevronDown size={26} />T2<small>Down</small></button>
        <button onClick={() => press(3)}><CornerDownLeft size={24} />T3<small>Select</small></button>
        <button onClick={() => press(4)}><Undo2 size={24} />T4<small>Back</small></button>
        <button className="eva-t5" onPointerDown={() => holdDown()} onPointerUp={holdUp} onPointerLeave={() => holdStart.current !== null && holdUp()}>
          <TriangleAlert size={24} />T5<small>Ack · hold 3 s: emergency</small>
          <progress max={1} value={holdKind.current === 'emergency' ? hold : 0} />
        </button>
      </div>
    </main>
  )
}
