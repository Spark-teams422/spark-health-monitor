// Personal screen charts (Chart Blueprint): crew oxygen chart, mission readiness panel, health hexagon,
// and the sub panels (blood and urine, alert history, check-in). Rules and limits come from src/core.
import { Bell, Circle, CircleCheck } from 'lucide-react'
import checkinCfg from '../config/checkin.json'
import { useState } from 'react'
import { CheckInButton } from '../components/CheckIn'
import { EntryPanel } from '../components/EntryPanel'
import { HoverChart, nearestPoint, type HoverRow } from '../components/HoverChart'
import { spread } from '../components/spread'
import { clock } from '../components/NotificationList'
import { LEVEL_UI, Shape } from '../components/StatusBadge'
import { Value } from '../components/Value'
import { rollingMean } from '../core/oxygen'
import { inspiration4, inspiration4Meta } from '../core/realData'
import { PART_LABEL, readinessBands, readinessConfig } from '../core/readiness'
import { InfoTip } from '../components/InfoTip'
import { thresholdBands, type Band } from '../core/statusEngine'
import { crew, metricConfig, metricIds, useSystem } from '../core/system'
import type { Level, Measurement } from '../core/types'
import { TrendChart } from './PersonalCharts'

const COLOR: Record<Level, string> = { green: 'var(--green)', yellow: 'var(--yellow)', red: 'var(--red)', nodata: 'var(--nodata)' }
/** one line colour per astronaut; status colours are kept for the bands */
export const CREW_COLORS = ['#7aa7ff', '#c792ea', '#5fd3d3', '#e8e8e8', '#f78fb3']
const HOUR = 3600_000
const DAY = 24 * HOUR
const date = (t: number) => new Date(t).toISOString().slice(0, 10)
const NOTE = 'This chart helps a decision; it does not make it. Changing together does not show cause and effect.'

/** Mean of each time bucket, so a 24 h line stays readable. */
function bin(ms: Measurement[], t0: number, t1: number, n = 160) {
  const size = (t1 - t0) / n || 1
  const b = new Map<number, { t: number; v: number; k: number }>()
  for (const m of ms) {
    if (m.time < t0) continue
    const i = Math.floor((m.time - t0) / size), x = b.get(i) ?? { t: 0, v: 0, k: 0 }
    x.t += m.time; x.v += m.value; x.k++
    b.set(i, x)
  }
  return [...b.values()].map((x) => ({ time: x.t / x.k, value: x.v / x.k }))
}

const OX_WINDOWS = [1, 6, 24]

