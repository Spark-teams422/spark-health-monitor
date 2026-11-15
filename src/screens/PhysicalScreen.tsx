// Physical screen: bone and muscle record (bone loss and exercise program documents), fitness and body mass, and the
// person's editable weekly exercise plan. Every card opens a sub panel with the history of its values.
import { RotateCcw } from 'lucide-react'
import { useState } from 'react'
import { CrewTabs } from '../components/CrewTabs'
import { Drawer } from '../components/Drawer'
import { NutritionPanel } from './NutritionPanel'
import { InfoTip } from '../components/InfoTip'
import { Value } from '../components/Value'
import { crew, metricConfig, useSystem, type ExercisePlan } from '../core/system'
import { thresholds } from '../core/statusEngine'
import type { Level } from '../core/types'
import { MetricHistory } from './MetricHistory'

const COLOR: Record<Level, string> = { green: 'var(--green)', yellow: 'var(--yellow)', red: 'var(--red)', nodata: 'var(--nodata)' }
const pct = (x: number | null) => (x === null ? '—' : `${Math.round(x * 100)} %`)

function Bar({ value, marks, level }: { value: number | null; marks: number[]; level: Level }) {
  const max = Math.max(1.2, ...marks)
  const w = (v: number) => `${(Math.min(Math.max(v, 0), max) / max) * 100}%`
  return (
    <span className="rad-bar">
      {value !== null && <i style={{ width: w(value), background: COLOR[level] }} />}
      {marks.map((t) => <b key={t} style={{ left: w(t) }} />)}
    </span>
  )
}

function Card({ title, level, label, children, ids, crewId, info }: { title: string; level: Level; label: string; children: React.ReactNode; ids: string[]; crewId: string; info: React.ReactNode }) {
  return (
    <div className="phys-card" data-level={level}>
      <div className="phys-head"><h3>{title}</h3>{info}</div>
      <Drawer title={`${title} · ${crewId}`} className="phys-open" summary={
        <span className="phys-body">
          {children}
          <span className="phys-level" data-level={level}>{label}</span>
          <span className="muted">Open history ›</span>
        </span>
      }>{() => <MetricHistory ids={ids} crewId={crewId} />}</Drawer>
    </div>
  )
}

