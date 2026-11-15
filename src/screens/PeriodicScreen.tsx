// Periodic screen (Periodic Health Tasks Checklist): the periodic tasks of one astronaut, when each was
// done and is due, the latest result coloured by its limit, and the history of the selected task.
import { useState } from 'react'
import { CrewTabs } from '../components/CrewTabs'
import { InfoTip } from '../components/InfoTip'
import { ReactionTest } from '../components/ReactionTest'
import { Value } from '../components/Value'
import { crew, metricConfig, useSystem } from '../core/system'
import { CheckinPanel, LabPanel } from './CrewCharts'
import { MetricHistory } from './MetricHistory'

const date = (t: number) => new Date(t).toISOString().slice(0, 10)
const DAY = 86400000
const STATE = { done: 'On schedule', due: 'Due', overdue: 'Overdue – report' }

export function PeriodicScreen({ crewId, onSelect }: { crewId: string; onSelect: (id: string) => void }) {
  const sys = useSystem()
  const [sel, setSel] = useState('cognition')
  const rows = sys.periodicTasks(crewId)
  const cur = rows.find((r) => r.task.id === sel)!
  const name = crew.find((c) => c.id === crewId)!.name
  const days = (t: number) => Math.round((t - sys.now) / DAY)
  return (
    <main className="screen periodic">
      <CrewTabs crewId={crewId} onSelect={onSelect} />
      <div className="split">
        <section className="panel" aria-label="Periodic tasks">
          <div className="panel-head">
            <h2>Periodic health tasks · {name}</h2>
            <InfoTip title="Periodic tasks">
              <span>Health tasks that are not on the main screen but must be done at set intervals (Periodic Health Tasks Checklist). A task shows <b>Due</b> when its time has come and <b>Overdue</b> after 7 days; report an overdue task to the flight surgeon.</span>
              <ul>
                <li>Value colour: green normal, yellow caution (report at the weekly private medical conference), red critical (start the first steps now, same-day medical conference).</li>
                <li>Two yellow results in a row on the same task are reported like a red one (proposal).</li>
                <li>Intervals marked "proposal" come from the draft checklist and must be approved by the flight surgeon.</li>
              </ul>
            </InfoTip>
          </div>
          <table className="task-table">
            <thead><tr><th>Task</th><th>How</th><th>Last</th><th>Next</th><th>Latest result</th></tr></thead>
            <tbody>
              {rows.map((r) => {
                const m = r.task.metrics.find((id) => sys.latest(id, crewId))
                return (
                  <tr key={r.task.id} aria-selected={r.task.id === sel} data-state={r.state} onClick={() => setSel(r.task.id)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setSel(r.task.id)}>
                    <td><b>{r.task.label}</b></td>
                    <td className="muted">{r.task.how}</td>
                    <td className="num">{r.last ? date(r.last) : '—'}</td>
                    <td className="num task-state">{STATE[r.state]}<small>{r.state === 'done' ? ` · in ${days(r.next)} d` : ` · since ${-days(r.next)} d`}</small></td>
                    <td>{m ? <Value value={sys.latest(m, crewId)!.value} unit={metricConfig(m).unit} status={sys.status(m, crewId)} /> : r.task.id === 'symptoms' ? <span className="muted">see check-in</span> : <span className="muted">—</span>}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </section>
        <section className="panel task-detail" aria-label={cur.task.label}>
          <div className="panel-head"><h2>{cur.task.label}</h2><span className="tag">SIM</span></div>
          <p className="task-why"><b>How often:</b> {cur.task.frequency}. <b>Why:</b> {cur.task.why}</p>
          {cur.task.id === 'reaction' && <ReactionTest crewId={crewId} />}
          {cur.task.id === 'lab' ? <LabPanel crewId={crewId} /> : cur.task.id === 'symptoms' ? <CheckinPanel crewId={crewId} /> : <MetricHistory key={`${crewId}${sel}`} ids={cur.task.metrics} crewId={crewId} size={[640, cur.task.metrics.length > 1 ? 170 : 260]} />}
        </section>
      </div>
    </main>
  )
}
