// Early warning (Personal screen, under the health hexagon): risk-factor cards and trend projections from
// system.earlyWarning(). It tells where a value goes if its trend continues, against the limits that already exist;
// it never raises an alarm, never names a probability or a diagnosis.
import { InfoTip } from '../components/InfoTip'
import { useSystem } from '../core/system'
import { TRENDS, type Projection } from '../core/trends'
import type { Level } from '../core/types'

const COLOR: Record<Level, string> = { green: 'var(--green)', yellow: 'var(--yellow)', red: 'var(--red)', nodata: 'var(--nodata)' }
const n = (x: number) => String(Number(x.toPrecision(x >= 1 && x < 1.1 ? 4 : 2)))
const meta = (id: string) => TRENDS.metrics.find((m) => m.id === id)!

/** One short sentence an astronaut can read (no jargon, no ranges; the range is in the hover text). */
export function trendSentence(p: Projection): string {
  const m = meta(p.metricId)
  const u = m.unit ? ` ${m.unit}` : ''
  const lim = (b: NonNullable<Projection['band']>) => `${n(b.value)}${u} (${b.level === 'red' ? 'critical' : 'caution'})`
  const head = `${m.name} ${n(p.recent!)}${u}`
  if (p.state === 'beyond') return `${head}: past ${lim(p.band!)}.`
  const days = Math.max(1, Math.round(p.days!))
  return `${head}, going ${p.slope > 0 ? 'up' : 'down'}.${p.passed ? ` Past ${lim(p.passed)}.` : ''} Reaches ${lim(p.band!)} in about ${days} day${days > 1 ? 's' : ''}.`
}
const rangeText = (p: Projection) => (p.range ? `Range ${p.range[0] === null ? '?' : Math.max(1, Math.round(p.range[0]))}–${p.range[1] === null ? `${TRENDS.horizonDays}+` : Math.round(p.range[1])} days` : '')

function Spark({ p }: { p: Projection }) {
  const W = 92, H = 28
  const d0 = p.points[0].day, d1 = p.points[p.points.length - 1].day + (p.state === 'approaching' && p.days ? Math.min(p.days, TRENDS.horizonDays) : 0)
  const vals = [...p.points.map((x) => x.value), ...(p.band ? [p.band.value] : []), p.fit(d1)]
  const lo = Math.min(...vals), hi = Math.max(...vals), span = hi - lo || 1
  const x = (d: number) => 2 + ((d - d0) / (d1 - d0 || 1)) * (W - 4)
  const y = (v: number) => 3 + (1 - (v - lo) / span) * (H - 6)
  const last = p.points[p.points.length - 1].day
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="ew-spark" aria-hidden>
      {p.band && <line x1={0} x2={W} y1={y(p.band.value)} y2={y(p.band.value)} stroke={COLOR[p.band.level]} strokeDasharray="3 2" strokeWidth={1} />}
      <polyline points={p.points.map((q) => `${x(q.day).toFixed(1)},${y(q.value).toFixed(1)}`).join(' ')} fill="none" stroke="var(--text)" strokeWidth={1.2} />
      {p.state === 'approaching' && <line x1={x(last)} y1={y(p.fit(last))} x2={x(d1)} y2={y(p.fit(d1))} stroke={COLOR[p.level]} strokeWidth={1.4} strokeDasharray="2 2" />}
    </svg>
  )
}

export function EarlyWarning({ crewId }: { crewId: string }) {
  const sys = useSystem()
  const { proj, cards } = sys.earlyWarning(crewId)
  const list = Object.values(proj)
  const moving = list.filter((p) => p.state === 'beyond' || p.state === 'approaching').sort((a, b) => (a.level === 'red' ? -1 : 0) - (b.level === 'red' ? -1 : 0) || (a.days ?? 0) - (b.days ?? 0))
  const stable = list.filter((p) => p.state === 'stable')
  return (
    <div className="ew">
      <div className="ew-head">
        <span>Early warning</span>
        <InfoTip title="Early warning">
          <span>Shows where a value is heading if it keeps changing like in the last two weeks, and when it would reach a limit the panel already uses. It is not an alarm and not a diagnosis.</span>
          <ul>
            <li>A yellow box appears when several warning signs for the same problem show up together.</li>
            <li>Method: daily averages, Theil–Sen trend (one bad day does not change it). Hover a line for the day range.</li>
            <li>Sources: {Object.values(TRENDS.cards).map((c) => c.source).join(' · ')}.</li>
            <li className="muted">Sample data (SIM).</li>
          </ul>
        </InfoTip>
        <span className="tag">SIM</span>
      </div>
      {cards.map((c) => (
        <div key={c.id} className="ew-card">
          <b>{c.title}</b>
          <span className="ew-why">Why: {c.factors.filter((f) => f.on).map((f) => f.label).join(' · ')}</span>
          <span>{c.advice}</span>
        </div>
      ))}
      <ul className="ew-list">
        {moving.map((p) => (
          <li key={p.metricId} data-level={p.level} title={rangeText(p)}>
            <Spark p={p} />
            <span style={{ color: COLOR[p.level] }}>{trendSentence(p)}</span>
          </li>
        ))}
      </ul>
      {moving.length === 0 && <span className="ew-ok">All steady: nothing is heading to a limit in the next 3 weeks.</span>}
      {stable.length > 0 && moving.length > 0 && <span className="muted ew-stable">Steady: {stable.map((p) => meta(p.metricId).name).join(', ')}.</span>}
    </div>
  )
}