export function PhysicalScreen({ crewId, onSelect }: { crewId: string; onSelect: (id: string) => void }) {
  const sys = useSystem()
  const [right, setRight] = useState<'exercise' | 'nutrition'>('exercise')
  const c = crew.find((x) => x.id === crewId)!
  const bone = sys.bone(crewId)
  const muscle = sys.muscle(crewId)
  const plan = sys.exercisePlan(crewId)
  const b = thresholds.bone, mu = thresholds.muscle
  const st = (id: string) => sys.status(id, crewId)
  const v = (id: string) => sys.latest(id, crewId)?.value ?? '—'
  const levelOf = (id: string): Level => st(id).level
  const edit = (patch: (p: ExercisePlan) => void) => {
    const next: ExercisePlan = JSON.parse(JSON.stringify(plan))
    patch(next)
    sys.setExercisePlan(crewId, next)
  }
  const num = (value: number, set: (n: number) => void) => <input className="cell-input num" type="number" min={0} value={value} onChange={(e) => set(Math.max(0, Number(e.target.value)))} />
  const week = sys.plannedWeekVolume(crewId)
  const last7 = sys.history('ared_volume', crewId).filter((m) => m.time > sys.now - 7 * 86400000)

  return (
    <main className="screen physical">
      <CrewTabs crewId={crewId} onSelect={onSelect} />
      <div className="split">
        <div className="phys-cards">
          <Card title="Bone" level={bone.level} label={bone.label} ids={['bone_urine_ca', 'bone_ntx', 'bone_bsap']} crewId={crewId} info={
            <InfoTip title="Bone">
              <span>In space, weight-bearing bone loses about 1–1.5 % a month (hip, spine). Urine calcium alone does not give a bone loss %; it is an early warning, read together with NTX (resorption) and BSAP (formation).</span>
              <ul>
                <li><b>R_Ca</b> = (U − U₀) / U₀ against the preflight 24-h urine calcium; 1 = twice baseline (Skylab plateau).</li>
                <li><b>Estimated loss</b> ≈ {b.netLossMgDayAtR1} mg/day × min(R_Ca, 1); per month ≈ 30 × loss / skeletal calcium (1100 g, unverified).</li>
                <li><b>R_NTX</b>: 1 = about 2.1 × baseline (meta-analysis plateau +113 %).</li>
                <li>Caution R ≥ {b.levels.caution} or ≥ {b.lossPctMonth.caution} %/month · Warning R ≥ {b.levels.warning} or ≥ {b.lossPctMonth.warning} %/month · Critical ≥ {b.lossPctMonth.critical} %/month or two Warnings in a row (design choice, not NASA).</li>
                <li>Lab values come days to weeks late; confirm on the ground with DXA / QCT.</li>
              </ul>
            </InfoTip>
          }>
            <span className="phys-row"><span>R_Ca urine calcium</span><Bar value={bone.rCa} marks={[b.levels.caution, b.levels.warning]} level={bone.level} /><b className="num">{bone.rCa?.toFixed(2) ?? '—'}</b></span>
            <span className="phys-row"><span>R_NTX resorption</span><Bar value={bone.rNtx} marks={[b.levels.caution, b.levels.warning]} level={bone.level} /><b className="num">{bone.rNtx?.toFixed(2) ?? '—'}</b></span>
            <span className="phys-row"><span>Estimated loss</span><b className="num">{bone.dCaMgDay?.toFixed(0) ?? '—'} mg/day · {bone.lossPctMonth?.toFixed(2) ?? '—'} %/month</b></span>
            <span className="muted">Last sample {bone.lastTime ? `${Math.round((sys.now - bone.lastTime) / 86400000)} days ago` : '—'} · U₀ {c.preflight.urineCaMgDay} mg/day</span>
          </Card>
          <Card title="Muscle" level={muscle.level} label={muscle.label} ids={['muscle_leg_press', 'muscle_knee_torque', 'strength_pct', 'ared_volume']} crewId={crewId} info={
            <InfoTip title="Muscle">
              <span>There is no single urine test for muscle loss; the panel uses measured strength and exercise compliance.</span>
              <ul>
                <li><b>Loss %</b> = (1 − P / P₀) × 100, P = in-flight leg press, P₀ = preflight.</li>
                <li><b>R_kas</b> = min(loss % / {mu.lossFullPct}, 1); {mu.lossFullPct} % is NASA's muscle concern level.</li>
                <li><b>Compliance U</b> = completed ÷ planned ARED volume load (sets × reps × load) over {mu.days} days; the plan is the table on the right.</li>
                <li>Green R &lt; {mu.risk.caution} and U ≥ {mu.compliance.caution} · Yellow R {mu.risk.caution}–{mu.risk.critical} or U {mu.compliance.critical}–{mu.compliance.caution} · Red R &gt; {mu.risk.critical} or U &lt; {mu.compliance.critical} (team proposal).</li>
              </ul>
            </InfoTip>
          }>
            <span className="phys-row"><span>Strength loss</span><Bar value={muscle.risk} marks={[mu.risk.caution, mu.risk.critical]} level={muscle.level} /><b className="num">{muscle.lossPct?.toFixed(1) ?? '—'} %</b></span>
            <span className="phys-row"><span>Compliance U</span><Bar value={muscle.compliance} marks={[mu.compliance.critical, mu.compliance.caution]} level={muscle.level} /><b className="num">{pct(muscle.compliance)}</b></span>
            <span className="phys-row"><span>Leg press · knee torque</span><b className="num">{v('muscle_leg_press')} N · {v('muscle_knee_torque')} Nm</b></span>
            <span className="muted">Preflight {c.preflight.legPressN} N · {c.preflight.kneeTorqueNm} Nm (sample)</span>
          </Card>
          <Card title="Aerobic fitness" level={levelOf('fitness_pct')} label={`${metricConfig('fitness_pct').label}`} ids={['fitness_pct', 'fitness_vo2peak']} crewId={crewId} info={
            <InfoTip title="Aerobic fitness"><span>Monthly cycle ergometer test against the preflight VO2peak (Periodic checklist, section 9). Preflight VO2peak is a real value: {c.preflight.source.split('.')[0]}.</span></InfoTip>
          }>
            <span className="phys-row"><span>Of preflight</span><Value value={v('fitness_pct')} unit="%" status={st('fitness_pct')} /></span>
            <span className="phys-row"><span>VO2peak</span><Value value={v('fitness_vo2peak')} unit="mL/kg/min" status={st('fitness_vo2peak')} /></span>
            <span className="muted">Preflight {c.preflight.vo2peak} mL/kg/min · sample value</span>
          </Card>
          <Card title="Body mass" level={levelOf('body_mass_loss')} label={metricConfig('body_mass_loss').label} ids={['body_mass_loss']} crewId={crewId} info={
            <InfoTip title="Body mass"><span>Weekly mass measurement against preflight mass (Periodic checklist, section 8). 3–4 % loss in the first 30 days is expected; yellow from 5 %, red from 10 %.</span></InfoTip>
          }>
            <span className="phys-row"><span>Loss vs preflight</span><Value value={v('body_mass_loss')} unit="%" status={st('body_mass_loss')} /></span>
            <span className="muted">Preflight {c.preflight.massKg} kg · sample value</span>
          </Card>
        </div>

        <div className="phys-right">
          <div className="pg-tabs phys-tabs" role="tablist" aria-label="Plan">
            <button className="pg-tab" aria-pressed={right === 'exercise'} onClick={() => setRight('exercise')}>Exercise plan</button>
            <button className="pg-tab" aria-pressed={right === 'nutrition'} onClick={() => setRight('nutrition')}>Nutrition</button>
          </div>
          {right === 'nutrition' ? <NutritionPanel crewId={crewId} /> : (
        <section className="panel exercise" aria-label="Exercise plan">
          <div className="panel-head">
            <h2>Weekly exercise plan · {c.name}</h2>
            <InfoTip title="Exercise plan">
              <span>ISS Sprint protocol (English et al. 2020): 3 resistance days on ARED with daily changing sets and reps, 3 interval days and 3 continuous cardio sessions, about 6 h a week. Interval rest times and the exercises of each day come from the paper's Supplementary Tables 3 and 4. Loads are the median ISS session loads; bench press and row are the document's proposal.</span>
              <ul><li>Edit any number: the planned weekly volume and the compliance on the Muscle card update at once.</li><li>Load progression (proposal): if the 4th set is completed easily, raise the load next session.</li></ul>
            </InfoTip>
            {sys.exercisePlans[crewId] && <button className="ghost" onClick={() => sys.setExercisePlan(crewId, null)}><RotateCcw size={14} /> Reset to Sprint plan</button>}
          </div>
          <table className="ex-table">
            <thead><tr><th>Day</th><th>Session</th><th>Sets</th><th>Reps</th><th>Intensity</th><th>Min</th></tr></thead>
            <tbody>
              {plan.sessions.map((s, i) => (
                <tr key={i} data-type={s.type}>
                  <td><b>{s.day}</b></td>
                  <td><input className="cell-input" value={s.label} onChange={(e) => edit((p) => { p.sessions[i].label = e.target.value })} /></td>
                  <td>{num(s.sets, (n) => edit((p) => { p.sessions[i].sets = n }))}</td>
                  <td>{num(s.reps, (n) => edit((p) => { p.sessions[i].reps = n }))}</td>
                  <td><input className="cell-input" value={s.intensity} onChange={(e) => edit((p) => { p.sessions[i].intensity = e.target.value })} /></td>
                  <td>{num(s.minutes, (n) => edit((p) => { p.sessions[i].minutes = n }))}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <table className="ex-table">
            <thead><tr><th>ARED lift</th><th>Target</th><th>Load kg</th><th>Sets (if not the day's)</th></tr></thead>
            <tbody>
              {plan.lifts.map((l, i) => (
                <tr key={l.name}>
                  <td><b>{l.name}</b></td>
                  <td className="muted">{l.target}</td>
                  <td>{num(l.loadKg, (n) => edit((p) => { p.lifts[i].loadKg = n }))}</td>
                  <td>{num((l as { sets?: number }).sets ?? 0, (n) => edit((p) => { (p.lifts[i] as { sets?: number }).sets = n || undefined }))}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="ex-sum">
            <span>Planned ARED volume <b className="num">{Math.round(week).toLocaleString('en')} kg/week</b></span>
            <span>Done last 7 days <b className="num">{Math.round(last7.reduce((s, m) => s + m.value, 0)).toLocaleString('en')} kg</b> in {last7.length} sessions</span>
            <span>Compliance <b className="num" style={{ color: COLOR[muscle.level] }}>{pct(muscle.compliance)}</b></span>
            <span className="tag">SIM</span>
          </div>
        </section>
          )}
        </div>
      </div>
    </main>
  )
}