/** Graph 1: crew oxygen (blood oxygen of everyone + cabin PIO₂ + cabin CO₂ 1-h average) on one time axis. */
export function CrewOxygenChart({ crewId }: { crewId: string }) {
  const sys = useSystem()
  const [hours, setHours] = useState(24)
  const [focus, setFocus] = useState<string | null>(null)
  const state = sys.crewOxygen()
  const t1 = sys.now, t0 = t1 - hours * HOUR
  const W = 660, L = 44, R = 76
  const x = (t: number) => L + ((t - t0) / (t1 - t0)) * (W - L - R)
  const lines = crew.map((c, i) => ({ id: c.id, color: CREW_COLORS[i], pts: bin(sys.history('spo2', c.id), t0, t1) }))
  const pio2 = bin(sys.history('cabin_pio2', null), t0, t1)
  const co2 = bin(rollingMean(sys.history('cabin_co2', null), 60), t0, t1)
  const spo2Emergency = metricConfig('spo2').emergency
  const panels = [
    { key: 'A', label: 'Blood oxygen %', y: 4, h: 340, lo: 80, hi: 100, bands: [...thresholdBands('spo2'), ...(spo2Emergency && 'op' in spo2Emergency ? [{ level: 'red', side: 'below', value: spo2Emergency.value } as Band] : [])], series: lines.filter((l) => !focus || l.id === focus) },
    { key: 'B', label: 'Cabin O₂ PIO₂ mmHg', y: 356, h: 110, bands: thresholdBands('cabin_pio2'), series: [{ id: 'PIO₂', color: 'var(--text)', pts: pio2 }] },
    { key: 'C', label: 'Cabin CO₂ 1-h avg mmHg', y: 478, h: 110, bands: thresholdBands('cabin_co2'), series: [{ id: 'CO₂', color: 'var(--text)', pts: co2 }] },
  ]
  const H = 606
  const fix = (v: number | undefined, d: number) => (v === undefined ? '—' : v.toFixed(d))
  const read = (t: number) => {
    const snap = nearestPoint(lines.flatMap((l) => l.pts), t)?.time ?? t
    const rows: HoverRow[] = [
      ...lines.map((l) => ({ label: `${l.id} SpO₂`, value: `${fix(nearestPoint(l.pts, snap)?.value, 1)} %`, color: l.color })),
      { label: 'Cabin PIO₂', value: `${fix(nearestPoint(pio2, snap)?.value, 0)} mmHg` },
      { label: 'Cabin CO₂ 1-h', value: `${fix(nearestPoint(co2, snap)?.value, 2)} mmHg` },
    ]
    return { time: snap, rows }
  }
  return (
    <div className="ox">
      <div className="ox-head">
        <div className="ox-strip" data-level={state.level}><Shape level={state.level} size={12} /> {state.text}{state.note && <span className="muted"> · {state.note}</span>}</div>
        <InfoTip title="Crew oxygen chart">
          <span>Answers one question: when oxygen falls, is the problem in one person or in life support?</span>
          <ul>
            <li><b>Top:</b> blood oxygen (SpO₂) of every astronaut, one line each; the selected person is thicker.</li>
            <li><b>Middle:</b> cabin oxygen as inspired pressure (PIO₂), because the same % means less oxygen when pressure falls.</li>
            <li><b>Bottom:</b> cabin CO₂, 1-hour average.</li>
            <li>Yellow band = Caution, red band = Critical (Main Panel Alarm Checklist, NASA-STD-3001).</li>
            <li><b>Strip:</b> a drop in one person means check that person and the sensor; in more than one person, check the cabin air first.</li>
            <li>Click a name below to show only that person; hover for the values at that time.</li>
          </ul>
        </InfoTip>
        <div className="seg" role="group" aria-label="Time window">
          {OX_WINDOWS.map((h) => <button key={h} aria-pressed={hours === h} onClick={() => setHours(h)}>{h} h</button>)}
        </div>
      </div>
      <HoverChart x0={L} x1={W - R} t0={t0} t1={t1} read={read}>
      <svg viewBox={`0 0 ${W} ${H}`} className="ox-svg" role="img" aria-label={`Crew oxygen chart: ${state.text}`}>
        {panels.map((p) => {
          const vals = [...p.series.flatMap((s) => s.pts.map((d) => d.value)), ...p.bands.map((b) => b.value)]
          const lo = p.lo ?? Math.min(...vals), hi = p.hi ?? Math.max(...vals), pad = p.lo === undefined ? (hi - lo || 1) * 0.1 : 0
          const y = (v: number) => p.y + (1 - (Math.min(hi + pad, Math.max(lo - pad, v)) - (lo - pad)) / (hi - lo + 2 * pad)) * p.h
          return (
            <g key={p.key}>
              <rect x={L} y={p.y} width={W - L - R} height={p.h} fill="none" stroke="var(--line-2)" />
              {p.bands.map((b, i) => {
                const top = b.side === 'above' ? p.y : y(b.value), bottom = b.side === 'above' ? y(b.value) : p.y + p.h
                return (
                  <g key={i}>
                    <rect x={L} y={top} width={W - L - R} height={Math.max(0, bottom - top)} fill={COLOR[b.level]} opacity={b.level === 'red' ? 0.13 : 0.08} />
                  </g>
                )
              })}
              <text x={L - 4} y={p.y + 9} textAnchor="end" className="chart-tick">{Number((hi + pad).toFixed(1))}</text>
              <text x={L - 4} y={p.y + p.h} textAnchor="end" className="chart-tick">{Number((lo - pad).toFixed(1))}</text>
              <text x={L + 4} y={p.y + 11} className="chart-tick">{p.label}</text>
              {p.series.map((s) => (
                <g key={s.id}>
                  <polyline points={s.pts.map((d) => `${x(d.time).toFixed(1)},${y(d.value).toFixed(1)}`).join(' ')} fill="none" stroke={s.color}
                    strokeWidth={state.droppers.includes(s.id) || s.id === crewId ? 2.4 : 1.2} opacity={state.droppers.length && !state.droppers.includes(s.id) && p.key === 'A' ? 0.45 : 1} strokeLinejoin="round" />
                </g>
              ))}
              {/* right column: band names and line ends, moved apart so no two overlap */}
              {spread([
                ...p.bands.map((b, i) => ({ key: `b${i}`, y: y(b.value) + 3, text: b.level === 'red' ? 'Critical' : 'Caution', fill: COLOR[b.level] })),
                ...(p.key === 'A' ? p.series.filter((s) => s.pts.length).map((s) => ({ key: s.id, y: y(s.pts[s.pts.length - 1].value) + 3, text: s.id, fill: s.color })) : []),
              ].filter((l, i, all) => all.findIndex((m) => m.text === l.text && Math.abs(m.y - l.y) < 1) === i), 12, p.y + 10, p.y + p.h).map((l) => (
                <text key={l.key} x={W - R + 3} y={l.y} className="chart-tick" fill={l.fill}>{l.text}</text>
              ))}
            </g>
          )
        })}
        <text x={L} y={H - 2} className="chart-tick">{clock(t0)}</text>
        <text x={W - R} y={H - 2} textAnchor="end" className="chart-tick">{clock(t1)} UTC</text>
      </svg>
      </HoverChart>
      <div className="ox-legend">
        {lines.map((l) => (
          <button key={l.id} className="ox-key" aria-pressed={focus === l.id} onClick={() => setFocus(focus === l.id ? null : l.id)} title="Show only this person">
            <i style={{ background: l.color }} />{l.id}
          </button>
        ))}
      </div>
      <span className="muted note">{NOTE} <span className="tag">SIM</span></span>
    </div>
  )
}

