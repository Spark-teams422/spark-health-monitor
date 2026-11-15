import { Pause, Play, StepForward, Table2 } from 'lucide-react'
import { useRef } from 'react'
import mission from '../config/mission.json'
import { SCENARIOS, type ScenarioId } from '../core/simulator'
import { crew, metricConfig, metricIds, useSystem } from '../core/system'
import { clock, NotificationList } from './NotificationList'
import { StatusBadge } from './StatusBadge'

const IDS = Object.keys(SCENARIOS) as ScenarioId[]

/** Demo/developer bar: pick a scenario, run the clock, open the raw engine output. Not part of the flight UI. */
export function SimulatorPanel() {
  const sys = useSystem()
  const table = useRef<HTMLDialogElement>(null)
  const rows: [string, string | null][] = [
    ...crew.flatMap((c) => [...metricIds('crew'), ...(sys.evaCrewId === c.id ? metricIds('eva') : [])].map((id): [string, string] => [id, c.id])),
    ...metricIds('cabin').map((id): [string, null] => [id, null]),
  ]
  return (
    <div className="simbar" aria-label="Simulator">
      <span className="label">Scenario</span>
      <select aria-label="Scenario" value={sys.scenario} onChange={(e) => sys.setScenario(e.target.value as ScenarioId)}>
        <optgroup label="Cabin">{IDS.filter((id) => !id.startsWith('eva')).map((id) => <option key={id} value={id}>{SCENARIOS[id]}</option>)}</optgroup>
        <optgroup label="EVA">{IDS.filter((id) => id.startsWith('eva')).map((id) => <option key={id} value={id}>{SCENARIOS[id]}</option>)}</optgroup>
      </select>
      <button className="icon-btn" onClick={() => sys.setRunning(!sys.running)} aria-pressed={sys.running}>
        {sys.running ? <Pause size={14} /> : <Play size={14} />}{sys.running ? 'Pause' : 'Run'}
      </button>
      <button className="icon-btn" onClick={() => sys.tick()}><StepForward size={14} />+1 min</button>
      <div className="seg" role="group" aria-label="Simulation speed">
        {mission.sim.speeds.map((x) => <button key={x} aria-pressed={sys.speed === x} onClick={() => sys.setSpeed(x)} title={`1 second = ${x} mission minute${x > 1 ? "s" : ""}`}>{x}×</button>)}
      </div>
      <span className="muted num">{clock(sys.now)} UTC · 1 s = {sys.speed} min · seed 42</span>
      <button className="icon-btn ghost" onClick={() => table.current?.showModal()}><Table2 size={14} />Engine output</button>

      <dialog ref={table} className="panel engine-dialog">
        <div className="row">
          <h2>Status engine output</h2>
          <button className="ghost" style={{ marginLeft: 'auto' }} onClick={() => table.current?.close()}>Close</button>
        </div>
        <div className="engine-cols">
          <table>
            <thead><tr><th>Who</th><th>Metric</th><th>Value</th><th>Status</th></tr></thead>
            <tbody>
              {rows.map(([id, who]) => {
                const m = sys.latest(id, who)
                return (
                  <tr key={`${who}:${id}`}>
                    <td>{who ?? 'Cabin'}</td>
                    <td>{metricConfig(id).label}</td>
                    <td>{m ? `${m.value} ${m.unit}` : '—'}</td>
                    <td><StatusBadge status={sys.status(id, who)} /></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div className="stack">
            <h2>Notification log ({sys.notifications.list.length})</h2>
            <NotificationList max={50} />
            <span className="muted">Mock Earth sender: {sys.notifications.earth.sent.length} delivered, {sys.notifications.queue.length} waiting.</span>
          </div>
        </div>
      </dialog>
    </div>
  )
}
