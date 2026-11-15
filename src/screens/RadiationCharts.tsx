// Radiation views (Astronaut Radiation Monitoring document): the selected astronaut's dose ledger on the Personal screen,
// and the whole crew on the Cabin screen. Ratios and levels come from core/radiation.ts.
import { HoverChart, nearestPoint } from '../components/HoverChart'
import { InfoTip } from '../components/InfoTip'
import { spread } from '../components/spread'
import { Shape } from '../components/StatusBadge'
import { goesMeta, radlabMeta, sepEvents, sLevel } from '../core/realData'
import { thresholds } from '../core/statusEngine'
import { crew, useSystem } from '../core/system'
import type { Level } from '../core/types'
import { CREW_COLORS } from './CrewCharts'
import { TrendChart } from './PersonalCharts'

const DAY = 24 * 3600_000
const LABEL_W = 80 // px width of an "EVA +0.35" label
const COLOR: Record<Level, string> = { green: 'var(--green)', yellow: 'var(--yellow)', red: 'var(--red)', nodata: 'var(--nodata)' }
const R = () => thresholds.radiation

function RadInfo() {
  const r = R()
  return (
    <InfoTip title="Radiation">
      <span>Radiation is not one number. Each astronaut has three doses, each against its own limit; the panel shows the worst ratio and which limit it comes from (never an average).</span>
      <ul>
        <li><b>Career:</b> effective dose of earlier missions + this mission, limit {r.careerLimitMSv} mSv (about 3 % extra cancer death risk; NASA-STD-3001).</li>
        <li><b>30 days:</b> organ dose, limits blood-forming organs {r.organ30d.bfo}, eye lens {r.organ30d.eye}, skin {r.organ30d.skin} mGy-Eq (NCRP 132). EVA adds a skin and eye term.</li>
        <li><b>Solar event:</b> dose of a running solar particle event, limit {r.speLimitMSv} mSv per event.</li>
        <li><b>Dose rate:</b> now against the normal deep-space rate (about {r.normalRateMSvDay} mSv/day); {r.rateAlarmFactor}× normal is a caution.</li>
        <li>Ratio ≥ {r.levels.caution} Caution (tell the planner) · ≥ {r.levels.warning} Warning (prepare the shelter) · ≥ {r.levels.critical} Critical (shelter, end EVA). These steps are a design choice (ALARA), not NASA's.</li>
        <li>Personal dose is estimated from area monitors and time; the personal dosimeter is read after flight. Sample data.</li>
      </ul>
    </InfoTip>
  )
}

/** Ratio bar with the caution / warning / critical ticks. */
function RatioBar({ ratio, level }: { ratio: number | null; level: Level }) {
  const L = R().levels
  const max = L.critical * 1.2
  const w = (v: number) => `${(Math.min(v, max) / max) * 100}%`
  return (
    <span className="rad-bar">
      {ratio !== null && <i style={{ width: w(ratio), background: COLOR[level] }} />}
      {[L.caution, L.warning, L.critical].map((t) => <b key={t} style={{ left: w(t) }} />)}
    </span>
  )
}