/** Graph 2: mission readiness. Cards for every astronaut (score never without its breakdown) and the selected person's 14 days. */
export function ReadinessPanel({ crewId }: { crewId: string }) {
  const sys = useSystem()
  // sliding window: the last 14 days up to now; the oldest day leaves the chart as a new one comes in
  const t1 = sys.now, t0 = t1 - 13.5 * DAY
  const days = Array.from({ length: 14 }, (_, i) => t1 - (13 - i) * DAY)
  const series = days.map((at) => sys.readiness(crewId, at).score)
  const sleep = sys.history('sleep_hours', crewId).filter((m) => m.time >= t0)
  const hrv = sys.history('hrv', crewId).filter((m) => m.time >= t0)
  const tests = sys.history('cognition_z', crewId).filter((m) => m.time >= t0)
  const hrvBand = thresholdBands('hrv', sys.context(crewId)).filter((b) => b.level === 'yellow') // the personal normal band
  const b = readinessBands()
  const W = 640, L = 64, R = 8, row = 120, PX = 14
  const x = (t: number) => L + PX + ((t - t0) / (t1 - t0)) * (W - L - R - 2 * PX)
  const near = (ms: Measurement[], t: number) => { const p = nearestPoint(ms, t); return p && Math.abs(p.time - t) < 0.6 * DAY ? p : null }
  const read = (t: number) => {
    const i = days.indexOf(nearestPoint(days.map((d) => ({ time: d })), t)!.time)
    const at = days[i], sl = near(sleep, at), hv = near(hrv, at), ts = near(tests, at)
    return { time: at, rows: [
      { label: 'Sleep', value: sl ? `${sl.value.toFixed(1)} h` : '—' },
      { label: 'HRV', value: hv ? `${Math.round(hv.value)} ms` : '—' },
      { label: 'Test', value: ts ? `z ${ts.value.toFixed(2)}` : '—' },
      { label: 'Score', value: series[i] === null ? '—' : String(Math.round(series[i]!)) },
    ] }
  }
  const scale = (v: number, lo: number, hi: number, y0: number) => y0 + row - ((v - lo) / (hi - lo || 1)) * (row - 6)
  const hrvVals = hrv.map((m) => m.value)
  const hLo = Math.min(...hrvVals, ...hrvBand.map((x) => x.value)) - 3, hHi = Math.max(...hrvVals) + 3
  const cfg = readinessConfig()
  const pct = (w: number) => `${Math.round(w * 100)} %`
  return (
    <div className="rd">
      <div className="ox-head">
        <span className="muted">Score 0–100 · selected: <b>{crewId}</b> · last 14 days below ({date(days[0])} – {date(t1)})</span>
        <InfoTip title="Mission readiness panel">
          <span>Is this person ready for the next critical task (EVA, robot arm, docking)? Tiredness is something people do not notice in themselves, so the score uses measurements, not feelings.</span>
          <ul>
            <li><b>Score</b> = weighted mean of sleep ({pct(cfg.weights.sleep)}), HRV ({pct(cfg.weights.hrv)}), cognitive test ({pct(cfg.weights.cognition)}) and cabin CO₂ ({pct(cfg.weights.co2)}).</li>
            <li><b>Below the score:</b> points each part takes off; the biggest loss is bold. "no data" parts are left out.</li>
            <li>{cfg.bands.ready} and above Ready · {cfg.bands.caution}–{cfg.bands.ready - 1} Caution · below {cfg.bands.caution} Not ready.</li>
            <li><b>Red gate:</b> a part that is red on its own (for example less than {cfg.redGate.sleepBelowH} h sleep the night before an EVA) makes the card Not ready whatever the score.</li>
            <li><b>Rows:</b> sleep hours per night, HRV per morning (dashed line = lower edge of the personal normal band), cognitive test z-score (0 = own normal), daily score (dashed lines = {cfg.bands.ready} and {cfg.bands.caution}).</li>
            <li>Weights and bands are proposals (Chart Blueprint, section 5) until the flight surgeon approves them.</li>
          </ul>
        </InfoTip>
      </div>
      <div className="rd-cards">
        {crew.map((c) => {
          const r = sys.readiness(c.id)
          const hours = r.task ? Math.round((r.task.time - sys.now) / HOUR) : null
          return (
            <div key={c.id} className="rd-card" data-level={r.level} aria-current={c.id === crewId}>
              <span className="rd-id">{c.id}</span>
              <span className="rd-score num">{r.score === null ? '—' : Math.round(r.score)}</span>
              <span className="rd-label"><Shape level={r.level} size={10} /> {r.score === null ? 'No score' : r.label}</span>
              <span className="rd-break">
                {r.losses.map((l, i) => (
                  <span key={l.part} className={l.loss === null ? 'muted' : l.part === r.worst ? 'rd-worst' : ''}>
                    {i > 0 && ' · '}{PART_LABEL[l.part]} {l.loss === null ? 'no data' : Math.round(l.loss)}
                  </span>
                ))}
              </span>
              {r.score === null && <span className="muted rd-why">{r.label}</span>}
              {r.task && <span className="muted">{r.task.label} in {hours} h</span>}
            </div>
          )
        })}
      </div>
      <HoverChart x0={x(t0)} x1={x(t1)} t0={t0} t1={t1} read={read}>
      <svg viewBox={`0 0 ${W} ${row * 4 + 18}`} className="rd-svg" role="img" aria-label={`${crewId} last 14 days`}>
        {['Sleep h', 'HRV ms', 'Test z', 'Score'].map((label, i) => (
          <g key={label}>
            <rect x={L} y={i * row} width={W - L - R} height={row - 4} fill="none" stroke="var(--line)" />
            <text x={L - 4} y={i * row + row / 2} textAnchor="end" className="chart-tick">{label}</text>
          </g>
        ))}
        {sleep.map((m) => {
          const y = scale(m.value, 0, 10, 0)
          return (
            <g key={m.time}>
              <rect x={x(m.time) - 8} y={y} width={16} height={Math.max(0, row - 4 - y)} fill="var(--text)" opacity={0.45}><title>{`${date(m.time)} ${m.value} h`}</title></rect>
              <text x={x(m.time)} y={y - 3} textAnchor="middle" className="chart-tick rd-num">{m.value.toFixed(1)}</text>
            </g>
          )
        })}
        {hrvBand.map((band, i) => <line key={i} x1={L} x2={W - R} y1={scale(band.value, hLo, hHi, row)} y2={scale(band.value, hLo, hHi, row)} stroke={COLOR[band.level]} strokeDasharray="3 3" />)}
        {hrv.map((m) => (
          <g key={m.time}>
            <circle cx={x(m.time)} cy={scale(m.value, hLo, hHi, row)} r={3} fill="var(--text)"><title>{`${date(m.time)} ${m.value} ms`}</title></circle>
            <text x={x(m.time)} y={scale(m.value, hLo, hHi, row) - 6} textAnchor="middle" className="chart-tick rd-num">{Math.round(m.value)}</text>
          </g>
        ))}
        {hrvBand.map((band, i) => <text key={`t${i}`} x={W - R - 2} y={scale(band.value, hLo, hHi, row) + 10} textAnchor="end" className="chart-tick" fill={COLOR[band.level]}>normal band {band.value.toFixed(0)} ms</text>)}
        <line x1={L} x2={W - R} y1={scale(0, -3, 3, row * 2)} y2={scale(0, -3, 3, row * 2)} stroke="var(--line-2)" />
        {tests.map((m) => (
          <g key={m.time}>
            <circle cx={x(m.time)} cy={scale(m.value, -3, 3, row * 2)} r={3.5} fill="var(--text)"><title>{`${date(m.time)} z ${m.value}`}</title></circle>
            <text x={x(m.time)} y={scale(m.value, -3, 3, row * 2) - 7} textAnchor="middle" className="chart-tick rd-num">z {m.value.toFixed(2)}</text>
          </g>
        ))}
        <text x={W - R - 2} y={scale(0, -3, 3, row * 2) - 3} textAnchor="end" className="chart-tick">0 = own normal</text>
        {tests.length === 0 && <text x={W / 2} y={row * 2 + row / 2 + 14} textAnchor="middle" className="chart-tick">no test in the last 14 days</text>}
        {[{ v: b.ready, l: 'yellow' as Level }, { v: b.caution, l: 'red' as Level }].map((g) => <line key={g.v} x1={L} x2={W - R} y1={scale(g.v, 0, 100, row * 3)} y2={scale(g.v, 0, 100, row * 3)} stroke={COLOR[g.l]} strokeDasharray="3 3" />)}
        <polyline fill="none" stroke="var(--text)" strokeWidth={1.6} points={days.map((t, i) => (series[i] === null ? '' : `${x(t)},${scale(series[i]!, 0, 100, row * 3)}`)).join(' ')} />
        {days.map((t, i) => series[i] !== null && (
          <g key={t}>
            <circle cx={x(t)} cy={scale(series[i]!, 0, 100, row * 3)} r={2.5} fill="var(--text)"><title>{`${date(t)} score ${Math.round(series[i]!)}`}</title></circle>
            <text x={x(t)} y={scale(series[i]!, 0, 100, row * 3) - 6} textAnchor="middle" className="chart-tick rd-num">{Math.round(series[i]!)}</text>
          </g>
        ))}
        {[{ v: b.ready, l: 'yellow' as Level }, { v: b.caution, l: 'red' as Level }].map((g) => <text key={`g${g.v}`} x={W - R - 2} y={scale(g.v, 0, 100, row * 3) + 10} textAnchor="end" className="chart-tick" fill={COLOR[g.l]}>{g.v}</text>)}
        {days.map((t, i) => series[i] === null && <text key={`n${t}`} x={x(t)} y={row * 3 + row / 2} textAnchor="middle" className="chart-tick">—</text>)}
        {days.map((t) => <line key={`d${t}`} x1={x(t)} x2={x(t)} y1={row * 4 - 4} y2={row * 4} stroke="var(--line-2)" />)}
        {days.map((t, i) => <text key={`dl${t}`} x={x(t)} y={row * 4 + 14} textAnchor="middle" className="chart-tick rd-date">{i === 13 ? 'today' : date(t).slice(5)}</text>)}
      </svg>
      </HoverChart>
      <span className="muted note">{NOTE} Weights and bands are proposals until the flight surgeon approves them. <span className="tag">SIM</span></span>
    </div>
  )
}

