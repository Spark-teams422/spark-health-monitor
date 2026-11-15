// Personal screen (team sketch, 14 Nov 2026): crew list and the selected person's values on the left; the selected chart
// (crew oxygen, mission readiness, or the history of a clicked value) in the middle with the blood/urine sub panel;
// health hexagon with the alert history and check-in sub panels; the body model column on the right.
// Values, limits and colours all come from the shared layer; no limit lives here.
import { Frown, Meh, Smile } from 'lucide-react'
import { useState } from 'react'
import { BodyPanel } from '../components/BodyPanel'
import { Drawer } from '../components/Drawer'
import { clock } from '../components/NotificationList'
import { LEVEL_UI, Shape } from '../components/StatusBadge'
import { Value } from '../components/Value'
import mentalCfg from '../config/mental.json'
import { thresholds, worst } from '../core/statusEngine'
import { crew, metricConfig, metricIds, useSystem } from '../core/system'
import type { Level } from '../core/types'
import { AlertHistory, CheckinPanel, CrewOxygenChart, HealthHexagon, LabPanel, ReadinessPanel } from './CrewCharts'
import { TrendChart } from './PersonalCharts'
import { RadiationPanel } from './RadiationCharts'
import { InfoTip } from '../components/InfoTip'
import { ZoomButton } from '../components/Zoom'
import { EarlyWarning } from './EarlyWarning'

const FACES = [Smile, Meh, Frown]
const HISTORY_WINDOWS = [1, 4, 12, 24]
const TITLE = { oxygen: 'Crew oxygen chart', readiness: 'Mission readiness panel', radiation: 'Radiation' }
type View = { kind: 'oxygen' } | { kind: 'readiness' } | { kind: 'radiation' } | { kind: 'vital'; label: string; ids: string[] }

/** Under a vital: the person's own baseline and how far the reading is from it (robust z), or the cold-start note. */
function BaseNote({ ids, crewId }: { ids: string[]; crewId: string }) {
  const sys = useSystem()
  const bs = ids.map((id) => sys.status(id, crewId).baseline).filter((b) => b)
  if (!bs.length) return null
  if (bs.some((b) => !b!.ok)) return <small className="pg-base muted">no own baseline yet</small>
  const z = (b: (typeof bs)[number]) => `${b!.z! > 0 ? '+' : ''}${b!.z!.toFixed(1)}`
  const off = bs.some((b) => b!.level !== 'green')
  return <small className={`pg-base ${off ? 'pg-base-off' : 'muted'}`}>own {bs.map((b) => b!.median).join('/')} · z {bs.map(z).join('/')}</small>
}

/** What the baseline uses for this person, and which sex-specific rules apply (team document, 15 Nov 2026). */
function BaselineInfo({ crewId }: { crewId: string }) {
  const sys = useSystem()
  const b = sys.status('bp_systolic', crewId).baseline
  const cfg = thresholds.baseline
  return (
    <InfoTip title="Personal baseline">
      <span>Each vital is also compared with the person's own baseline: robust z = (value − own median) / (1.4826 × MAD). |z| ≥ {cfg.zCaution} turns a green value yellow; |z| ≥ {cfg.zOrange}, or ≥ {cfg.zCaution} for over {cfg.sustainedHours} h, asks the person to confirm. The baseline never turns a red into yellow and never makes red; the absolute limits stay. Value = median of the last {cfg.xWindowMin} min.</span>
      <ul>
        <li><b>Reference now:</b> {b?.ok ? `${b.ref} (${b.sessions} preflight sessions)` : b?.note ?? '—'}. In space the heart rate and mean pressure equal the preflight supine values, so Earth "seated" ranges mislead. After 14 days of flight data the flight baseline (14-day rolling median) takes over; landing and planet surface use the standing value.</li>
        <li><b>Sex-specific rules for {crewId}:</b> {sys.sexRules(crewId).filter((r) => r.sex).map((r) => r.rule).join(' ') || 'none (rules apply to female astronauts only)'} Sex never changes a normal range.</li>
        <li>Preflight baselines are <b>synthetic</b> (real data: LSAH / LSDA, not public). Thresholds are team proposals, not NASA standards.</li>
        {cfg.openItems.map((o) => <li key={o} className="muted">Open item: {o}</li>)}
      </ul>
    </InfoTip>
  )
}

