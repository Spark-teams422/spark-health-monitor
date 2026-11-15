// Charts (Step 4b): trends with threshold bands.
// Bands and colours come from the shared layer (thresholdBands / status); nothing is hard-coded here.
import { HoverChart, nearestPoint } from '../components/HoverChart'
import { spread } from '../components/spread'
import { clock } from '../components/NotificationList'
import { LEVEL_UI, StatusBadge } from '../components/StatusBadge'
import { instantLevel, thresholdBands, thresholds } from '../core/statusEngine'
import { metricConfig, useSystem } from '../core/system'
import type { Level } from '../core/types'

const COLOR: Record<Level, string> = { green: 'var(--green)', yellow: 'var(--yellow)', red: 'var(--red)', nodata: 'var(--nodata)' }
const DAY = 24 * 3600_000
const PAD = { l: 34, r: 8, t: 8, b: 18 }
const MARKER_LABEL_W = 34 // px width of a short marker label such as "SEP"

/** One metric over time with its caution (yellow) and critical (red) bands. */
export interface ChartMarker {
  time: number
  label: string
}

/** `plain` = information only: no status badge (the metric has no limit). `markers` = dated events drawn as vertical lines. */
/** `bare` = monitor style: the line and bands only, stretched to fill its box (no text). */
export function TrendChart({ metricId, crewId, hours, plain, markers = [], bare, size = [320, 130] }: { metricId: string; crewId: string | null; hours: number; plain?: boolean; markers?: ChartMarker[]; bare?: boolean; size?: [number, number] }) {
  const [W, H] = size
  const sys = useSystem()
  const cfg = metricConfig(metricId)
  const data = sys.history(metricId, crewId).filter((m) => m.time > sys.now - hours * 3600_000)
  const bands = thresholdBands(metricId, sys.context(crewId))
  const status = sys.status(metricId, crewId)
  if (data.length < 2) return <div className="chart"><span className="muted">{cfg.label}</span><span className="muted">Not enough data yet.</span></div>
  const read = (t: number) => {
    const p = nearestPoint(data, t)
    return p && { time: p.time, rows: [{ label: cfg.label, value: `${p.value} ${cfg.unit}`, color: plain ? 'var(--accent)' : COLOR[instantLevel(metricId, p.value, sys.context(crewId))] }] }
  }
  if (bare) {
    const t0 = data[0].time, t1 = data[data.length - 1].time
    // trend display: mean of ~32 time bins, so minute-to-minute sensor noise does not hide the trend
    const size = (t1 - t0) / 32 || 1
    const bins = new Map<number, { t: number; sum: number; n: number }>()
    for (const d of data) {
      const k = Math.floor((d.time - t0) / size), b = bins.get(k) ?? { t: 0, sum: 0, n: 0 }
      b.t += d.time; b.sum += d.value; b.n++
      bins.set(k, b)
    }
    const binned = [...bins.values()].map((b) => ({ time: b.t / b.n, value: b.sum / b.n }))
    // scale to the data; a limit outside the view is clipped (the number panel lists it)
    const vals = binned.map((d) => d.value)
    const lo = Math.min(...vals), hi = Math.max(...vals), pd = Math.max((hi - lo) * 0.35, Math.abs(hi) * 0.04, 0.05)
    const bx = (t: number) => ((t - t0) / (t1 - t0 || 1)) * 100
    const by = (v: number) => 40 - ((v - lo + pd) / (hi - lo + 2 * pd)) * 40
    return (
      <HoverChart className="chart-bare" x0={0} x1={100} t0={t0} t1={t1} read={read}>
      <svg className="chart-bare-svg" viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden>
        {bands.map((b, i) => {
          const edge = Math.min(40, Math.max(0, by(b.value))) // a limit outside the view is clipped to the edge
          return <rect key={i} x="0" width="100" y={b.side === 'above' ? 0 : edge} height={b.side === 'above' ? edge : 40 - edge} fill={COLOR[b.level]} opacity={b.level === 'red' ? 0.16 : 0.09} />
        })}
        {bands.map((b, i) => <line key={`l${i}`} x1="0" x2="100" y1={by(b.value)} y2={by(b.value)} stroke={COLOR[b.level]} strokeWidth="1" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" opacity="0.7" />)}
        <polyline points={binned.map((d) => `${bx(d.time).toFixed(2)},${by(d.value).toFixed(2)}`).join(' ')} fill="none" stroke="currentColor" strokeWidth="1.4" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
      </svg>
      </HoverChart>
    )
  }

  // own baseline band (median ± z_caution · scale), when the person has a robust baseline
  const base = status.baseline?.ok ? { lo: status.baseline.median! - thresholds.baseline.zCaution * status.baseline.scale!, hi: status.baseline.median! + thresholds.baseline.zCaution * status.baseline.scale!, ref: status.baseline.ref } : null
  const values = [...data.map((d) => d.value), ...bands.map((b) => b.value), ...(base ? [base.lo, base.hi] : [])]
  const lo = Math.min(...values), hi = Math.max(...values), pad = (hi - lo || 1) * 0.08
  const y0 = lo - pad, y1 = hi + pad
  const t0 = data[0].time, t1 = data[data.length - 1].time
  const x = (t: number) => PAD.l + ((t - t0) / (t1 - t0 || 1)) * (W - PAD.l - PAD.r)
  const y = (v: number) => PAD.t + (1 - (v - y0) / (y1 - y0)) * (H - PAD.t - PAD.b)
  const last = data[data.length - 1]

  return (
    <figure className="chart">
      <figcaption>
        <span className="muted">{cfg.label}</span>
        <b>{last.value} {cfg.unit}</b>
        {!plain && <StatusBadge status={status} />}
      </figcaption>
      <HoverChart x0={PAD.l} x1={W - PAD.r} t0={t0} t1={t1} read={read}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${cfg.label} trend, latest ${last.value} ${cfg.unit}${plain ? '' : `, ${LEVEL_UI[status.level].word}`}`}>
        {/* yellow first, red on top, so the worse band wins where they overlap */}
        {bands.map((b, i) => {
          const top = b.side === 'above' ? y(y1) : y(b.value)
          const bottom = b.side === 'above' ? y(b.value) : y(y0)
          return <rect key={i} x={PAD.l} y={top} width={W - PAD.l - PAD.r} height={Math.max(0, bottom - top)} fill={COLOR[b.level]} opacity={b.level === 'red' ? 0.28 : 0.18} />
        })}
        {bands.map((b, i) => <line key={`l${i}`} x1={PAD.l} x2={W - PAD.r} y1={y(b.value)} y2={y(b.value)} stroke={COLOR[b.level]} strokeDasharray="4 3" strokeWidth="1" />)}
        {spread(bands.map((b, i) => ({ i, b, y: y(b.value) + 3 })), 12, 10, H - PAD.b).map(({ i, b, y: ly }) => (
          <text key={`t${i}`} x={PAD.l - 4} y={ly} textAnchor="end" className="chart-tick" fill={COLOR[b.level]}>{Number(b.value.toFixed(1))}</text>
        ))}
        {base && (
          <g>
            <rect x={PAD.l} width={W - PAD.l - PAD.r} y={y(base.hi)} height={Math.max(0, y(base.lo) - y(base.hi))} fill="var(--real)" opacity={0.12} />
            <text x={W - PAD.r - 3} y={y(base.hi) + 11} textAnchor="end" className="chart-tick" fill="var(--real)">own baseline · {base.ref}</text>
          </g>
        )}
        <polyline points={data.map((d) => `${x(d.time).toFixed(1)},${y(d.value).toFixed(1)}`).join(' ')} fill="none" stroke="var(--text)" strokeWidth="1.6" />
        {markers.filter((m) => m.time >= t0 && m.time <= t1).map((m, i, shown) => {
          // a label close to the previous one goes one row lower, so marker labels never overlap
          const row = shown.slice(0, i).filter((p) => x(m.time) - x(p.time) < MARKER_LABEL_W).length % 3
          return (
            <g key={`m${i}`}>
              <line x1={x(m.time)} x2={x(m.time)} y1={PAD.t} y2={H - PAD.b} stroke="var(--real)" strokeWidth="1.5" strokeDasharray="2 2" />
              <text x={x(m.time) + 3} y={PAD.t + 10 + row * 13} className="chart-tick" fill="var(--real)">{m.label}</text>
            </g>
          )
        })}
        <circle cx={x(last.time)} cy={y(last.value)} r="3.5" fill={plain ? 'var(--accent)' : COLOR[status.silent ? 'green' : status.level]} stroke="var(--text)" />
        <text x={PAD.l} y={H - 4} className="chart-tick">{hours >= 48 ? `${Math.round((t1 - t0) / DAY)} d ago` : clock(t0)}</text>
        <text x={W - PAD.r} y={H - 4} textAnchor="end" className="chart-tick">{clock(t1)}</text>
      </svg>
      </HoverChart>
    </figure>
  )
}