/** Health hexagon: six loads, centre 0, outer edge full load, dashed ring at the ORI 60 level (ORI itself is written below it). */
export function HealthHexagon({ crewId }: { crewId: string }) {
  const sys = useSystem()
  const hx = sys.hexagon(crewId)
  const cx = 190, cy = 135, rr = 92
  const pt = (i: number, r: number) => {
    const a = (Math.PI * 2 * i) / 6 - Math.PI / 2
    return [cx + Math.cos(a) * r * rr, cy + Math.sin(a) * r * rr]
  }
  const ring = (r: number) => hx.axes.map((_, i) => pt(i, r).join(',')).join(' ')
  return (
    <svg viewBox="0 0 380 270" className="octagon" role="img" aria-label={`Health hexagon: ${hx.axes.map((a) => `${a.label} ${a.value === null ? 'no data' : Math.round(a.value * 100) + ' %'}`).join(', ')}`}>
      <polygon points={ring(1)} fill="none" stroke="var(--line-2)" />
      <polygon points={ring(0.5)} fill="none" stroke="var(--line)" />
      <polygon points={ring(hx.ring)} fill="none" stroke="var(--yellow)" strokeDasharray="4 3" opacity={0.8} />
      {hx.axes.map((_, i) => <line key={i} x1={cx} y1={cy} x2={pt(i, 1)[0]} y2={pt(i, 1)[1]} stroke="var(--line)" />)}
      <polygon points={hx.axes.map((a, i) => pt(i, a.value ?? 0).join(',')).join(' ')} fill="var(--text)" fillOpacity="0.14" stroke="var(--text)" strokeWidth="1.5" />
      {hx.axes.map((a, i) => {
        const [px, py] = pt(i, a.value ?? 0)
        const [lx, ly] = pt(i, 1.28)
        return (
          <g key={a.label}>
            <circle cx={px} cy={py} r="3.5" fill={a.value === null ? 'none' : 'var(--text)'} stroke="var(--text)" />
            <text x={lx} y={ly} textAnchor="middle" className="octagon-label">{a.label}</text>
            <text x={lx} y={ly + 14} textAnchor="middle" className="chart-tick"><title>{a.note}</title>{a.value === null ? 'no data' : `${Math.round(a.value * 100)} %`}</text>
          </g>
        )
      })}
    </svg>
  )
}

