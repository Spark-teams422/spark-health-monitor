// History of one or more values: chart with caution / critical bands, then every reading coloured by level.
import { useState } from 'react'
import { clock } from '../components/NotificationList'
import { instantLevel } from '../core/statusEngine'
import { metricConfig, useSystem } from '../core/system'
import { TrendChart } from './PersonalCharts'

export const WINDOWS = [
  { label: '2 weeks', hours: 14 * 24 },
  { label: '3 months', hours: 90 * 24 },
  { label: 'Whole mission', hours: Infinity },
]

export function MetricHistory({ ids, crewId, size = [640, 200] }: { ids: string[]; crewId: string; size?: [number, number] }) {
  const sys = useSystem()
  const [hours, setHours] = useState(Infinity)
  return (
    <div className="mh">
      <div className="seg" role="group" aria-label="Time frame">
        {WINDOWS.map((w) => <button key={w.label} aria-pressed={hours === w.hours} onClick={() => setHours(w.hours)}>{w.label}</button>)}
      </div>
      {ids.map((id) => {
        const rows = sys.history(id, crewId).filter((m) => m.time > sys.now - hours * 3600_000)
        const cfg = metricConfig(id)
        return (
          <div key={id} className="mh-block">
            {rows.length >= 2 ? <TrendChart metricId={id} crewId={crewId} hours={hours} size={size} plain={cfg.scope === 'info'} /> : <div className="empty"><b>{cfg.label}</b><span className="muted">{rows.length ? 'One reading in this period' : 'No reading in this period'}</span></div>}
            <details className="mh-table">
              <summary>{rows.length} readings · {cfg.label}</summary>
              <table><tbody>
                {[...rows].reverse().map((m) => (
                  <tr key={m.time}><td className="num">{new Date(m.time).toISOString().slice(0, 10)} {clock(m.time)}</td><td className="num mt-value" data-level={cfg.scope === 'info' ? 'nodata' : instantLevel(id, m.value, sys.context(crewId))}>{m.value} <small>{m.unit}</small></td></tr>
                ))}
              </tbody></table>
            </details>
            <span className="muted note">{cfg.source}</span>
          </div>
        )
      })}
    </div>
  )
}