export function PersonalScreen({ crewId, onSelect }: { crewId: string; onSelect: (id: string) => void }) {
  const sys = useSystem()
  const [view, setView] = useState<View>({ kind: 'oxygen' })
  const [hours, setHours] = useState(4)
  const member = crew.find((c) => c.id === crewId)!
  const v = (id: string) => sys.latest(id, crewId)?.value ?? '—'
  const m = sys.mental(crewId)
  const Face = (m && FACES[mentalCfg.bands.findIndex((b) => b.max === m.band.max)]) ?? Meh // match by value: the band object may come from another copy of the config

  const vitals: { label: string; ids: string[]; value: string | number; unit: string }[] = [
    { label: 'Blood pressure', ids: ['bp_systolic', 'bp_diastolic'], value: `${v('bp_systolic')}/${v('bp_diastolic')}`, unit: 'mmHg' },
    { label: 'HRV', ids: ['hrv'], value: v('hrv'), unit: metricConfig('hrv').unit },
    { label: 'SpO₂', ids: ['spo2'], value: v('spo2'), unit: metricConfig('spo2').unit },
    { label: 'Body temperature', ids: ['body_temp'], value: v('body_temp'), unit: metricConfig('body_temp').unit },
  ]
  const isVital = (label: string) => view.kind === 'vital' && view.label === label

  // sub panel summaries
  const labs = metricIds('lab').map((id) => sys.status(id, crewId).level)
  const labCount = (l: Level) => labs.filter((x) => x === l).length
  const lastLab = Math.max(...metricIds('lab').map((id) => sys.latest(id, crewId)?.time ?? 0))
  const alerts = sys.alertLog.filter((a) => a.crewId === crewId || a.crewId === null)
  const lastAlert = alerts.at(-1)
  const checkins = sys.recordsOf(crewId, 'checkin')
  const lastCheckin = checkins.at(-1)
  const todo = sys.checklist(crewId)
  const hex = sys.hexagon(crewId)
  const chart = (big: boolean) => (
    <>
      {view.kind === 'oxygen' && <CrewOxygenChart crewId={crewId} />}
      {view.kind === 'readiness' && <ReadinessPanel crewId={crewId} />}
      {view.kind === 'radiation' && <RadiationPanel crewId={crewId} />}
      {view.kind === 'vital' && (
        <div className="pg-history">
          <div className="panel-head">
            <h2>{view.label} · {crewId} <span className="tag">SIM</span></h2>
            <div className="seg" role="group" aria-label="Time frame">
              {HISTORY_WINDOWS.map((h) => <button key={h} aria-pressed={hours === h} onClick={() => setHours(h)}>{h} h</button>)}
            </div>
          </div>
          {view.ids.map((id) => <TrendChart key={id} metricId={id} crewId={crewId} hours={hours} size={big ? [1200, view.ids.length > 1 ? 280 : 560] : [640, view.ids.length > 1 ? 150 : 300]} />)}
        </div>
      )}
    </>
  )

  return (
    <main className="screen personal">
      <div className="pg">
        {/* left: crew list */}
        <div className="pg-head pg-c1">Crew</div>
        {crew.map((c, i) => {
          const st = sys.crewStatus(c.id)
          return (
            <button key={c.id} className="pg-crew pg-c1" style={{ gridRow: 2 + i }} aria-pressed={c.id === crewId} data-level={st.level} onClick={() => onSelect(c.id)}>
              <Shape level={st.level} /> <b>{c.name}</b> <span className="muted">{c.id}</span>
            </button>
          )
        })}
        <div className="pg-head pg-c1 pg-selected" style={{ gridRow: 7 }}>
          <span className="pg-vitals-title">Vital signs <BaselineInfo crewId={crewId} /></span>
          <span><b>{member.name}</b> <span className="muted">{crewId} · {member.role}</span></span>
        </div>
        {vitals.map((x, i) => (
          <button key={x.label} className="pg-vital pg-c1" style={{ gridRow: 8 + i }} aria-pressed={isVital(x.label)} onClick={() => setView({ kind: 'vital', label: x.label, ids: x.ids })} title="Show the history">
            <span className="pg-vital-label">{x.label}<BaseNote ids={x.ids} crewId={crewId} /></span>
            <Value value={x.value} unit={x.unit} status={worst(...x.ids.map((id) => sys.status(id, crewId)))} size={10} />
          </button>
        ))}
        <div className="pg-vital pg-c1" style={{ gridRow: 12 }} title={m ? `${m.band.label} · self-report, raises no alarm` : 'No check-in yet'}>
          <span>Mental state</span>
          <span className="mt-value mt-mental num"><Face size={20} strokeWidth={1.5} aria-label={m?.band.label ?? 'No check-in'} />{m ? m.score : '—'}</span>
        </div>

        {/* middle: chart tabs, the selected chart, blood and urine */}
        <div className="pg-tabs" role="tablist" aria-label="Chart">
          <button className="pg-tab" aria-pressed={view.kind === 'oxygen'} onClick={() => setView({ kind: 'oxygen' })}>Crew oxygen chart</button>
          <button className="pg-tab" aria-pressed={view.kind === 'readiness'} onClick={() => setView({ kind: 'readiness' })}>Mission readiness panel</button>
          <button className="pg-tab" aria-pressed={view.kind === 'radiation'} onClick={() => setView({ kind: 'radiation' })}>Radiation</button>
        </div>
        <section className="pg-chart" aria-label="Selected chart">
          <ZoomButton title={view.kind === 'vital' ? `${view.label} · ${crewId}` : `${TITLE[view.kind]} · ${crewId}`}>{() => chart(true)}</ZoomButton>
          {chart(false)}
        </section>
        <div className="pg-subs">
          <div className="pg-labs">
            <Drawer title="Blood and urine values" summary={
              <span className="cell-sum">
                {labCount('red') > 0 && <span data-level="red"><Shape level="red" /> {labCount('red')} critical</span>}
                {labCount('yellow') > 0 && <span data-level="yellow"><Shape level="yellow" /> {labCount('yellow')} caution</span>}
                {labCount('red') + labCount('yellow') === 0 && <span className="muted">All in normal range</span>}
                <span className="muted">Latest test {lastLab ? new Date(lastLab).toISOString().slice(0, 10) : '—'}</span>
              </span>
            }>{() => <LabPanel crewId={crewId} />}</Drawer>
          </div>
          <div className="pg-alerts">
            <Drawer title="Alert history" summary={
              <span className="cell-sum">
                <span className="muted">{alerts.length} event{alerts.length === 1 ? '' : 's'} · {crewId} + cabin</span>
                {lastAlert ? <span data-level={lastAlert.level}><Shape level={lastAlert.level} /> {clock(lastAlert.time)} {lastAlert.metricId === 'checkin' ? 'Daily check-in' : metricConfig(lastAlert.metricId).label}</span> : <span className="muted">No alerts</span>}
              </span>
            }>{() => <AlertHistory crewId={crewId} />}</Drawer>
          </div>
          <div className="pg-checkin">
            <Drawer title="Check-in" summary={
              <span className="cell-sum">
                {lastCheckin ? <span data-level={String(lastCheckin.data.level)}><Shape level={lastCheckin.data.level as Level} /> {LEVEL_UI[lastCheckin.data.level as Level].word} · {clock(lastCheckin.time)}</span> : <span className="muted">No check-in yet</span>}
                <span className="muted">Today {todo.filter((i) => i.done).length} / {todo.length} done</span>
                <span className="cell-chain"><b className="num">{sys.chain(crewId).streak}</b>-day chain{sys.reminders.some((r) => r.crewId === crewId) ? ' · reminder sent' : ''}</span>
              </span>
            }>{() => <CheckinPanel crewId={crewId} />}</Drawer>
          </div>
        </div>

        {/* hexagon column */}
        <div className="pg-head pg-c4">Health hexagon
          <InfoTip title="Health hexagon">
            <span>Six loads during an EVA. Centre = no load, outer edge = full load; the dashed ring is the level of ORI 60 (caution). The number below the hexagon is the orthostatic risk index (ORI). The polygon raises no alarm; alarms come from the value blocks. During an EVA it follows the suit live; otherwise it shows the person's last EVA (sample data in this demo).</span>
            <table><tbody>
              {hex.axes.map((a) => <tr key={a.label}><td><b>{a.label}</b></td><td>0: {a.info.zero}<br />1: {a.info.full}<br /><span className="muted">{a.info.basis} ({a.info.status})</span></td></tr>)}
            </tbody></table>
            <span className="muted">No open dataset comes from inside a suit; the scales come from ground exercise and heat data and NASA publications (team data source document, 14 Nov 2026).</span>
          </InfoTip>
        </div>
        <section className="pg-hex" aria-label="Health hexagon">
          <HealthHexagon crewId={crewId} />
          <span className="hex-ori-line"><span>ORI <b className="num">{hex.ori === null ? '—' : Math.round(hex.ori)}</b> <small className="muted">orthostatic risk index</small></span>
            <span className="muted">{hex.sample ? <>last EVA · sample <span className="tag">SIM</span></> : 'EVA in progress'} · polygon raises no alarm</span></span>
        </section>
        <section className="pg-trend" aria-label="Early warning"><EarlyWarning crewId={crewId} /></section>

        {/* right: body model column */}
        <section className="pg-body body-col" aria-label="Body model">
          <BodyPanel crewId={crewId} />
        </section>
      </div>
    </main>
  )
}