const LAB_WINDOWS: { label: string; hours: number }[] = [
  { label: '1 week', hours: 7 * 24 },
  { label: '1 month', hours: 30 * 24 },
  { label: '3 months', hours: 90 * 24 },
  { label: 'All', hours: Infinity },
]

/** Blood and urine test results: latest values coloured by level, and the history of one value. */
export function LabPanel({ crewId }: { crewId: string }) {
  const sys = useSystem()
  const ids = metricIds('lab')
  const [sel, setSel] = useState(ids[0])
  const [win, setWin] = useState(LAB_WINDOWS[3].hours)
  const inWindow = sys.history(sel, crewId).filter((m) => m.time > sys.now - win * HOUR)
  return (
    <div className="lab">
      <div className="lab-list">
        <div className="lab-row lab-head"><span>Test</span><span>Latest</span><span>Date</span></div>
        {ids.map((id) => {
          const m = sys.latest(id, crewId)
          return (
            <button key={id} className="lab-row" aria-pressed={sel === id} onClick={() => setSel(id)} title={metricConfig(id).source}>
              <span>{metricConfig(id).label}</span>
              {m ? <Value value={m.value} unit={m.unit} status={sys.status(id, crewId)} size={10} /> : <span className="muted">—</span>}
              <span className="muted num">{m ? date(m.time) : '—'}</span>
            </button>
          )
        })}
        <span className="muted">Blood monthly, urine weekly (first morning urine). <span className="tag">SIM</span></span>
      </div>
      <div className="lab-chart">
        <div className="panel-head">
          <h3>{metricConfig(sel).label}</h3>
          <div className="seg" role="group" aria-label="Time frame">
            {LAB_WINDOWS.map((w) => <button key={w.label} aria-pressed={win === w.hours} onClick={() => setWin(w.hours)}>{w.label}</button>)}
          </div>
        </div>
        <div className="lab-plot">
          {inWindow.length >= 2 ? <TrendChart metricId={sel} crewId={crewId} hours={win} size={[560, 260]} /> : <div className="empty"><b>{inWindow.length ? 'One test in this period' : 'No test in this period'}</b><span className="muted">Choose a longer time frame.</span></div>}
        </div>
        <div className="lab-below">
        <table className="lab-table">
          <tbody>
            {[...inWindow].reverse().map((m) => (
              <tr key={m.time}><td className="num">{date(m.time)} {clock(m.time)}</td><td className="num">{m.value} {m.unit}</td></tr>
            ))}
          </tbody>
        </table>
        {metricConfig(sel).openItems?.map((o) => <span key={o} className="muted">Open item: {o}</span>)}
        {inspiration4(sel).length > 0 && (
          <details className="mh-table" open>
            <summary>Real reference: Inspiration4 crew <span className="tag real">NASA OSDR</span></summary>
            <span className="muted note">{inspiration4Meta.source}. {inspiration4Meta.timepoints}. Laboratory reference range shown per row.</span>
            <table>
              <thead><tr><th>Crew</th>{[...new Set(inspiration4(sel).map((r) => r.time))].map((t) => <th key={t}>{t}</th>)}<th>Range</th></tr></thead>
              <tbody>
                {[...new Set(inspiration4(sel).map((r) => r.subject))].map((s) => {
                  const rs = inspiration4(sel).filter((r) => r.subject === s)
                  return <tr key={s}><td>{s}</td>{[...new Set(inspiration4(sel).map((r) => r.time))].map((t) => <td key={t} className="num">{rs.find((r) => r.time === t)?.value ?? '—'}</td>)}<td className="muted">{rs[0].range.join('–')} {rs[0].unit}</td></tr>
                })}
              </tbody>
            </table>
          </details>
        )}
        </div>
      </div>
    </div>
  )
}

