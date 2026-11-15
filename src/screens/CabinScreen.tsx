// Cabin screen: cabin values over time (with their caution / critical bands) and the crew radiation panel.
import { useEffect, useState } from 'react'
import { crew, metricConfig, useSystem } from '../core/system'
import { TrendChart } from './PersonalCharts'
import { CrewRadiation } from './RadiationCharts'
import { CabinRadiation } from './RouteRadiation'

const CABIN = ['cabin_co2', 'cabin_pio2', 'cabin_pressure', 'cabin_temp', 'radiation_rate', 'radiation_cumulative']
const WINDOWS = [1, 4, 12, 24]

export function CabinScreen() {
  const sys = useSystem()
  const [hours, setHours] = useState(24)
  const sep = sys.scenario === 'solarEvent'
  const [rad, setRad] = useState<'crew' | 'cabin'>(sep ? 'cabin' : 'crew')
  // the Mars-transit solar event scenario opens the route radiation layer (its default case is the Mars transit)
  useEffect(() => { if (sep) setRad('cabin') }, [sep])
  return (
    <main className="screen cabin">
      <div className="cabin-grid">
        <section className="panel cabin-values" aria-label="Cabin values over time">
          <div className="panel-head">
            <h2>Cabin values <span className="tag">SIM</span></h2>
            <span className="muted">{crew.length} crew share this air · yellow band Caution, red band Critical</span>
            <div className="seg" role="group" aria-label="Time frame">
              {WINDOWS.map((h) => <button key={h} aria-pressed={hours === h} onClick={() => setHours(h)}>{h} h</button>)}
            </div>
          </div>
          <div className="cabin-charts">
            {CABIN.map((id) => <div key={id} className="cabin-chart" title={metricConfig(id).source}><TrendChart metricId={id} crewId={null} hours={hours} size={[380, 190]} /></div>)}
          </div>
          {sys.commonCause().length > 0 && <div className="hint" role="status"><b>Several crew affected.</b> Check the cabin values first.</div>}
        </section>
        <div className="cabin-rad-wrap">
          <div className="pg-tabs cabin-rad-tabs" role="tablist" aria-label="Radiation view">
            <button className="pg-tab" aria-pressed={rad === 'crew'} onClick={() => setRad('crew')}>Crew Radiation</button>
            <button className="pg-tab" aria-pressed={rad === 'cabin'} onClick={() => setRad('cabin')}>Cabin Radiation</button>
          </div>
          {rad === 'crew' ? <CrewRadiation /> : <section className="panel cabin-rad" aria-label="Cabin radiation planning layer"><CabinRadiation key={sep ? 'sep' : 'route'} /></section>}
        </div>
      </div>
    </main>
  )
}