/** Personal screen: the selected astronaut's ledger and dose history. */
export function RadiationPanel({ crewId }: { crewId: string }) {
  const sys = useSystem()
  const led = sys.radiation(crewId)
  const L = R().levels
  const rowLevel = (q: number | null): Level => (q === null ? 'nodata' : q >= L.critical ? 'red' : q >= L.caution ? 'yellow' : 'green')
  const daily = sys.history('rad_daily_dose', crewId)
  const eva = sys.history('rad_eva_dose', crewId)
  const prior = crew.find((c) => c.id === crewId)!.priorDoseMSv
  let run = prior
  const cum = daily.map((m) => ({ time: m.time, value: (run += m.value + eva.filter((e) => e.time <= m.time && e.time > m.time - DAY).reduce((s, e) => s + e.value, 0)) }))
  const W = 640, H = 300, PL = 48, PR = 10
  const t0 = daily[0]?.time ?? sys.now, t1 = sys.now
  const x = (t: number) => PL + ((t - t0) / (t1 - t0 || 1)) * (W - PL - PR)
  const cHi = Math.max(prior + 1, ...cum.map((c) => c.value)) * 1.1
  const yc = (v: number) => 10 + (1 - v / cHi) * 140
  const dHi = Math.max(...daily.map((d) => d.value), ...eva.map((e) => e.value), 0.1) * 1.2
  const yd = (v: number) => 170 + (1 - v / dHi) * 110
  const read = (t: number) => {
    const c = nearestPoint(cum, t)
    if (!c) return null
    const d = daily.find((m) => m.time === c.time)
    const e = eva.filter((m) => m.time <= c.time && m.time > c.time - DAY)
    return { time: c.time, rows: [
      { label: 'Career dose', value: `${c.value.toFixed(1)} mSv` },
      { label: 'Daily dose', value: d ? `${d.value} mSv` : '—' },
      ...(e.length ? [{ label: 'EVA extra', value: `+${e.reduce((a, m) => a + m.value, 0).toFixed(2)} mSv`, color: 'var(--yellow)' }] : []),
    ] }
  }
  return (
    <div className="rad">
      <div className="ox-head">
        <div className="ox-strip" data-level={led.level}><Shape level={led.level} size={12} /> {led.label} · worst: {led.worst.label} {Math.round(led.worst.ratio! * 100)} %</div>
        <RadInfo />
      </div>
      <div className="rad-rows">
        {led.ratios.map((q) => (
          <div key={q.key} className="rad-row" data-level={q.key === 'rate' ? (q.ratio !== null && q.ratio >= R().rateAlarmFactor ? 'yellow' : 'green') : rowLevel(q.ratio)}>
            <span className="rad-label">{q.label}</span>
            <span className="num">{q.dose === null ? '—' : Number(q.dose.toPrecision(3))} <small>/ {q.limit} {q.unit}</small></span>
            {q.key === 'rate' ? <span className="num rad-pct">{q.ratio === null ? '—' : `${q.ratio.toFixed(1)}×`}</span> : <RatioBar ratio={q.ratio} level={rowLevel(q.ratio)} />}
            {q.key !== 'rate' && <span className="num rad-pct">{q.ratio === null ? '—' : `${Math.round(q.ratio * 100)} %`}</span>}
            <span className="muted rad-note">{q.note}</span>
          </div>
        ))}
      </div>
      <HoverChart x0={PL} x1={W - PR} t0={t0} t1={t1} read={read}>
      <svg viewBox={`0 0 ${W} ${H}`} className="ox-svg" role="img" aria-label={`${crewId} dose history`}>
        <rect x={x(t1 - 30 * DAY)} y={10} width={x(t1) - x(t1 - 30 * DAY)} height={270} fill="var(--text)" opacity={0.05} />
        <text x={x(t1 - 30 * DAY) + 3} y={yc(0) - 5} className="chart-tick">last 30 days</text>
        <text x={PL + 4} y={22} className="chart-tick">Career dose, mSv</text>
        <text x={PL - 4} y={yc(cHi) + 8} textAnchor="end" className="chart-tick">{cHi.toFixed(0)}</text>
        <text x={PL - 4} y={yc(0)} textAnchor="end" className="chart-tick">0</text>
        <line x1={PL} x2={W - PR} y1={yc(0)} y2={yc(0)} stroke="var(--line-2)" />
        <polyline fill="none" stroke="var(--text)" strokeWidth={1.6} points={cum.map((c) => `${x(c.time).toFixed(1)},${yc(c.value).toFixed(1)}`).join(' ')} />
        {cum.length > 0 && <text x={W - PR} y={yc(cum[cum.length - 1].value) - 5} textAnchor="end" className="chart-tick rd-num">{cum[cum.length - 1].value.toFixed(1)} mSv · {Math.round((cum[cum.length - 1].value / R().careerLimitMSv) * 100)} % of {R().careerLimitMSv}</text>}
        <text x={PL + 4} y={166} className="chart-tick">Daily dose, mSv (bars) · EVA extra (marks)</text>
        <text x={PL - 4} y={yd(dHi) + 8} textAnchor="end" className="chart-tick">{dHi.toFixed(2)}</text>
        <line x1={PL} x2={W - PR} y1={yd(0)} y2={yd(0)} stroke="var(--line-2)" />
        {daily.map((d) => <rect key={d.time} x={x(d.time) - 1.5} y={yd(d.value)} width={3} height={yd(0) - yd(d.value)} fill="var(--text)" opacity={0.5}><title>{`${new Date(d.time).toISOString().slice(0, 10)} ${d.value} mSv`}</title></rect>)}
        {eva.map((e, i) => {
          // a label close to the previous one goes one row lower, so EVA labels never overlap
          const row = eva.slice(0, i).filter((p) => x(e.time) - x(p.time) < LABEL_W).length % 3
          return (
            <g key={e.time}>
              <line x1={x(e.time)} x2={x(e.time)} y1={10} y2={yd(0)} stroke="var(--yellow)" strokeDasharray="2 3" />
              <text x={x(e.time) + 2} y={yd(dHi) + 18 + row * 13} className="chart-tick" fill="var(--yellow)">EVA +{e.value.toFixed(2)}</text>
            </g>
          )
        })}
        <text x={PL} y={H - 4} className="chart-tick">mission day 1</text>
        <text x={W - PR} y={H - 4} textAnchor="end" className="chart-tick">today</text>
      </svg>
      </HoverChart>
      <span className="muted note">Estimate from area monitors and time in each module; not a personal dosimeter reading. <span className="tag">SIM</span></span>
    </div>
  )
}