/** Alert history: every time a value entered caution or critical, newest first. */
export function AlertHistory({ crewId }: { crewId: string }) {
  const sys = useSystem()
  const [all, setAll] = useState(false)
  const rows = sys.alertLog.filter((a) => all || a.crewId === crewId || a.crewId === null).slice().reverse()
  const label = (id: string) => (id === 'checkin' ? 'Daily check-in' : metricConfig(id).label)
  return (
    <div className="hist">
      <div className="seg" role="group" aria-label="Who">
        <button aria-pressed={!all} onClick={() => setAll(false)}>{crewId} + cabin</button>
        <button aria-pressed={all} onClick={() => setAll(true)}>All crew</button>
      </div>
      {rows.length === 0 ? <div className="empty"><b>No alerts yet</b><span className="muted">Caution and critical events appear here.</span></div> : (
        <table>
          <thead><tr><th>Time</th><th>Who</th><th>Value</th><th>Level</th><th>Why</th><th>Earth</th></tr></thead>
          <tbody>
            {rows.map((a, i) => {
              const n = a.level === 'red' ? sys.notifications.list.find((x) => x.crewId === a.crewId && x.metricId === a.metricId && x.time >= a.time) : undefined
              return (
                <tr key={i} data-level={a.level}>
                  <td className="num">{date(a.time)} {clock(a.time)}</td>
                  <td>{a.crewId ?? 'Cabin'}</td>
                  <td>{label(a.metricId)}</td>
                  <td className="hist-level"><Shape level={a.level} /> {LEVEL_UI[a.level].word}</td>
                  <td className="hist-why">{a.reason}</td>
                  <td className="muted">{n ? (n.earth === 'sent' ? 'sent' : 'queued') : '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}

/** Check-in sub panel: the daily check-in button, past check-ins, the health issue log and the log entries. */
/** "Don't break the chain" (gamification, Space Apps challenge): one link per day with a check-in, streak, milestone. */
export function CheckinChain({ crewId, compact }: { crewId: string; compact?: boolean }) {
  const sys = useSystem()
  const c = sys.chain(crewId)
  const reminder = sys.reminders.filter((r) => r.crewId === crewId)
  return (
    <div className={`chain ${compact ? 'chain-compact' : ''}`}>
      <div className="chain-head">
        <span className="chain-streak num">{c.streak}</span>
        <span><b>day chain</b><br /><span className="muted">best {c.best} · {c.next ? `next goal ${c.next} days (${c.next - c.streak} to go)` : 'all goals reached'}</span></span>
        <InfoTip title="Don't break the chain">
          <span>Every day with a check-in adds a link. Check in every day and the chain grows; one missed day starts it again. A reminder comes when the morning sleep diary is still open at {String(checkinCfg.reminders.morningHour).padStart(2, '0')}:00 and the evening symptom diary at {checkinCfg.reminders.eveningHour}:00 (UTC). Goals: {checkinCfg.reminders.milestones.join(', ')} days. Links before the simulation start are sample data.</span>
        </InfoTip>
      </div>
      <div className="chain-links" aria-label={`Last ${c.links.length} days`}>
        {c.links.map((l) => <i key={l.time} data-done={l.done} data-today={l.today} data-sample={l.sample} title={`${date(l.time)}${l.done ? ' · checked in' : l.today ? ' · not yet today' : ' · missed'}${l.sample ? ' (sample)' : ''}`} />)}
      </div>
      <span className={c.todayDone ? 'chain-ok' : 'chain-todo'}>{c.todayDone ? `Today's link is in. ${c.next ? `${c.next - c.streak} more day${c.next - c.streak === 1 ? '' : 's'} to the ${c.next}-day goal.` : ''}` : `Check in today to make it ${c.streak + 1} day${c.streak ? 's' : ''}.`}</span>
      {!compact && reminder.map((r) => <span key={r.part} className="chain-reminder"><Bell size={14} /> Reminder {clock(r.time)} · {r.message}</span>)}
    </div>
  )
}

export function CheckinPanel({ crewId }: { crewId: string }) {
  const sys = useSystem()
  const checkins = sys.recordsOf(crewId, 'checkin').slice().reverse()
  const issues = checkins.filter((r) => typeof r.data.issue === 'string')
  return (
    <div className="cip">
      <div className="cip-col">
        <CheckinChain crewId={crewId} />
        <div className="person-actions"><CheckInButton crewId={crewId} /></div>
        <h3 className="entry-title">Today's checklist</h3>
        <ul className="checklist">
          {sys.checklist(crewId).map((i) => (
            <li key={i.id} data-done={i.done} data-due={i.due}>
              {i.done ? <CircleCheck size={16} strokeWidth={1.75} /> : <Circle size={16} strokeWidth={1.75} />}
              <span>{i.label}</span>
              <span className="muted">{i.done ? `done ${clock(i.time!)}` : i.due ? 'to do' : 'later today'}</span>
            </li>
          ))}
        </ul>
        <h3 className="entry-title">Health issues (not urgent)</h3>
        {issues.length === 0 ? <span className="muted">No issue logged.</span> : issues.map((r) => (
          <div key={r.id} className="cip-item"><span className="muted num">{date(r.time)} {clock(r.time)}</span><span>{String(r.data.issue)}</span></div>
        ))}
        <h3 className="entry-title">Past check-ins</h3>
        {checkins.length === 0 ? <span className="muted">No check-in yet.</span> : checkins.map((r) => {
          const level = r.data.level as Level
          return (
            <div key={r.id} className="cip-item" data-level={level}>
              <span className="muted num">{date(r.time)} {clock(r.time)} · {r.data.part === 'morning' ? 'sleep diary' : 'symptom diary'}</span>
              <span><Shape level={level} /> {LEVEL_UI[level].word}{(r.data.reasons as string[]).length ? ` · ${(r.data.reasons as string[]).join(' · ')}` : ''}</span>
            </div>
          )
        })}
      </div>
      <div className="cip-col"><EntryPanel crewId={crewId} /></div>
    </div>
  )
}
