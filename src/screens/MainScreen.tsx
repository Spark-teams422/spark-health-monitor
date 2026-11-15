// Main screen (roadmap section 1, team table sketch): one bordered table, numbers only, no charts, no body model.
// Columns: astronaut · blood pressure · HRV · SpO₂ · body temperature · mental; right: cabin values over the emergency button.
// Values are coloured by the level the shared layer gives them; nothing is decided here.
import logo from '../assets/spark-logo.png'
import { Frown, Meh, Smile } from 'lucide-react'
import { Emergency } from '../components/Emergency'
import { LinkBadge } from '../components/StatusBadge'
import { Value } from '../components/Value'
import mentalCfg from '../config/mental.json'
import { worst } from '../core/statusEngine'
import { crew, metricConfig, useSystem } from '../core/system'

const FACES = [Smile, Meh, Frown] // one per mental band, calm → stressed
// short names that fit the cabin cell; the full label is the tooltip
const CABIN: [string, string][] = [['cabin_co2', 'CO₂'], ['cabin_pio2', 'O₂ (PIO₂)'], ['cabin_pressure', 'Pressure'], ['cabin_temp', 'Temperature'], ['radiation_rate', 'Radiation now'], ['radiation_cumulative', 'Radiation total']]
export function MainScreen({ onOpen }: { onOpen: (crewId: string) => void }) {
  const sys = useSystem()
  const { day, total, remaining } = sys.missionDay
  const common = sys.commonCause()
  const v = (id: string, who: string | null) => sys.latest(id, who)?.value ?? '—'
  // as in the sketch: cabin values cover the header row and the upper crew rows, the emergency button the rest
  const emergencyRows = Math.max(1, Math.floor(crew.length / 2))

  return (
    <main className="screen main-table">
      <div className="mt-grid" style={{ gridTemplateRows: `auto auto repeat(${crew.length}, minmax(0, 1fr))` }}>
        <div className="mt-title"><img className="mt-logo" src={logo} alt="Spark" /> · HEALTH MONITOR</div>
        <div className="mt-top">
          <LinkBadge link={sys.link} queued={sys.notifications.queue.length} />
          <span className="muted">{sys.pingSec === null ? 'Ping: no reply' : `Ping ${Math.floor(sys.pingSec / 60)} min ${sys.pingSec % 60} s`} <span className="tag">SIM</span></span>
        </div>
        <div className="mt-top">
          <span>Mission day <b className="num">{day}</b> / {total}</span>
          <span className="muted">{remaining} days left</span>
        </div>
        <div className="mt-top mt-clock num">{new Date(sys.now).toISOString().slice(11, 19)}<small>UTC</small></div>

        {['Astronaut', 'Blood pressure', 'HRV', 'SpO₂', 'Body temperature', 'Mental state'].map((h) => <div key={h} className="mt-head">{h}</div>)}

        <section className="mt-cabin" style={{ gridRow: `2 / span ${1 + crew.length - emergencyRows}` }} aria-label="Cabin values">
          <div className="mt-cabin-title">Cabin values</div>
          {CABIN.map(([id, short]) => (
            <div key={id} className="mt-cabin-row" title={metricConfig(id).label}>
              <span className="mt-cabin-label">{short}</span>
              <Value value={v(id, null)} unit={metricConfig(id).unit} status={sys.status(id, null)} />
            </div>
          ))}
        </section>
        <div className="mt-emergency" style={{ gridRow: `${3 + crew.length - emergencyRows} / span ${emergencyRows}` }}>
          <Emergency crewId={crew[0].id} big />
        </div>

        {crew.map((c) => {
          const m = sys.mental(c.id)
          const Face = (m && FACES[mentalCfg.bands.findIndex((b) => b.max === m.band.max)]) ?? Meh // match by value: the band object may come from another copy of the config
          return (
            <div key={c.id} className="mt-row">
              <button className="mt-name" data-level={sys.crewStatus(c.id).level} onClick={() => onOpen(c.id)} title="Open personal screen">
                <b>{c.name}</b>
                <span className="muted">{c.id} · {c.role}{sys.evaCrewId === c.id ? ' · EVA' : ''}{sys.isSymptomatic(c.id) ? ' · symptom' : ''}</span>
              </button>
              <div className="mt-cell"><Value value={`${v('bp_systolic', c.id)}/${v('bp_diastolic', c.id)}`} unit="mmHg" status={worst(sys.status('bp_systolic', c.id), sys.status('bp_diastolic', c.id))} /></div>
              <div className="mt-cell"><Value value={v('hrv', c.id)} unit={metricConfig('hrv').unit} status={sys.status('hrv', c.id)} /></div>
              <div className="mt-cell"><Value value={v('spo2', c.id)} unit={metricConfig('spo2').unit} status={sys.status('spo2', c.id)} /></div>
              <div className="mt-cell"><Value value={v('body_temp', c.id)} unit={metricConfig('body_temp').unit} status={sys.status('body_temp', c.id)} /></div>
              <div className="mt-cell" title={m ? `${m.band.label} · self-report, raises no alarm` : 'No check-in yet'}>
                <span className="mt-value mt-mental num"><Face size={28} strokeWidth={1.5} aria-label={m?.band.label ?? 'No check-in'} /></span>
              </div>
            </div>
          )
        })}
      </div>
      {common.length > 0 && (
        <div className="hint" role="status">
          <b>Possible common cause.</b> {common.map((c) => `${metricConfig(c.metricId).label}: ${c.crewIds.join(', ')}`).join(' · ')}. Check the cabin values first, then the person.
        </div>
      )}
    </main>
  )
}