/** Cabin screen: every astronaut's ledger, career dose over the mission and the measured dose rate. */
export function CrewRadiation() {
  const sys = useSystem()
  const L = R().levels
  const rowLevel = (q: number | null): Level => (q === null ? 'nodata' : q >= L.critical ? 'red' : q >= L.caution ? 'yellow' : 'green')
  const W = 640, H = 220, PL = 44, PR = 70
  const series = crew.map((c, i) => {
    let run = c.priorDoseMSv
    const eva = sys.history('rad_eva_dose', c.id)
    return { id: c.id, color: CREW_COLORS[i], pts: sys.history('rad_daily_dose', c.id).map((m) => ({ time: m.time, value: (run += m.value + eva.filter((e) => e.time <= m.time && e.time > m.time - DAY).reduce((s, e) => s + e.value, 0)) })) }
  })
  const all = series.flatMap((s) => s.pts)
  const t0 = Math.min(...all.map((p) => p.time)), t1 = sys.now
  const hi = Math.max(...all.map((p) => p.value)) * 1.1
  const x = (t: number) => PL + ((t - t0) / (t1 - t0 || 1)) * (W - PL - PR)
  const y = (v: number) => 8 + (1 - v / hi) * (H - 30)
  const read = (t: number) => {
    const snap = nearestPoint(series[0].pts, t)?.time ?? t
    return { time: snap, rows: series.map((s) => ({ label: s.id, value: `${nearestPoint(s.pts, snap)?.value.toFixed(1) ?? '—'} mSv`, color: s.color })) }
  }
  return (
    <section className="panel cabin-rad" aria-label="Crew radiation">
      <div className="panel-head"><h2>Crew radiation</h2><RadInfo /></div>
      <table className="rad-table">
        <thead><tr><th>Astronaut</th><th>Career</th><th>30 days</th><th>Solar event</th><th>Level</th></tr></thead>
        <tbody>
          {crew.map((c) => {
            const led = sys.radiation(c.id)
            const [career, d30, spe] = led.ratios
            return (
              <tr key={c.id} data-level={led.level}>
                <td>{c.name} <span className="muted">{c.id}</span></td>
                <td className="num" data-level={rowLevel(career.ratio)}>{career.dose!.toFixed(1)} mSv <small>{Math.round(career.ratio! * 100)} %</small></td>
                <td className="num" data-level={rowLevel(d30.ratio)}>{d30.dose!.toFixed(1)} mGy-Eq <small>{Math.round(d30.ratio! * 100)} %</small></td>
                <td className="num">{spe.dose === null ? '—' : `${spe.dose.toFixed(1)} mSv`}</td>
                <td className="rad-level"><Shape level={led.level} /> {led.label.split(' – ')[0]}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <HoverChart x0={PL} x1={W - PR} t0={t0} t1={t1} read={read}>
      <svg viewBox={`0 0 ${W} ${H}`} className="ox-svg" role="img" aria-label="Career dose of each astronaut over the mission">
        <text x={PL + 4} y={18} className="chart-tick">Career dose over the mission, mSv (limit {R().careerLimitMSv})</text>
        <text x={PL - 4} y={y(hi) + 8} textAnchor="end" className="chart-tick">{hi.toFixed(0)}</text>
        <text x={PL - 4} y={y(0)} textAnchor="end" className="chart-tick">0</text>
        <line x1={PL} x2={W - PR} y1={y(0)} y2={y(0)} stroke="var(--line-2)" />
        {series.map((s) => (
          <g key={s.id}>
            <polyline fill="none" stroke={s.color} strokeWidth={1.5} points={s.pts.map((p) => `${x(p.time).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ')} />
          </g>
        ))}
        {spread(series.filter((s) => s.pts.length).map((s) => ({ id: s.id, color: s.color, v: s.pts[s.pts.length - 1].value, y: y(s.pts[s.pts.length - 1].value) + 3 })), 13, 12, H - 20).map((l) => (
          <text key={l.id} x={W - PR + 4} y={l.y} className="chart-tick" fill={l.color}>{l.id} {l.v.toFixed(0)}</text>
        ))}
        <text x={PL} y={H - 4} className="chart-tick">mission day 1</text>
        <text x={W - PR} y={H - 4} textAnchor="end" className="chart-tick">today</text>
      </svg>
      </HoverChart>
      <div className="cabin-measured">
        <span className="muted">Solar protons ≥10 MeV, NOAA scale {sLevel(sys.latest('goes_proton_flux', null)?.value ?? 0) ? `S${sLevel(sys.latest('goes_proton_flux', null)!.value)}` : 'below S1'} <span className="tag real">NOAA GOES · {goesMeta.retrieved}</span></span>
        <TrendChart metricId="goes_proton_flux" crewId={null} hours={24} plain size={[640, 110]} />
        <span className="muted">Measured dose rate, {radlabMeta.instrument} replay <span className="tag real">NASA OSDR · DONKI</span></span>
        <TrendChart metricId="radiation_measured" crewId={null} hours={24} plain size={[640, 150]} markers={sepEvents(sys.simStart).map((e) => ({ time: e.time, label: 'SEP' }))} />
      </div>
    </section>
  )
}
