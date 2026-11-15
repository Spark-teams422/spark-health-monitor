// Cabin Radiation: the radiation planning layer along the route, three selectable demo cases (team document
// "Route Radiation Planning Layer"), turned into plain EVA advice with the EVA radiation risk index (ERI).
// FORECAST (sample model), LIVE (GOES solar protons) and MEASURED (dosimeter) stay apart; the forecast never raises an
// alarm. Logic in core/routeRadiation.ts; numbers in config/routeRadiation.json.
import { Pause, Play } from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { HoverChart, nearestPoint } from '../components/HoverChart'
import { InfoTip } from '../components/InfoTip'
import cfg from '../config/routeRadiation.json'
import mission from '../config/mission.json'
import land from '../data/land110.json'
import { goesMeta, radlabMeta, sepEvents } from '../core/realData'
import {
  cautionMGyDay, evaRisk, greenWindows, intervals, leoPeriodMin, leoPosition, leoRate, marsCumulative, moonBelt, moonDistance, moonRate,
  RISK, riskInfo, riskLevel, riskZones, routeRatio, saaCells, saaCentre, series, trackSegments, type RiskLevel, type RouteCase, type Sample,
} from '../core/routeRadiation'
import { thresholds } from '../core/statusEngine'
import { crew, useSystem } from '../core/system'

const H = 3600_000, DAY = 24 * H
const f = (x: number) => String(Number(x.toPrecision(3)))
const utc = (t: number) => `${new Date(t).toISOString().slice(5, 10).replace('-', '/')} ${new Date(t).toISOString().slice(11, 16)}`
const hm = (t: number) => new Date(t).toISOString().slice(11, 16)
const dur = (ms: number) => (ms >= H ? `${Math.floor(ms / H)} h ${String(Math.round((ms % H) / 60_000)).padStart(2, '0')} min` : `${Math.round(ms / 60_000)} min`)
const RISK_COLOR: Record<RiskLevel, string> = { green: 'var(--green)', yellow: 'var(--yellow)', orange: 'var(--orange)', red: 'var(--red)' }
const Tag = ({ kind }: { kind: 'FORECAST' | 'LIVE' | 'MEASURED' }) => <span className={`rr-tag rr-${kind.toLowerCase()}`}>{kind}</span>

function Info() {
  const L = thresholds.radiation.levels
  return (
    <InfoTip title="EVA radiation risk index (ERI)">
      <span>One number an astronaut can read: <b>ERI = the highest of three ratios</b>. 1.0 means a limit the project already uses is reached.</span>
      <ul>
        <li><b>Route:</b> {RISK.parts.route}</li>
        <li><b>Dose:</b> {RISK.parts.dose}</li>
        <li><b>Solar event:</b> {RISK.parts.sep}</li>
        <li>Bands (radiation document steps): below {L.caution} Normal · {L.caution}–{L.warning} Caution · {L.warning}–{L.critical} Warning · {L.critical} and above Critical.</li>
        <li><b>Limit {RISK.limit}:</b> {RISK.limitNote}</li>
        <li>FORECAST is a sample model (AE9/AP9, OLTARIS were not run), always a range; LIVE is NOAA GOES; MEASURED is the dosimeter and always wins.</li>
        <li className="muted">Team design (proposal), not a NASA standard. {RISK.authority}</li>
      </ul>
    </InfoTip>
  )
}

/** Plain-language box: the risk now, the radiation zones with "no EVA", the best window, per-crew ERI, the authority line. */
function Advice({ now, zones, best, rows, extra }: { now: { index: number; level: RiskLevel; what: string }; zones: { from: number; to: number; level: RiskLevel; label: string }[]; best: string; rows?: ReactNode; extra?: ReactNode }) {
  const info = riskInfo(now.level)
  return (
    <div className="rr-advice" data-level={now.level}>
      <div className="rr-advice-head">
        <span className="rr-eri" style={{ color: RISK_COLOR[now.level] }}><span className="num">{f(now.index)}</span><small>ERI now</small></span>
        <div>
          <b className="rr-advice-word" style={{ color: RISK_COLOR[now.level] }}>{info.word}</b> <span className="muted">· {now.what} · EVA limit {RISK.limit}</span>
          <p className="rr-advice-text">{info.advice}</p>
        </div>
      </div>
      {zones.length > 0 && (
        <ul className="rr-zones">
          {zones.slice(0, 4).map((z) => (
            <li key={z.from} data-level={z.level}>
              <b>{z.label}</b> <span style={{ color: RISK_COLOR[z.level] }}>{z.level === 'yellow' ? 'Caution: keep any EVA short.' : 'Do not start an EVA.'}</span>
            </li>
          ))}
          {zones.length > 4 && <li className="muted">+{zones.length - 4} more zones in this period</li>}
        </ul>
      )}
      <span className="rr-best">{best}</span>
      {extra}
      {rows}
      <span className="muted rr-authority">{RISK.authority}</span>
    </div>
  )
}

/** Per-crew ERI for a planned EVA (route + own dose ledger + live solar event). */
function CrewRisk({ s, from, sepActive, title }: { s: Sample[]; from: number; sepActive: boolean; title: string }) {
  const sys = useSystem()
  const evaCrew = mission.criticalTasks.find((t) => t.label === 'EVA')?.crewIds ?? []
  const list = [...crew].sort((a, b) => Number(evaCrew.includes(b.id)) - Number(evaCrew.includes(a.id)))
  return (
    <table className="rr-crew">
      <thead><tr><th>{title}</th><th>Route</th><th>Own dose</th><th>ERI</th><th>EVA</th></tr></thead>
      <tbody>
        {list.map((c) => {
          const r = evaRisk(s, from, cfg.requiredWindowH, { doseRatio: sys.radiation(c.id).worst.ratio, sepActive })
          const stop = r.index >= RISK.limit
          return (
            <tr key={c.id} data-level={r.level}>
              <td>{c.name} <span className="muted">{c.id}{evaCrew.includes(c.id) ? ' · EVA crew' : ''}</span></td>
              <td className="num">{r.route.toFixed(2)}</td>
              <td className="num">{r.dose.toFixed(2)}</td>
              <td className="num rr-eri-cell" style={{ color: RISK_COLOR[r.level] }}>{r.index.toFixed(2)}</td>
              <td style={{ color: RISK_COLOR[r.level] }}><b>{stop ? 'No EVA' : r.level === 'green' ? 'No objection' : 'Caution'}</b></td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

/** Log dose-rate chart: risk strip on top, forecast band, caution line in the right margin, zones shaded, "now" marker. */
function RateChart({ s, t0, t1, ticks, marker, label }: { s: Sample[]; t0: number; t1: number; ticks: { t: number; label: string }[]; marker?: number; label: string }) {
  const W = 640, CH = 200, PL = 52, PR = 92, TOP = 16, BOT = 24
  const lo = 0.1, hi = Math.max(10, ...s.map((p) => p.rate.hi)) * 1.2
  const x = (t: number) => PL + ((t - t0) / (t1 - t0)) * (W - PL - PR)
  const y = (v: number) => TOP + (1 - Math.log10(Math.max(lo, v) / lo) / Math.log10(hi / lo)) * (CH - TOP - BOT)
  const decades = [0.1, 1, 10, 100, 1000].filter((d) => d <= hi)
  const caution = cautionMGyDay()
  return (
    <HoverChart x0={PL} x1={W - PR} t0={t0} t1={t1} read={(t) => { const p = nearestPoint(s, t); if (!p) return null; const l = riskLevel(routeRatio(p.rate)); return { time: p.time, rows: [{ label: 'Forecast', value: `${f(p.rate.lo)}–${f(p.rate.hi)} mGy/day` }, { label: 'Route ratio', value: `${f(routeRatio(p.rate))} · ${riskInfo(l).word}`, color: RISK_COLOR[l] }] } }}>
      <svg viewBox={`0 0 ${W} ${CH}`} className="rr-chart" role="img" aria-label={label}>
        {s.map((p, i) => i < s.length - 1 && <rect key={p.time} x={x(p.time)} width={Math.max(0.5, x(s[i + 1].time) - x(p.time))} y={2} height={8} fill={RISK_COLOR[riskLevel(routeRatio(p.rate))]} />)}
        <rect x={PL} y={TOP} width={W - PL - PR} height={CH - TOP - BOT} fill="none" stroke="var(--line-2)" />
        {decades.map((d) => (
          <g key={d}>
            <line x1={PL} x2={W - PR} y1={y(d)} y2={y(d)} className="rr-grid" />
            <text x={PL - 6} y={y(d) + 4} textAnchor="end" className="chart-tick">{d}</text>
          </g>
        ))}
        {intervals(s, (p) => riskLevel(routeRatio(p.rate)) !== 'green').map((z) => <rect key={z.from} x={x(z.from)} width={Math.max(1, x(z.to) - x(z.from))} y={TOP} height={CH - TOP - BOT} fill="var(--orange)" opacity={0.14} />)}
        <polygon points={[...s.map((p) => `${x(p.time).toFixed(1)},${y(p.rate.hi).toFixed(1)}`), ...[...s].reverse().map((p) => `${x(p.time).toFixed(1)},${y(p.rate.lo).toFixed(1)}`)].join(' ')} fill="var(--text)" opacity={0.2} />
        <polyline points={s.map((p) => `${x(p.time).toFixed(1)},${y(p.rate.mid).toFixed(1)}`).join(' ')} fill="none" stroke="var(--text)" strokeWidth={1.4} />
        <line x1={PL} x2={W - PR} y1={y(caution)} y2={y(caution)} stroke="var(--yellow)" strokeWidth={1.2} strokeDasharray="5 3" />
        <text x={W - PR + 6} y={y(caution) + 4} className="chart-tick" fill="var(--yellow)">caution {caution}</text>
        <text x={W - PR + 6} y={TOP + 10} className="chart-tick">mGy/day</text>
        {marker !== undefined && marker >= t0 && marker <= t1 && <line x1={x(marker)} x2={x(marker)} y1={TOP} y2={CH - BOT} stroke="var(--real)" strokeWidth={2} />}
        {ticks.map((k, i) => <text key={k.t} x={x(k.t)} y={CH - 6} textAnchor={i === 0 ? 'start' : i === ticks.length - 1 ? 'end' : 'middle'} className="chart-tick">{k.label}</text>)}
      </svg>
    </HoverChart>
  )
}

// ---------------- LEO ----------------
function Leo() {
  const sys = useSystem()
  const now = sys.now, t0 = sys.simStart
  const s = useMemo(() => series(now, now + DAY, 60_000, (t) => { const p = leoPosition(t, t0); return leoRate(p.lat, p.lon, t) }), [now, t0])
  const pos = leoPosition(now, t0)
  const zones = riskZones(s)
  const best = greenWindows(s)
  const goes = sys.latest('goes_proton_flux', null)
  const sep = !!goes && goes.value >= cfg.mars.sepThresholdPfu
  const nowRisk = evaRisk(s, now, 0, { sepActive: sep })
  const measured = sys.latest('radiation_measured', null)
  const segs = trackSegments(s.slice(0, Math.round(leoPeriodMin() * 3)), t0)
  const cells = saaCells(now)
  const c = saaCentre(now)
  const thin = s.filter((_, i) => i % 5 === 0)
  const inZone = zones[0] && zones[0].from <= now
  return (
    <div className="rr-case">
      <Advice
        now={{ ...nowRisk, what: inZone ? 'spacecraft in the SAA now' : zones[0] ? `next radiation zone in ${dur(zones[0].from - now)}` : 'no zone in 24 h' }}
        zones={zones.map((z) => ({ ...z, label: `${utc(z.from)}–${hm(z.to)} UTC · the spacecraft passes the South Atlantic Anomaly (peak ERI ${f(z.peak)})` }))}
        best={best.length ? `Best EVA windows (at least ${cfg.requiredWindowH} h, all Normal): ${best.map((w) => `${utc(w.from)}–${hm(w.to)}`).join(', ')} UTC.` : `No ${cfg.requiredWindowH} h Normal window in the next 24 h.`}
      />
      <div className="rr-values">
        <span><Tag kind="FORECAST" /> now <b className="num">{f(s[0].rate.lo)}–{f(s[0].rate.hi)}</b> mGy/day</span>
        <span><Tag kind="MEASURED" /> <b className="num">{measured ? measured.value : '—'}</b> µGy/h <span className="muted">{radlabMeta.instrument}</span></span>
        <span><Tag kind="LIVE" /> solar event <b>{sep ? 'YES' : 'no'}</b> <span className="muted num">{goes ? `${goes.value} pfu` : ''}</span></span>
      </div>
      <svg viewBox="0 0 360 180" className="rr-map" role="img" aria-label="ISS-type ground track with the South Atlantic Anomaly">
        <rect width="360" height="180" className="rr-sea" />
        {[-60, -30, 0, 30, 60].map((la) => <line key={la} x1="0" x2="360" y1={90 - la} y2={90 - la} className="rr-grid" />)}
        {[-120, -60, 0, 60, 120].map((lo) => <line key={lo} y1="0" y2="180" x1={lo + 180} x2={lo + 180} className="rr-grid" />)}
        <path d={land.d} className="rr-land" />
        {cells.map((c2) => <rect key={`${c2.x},${c2.y}`} x={c2.x} y={c2.y} width={c2.size} height={c2.size} fill="var(--orange)" opacity={c2.o} />)}
        <text x={c.lon + 180} y={90 - c.lat + 24} textAnchor="middle" className="rr-map-label">SAA</text>
        {segs.map((sg, i) => sg.pts.length > 1 && <polyline key={i} points={sg.pts.join(' ')} className={`rr-track rr-track-${sg.cls}`} />)}
        <circle cx={pos.lon + 180} cy={90 - pos.lat} r="3.4" className="rr-craft" />
        <text x={Math.min(pos.lon + 185, 300)} y={90 - pos.lat - 5} className="rr-map-label">now {hm(now)}</text>
      </svg>
      <span className="muted note">Next 3 orbits ({leoPeriodMin().toFixed(1)} min each, {cfg.leo.altitudeKm} km, {cfg.leo.inclinationDeg}°; sample phase, not a TLE). Orange = forecast belt term above the background; the SAA drifts about {cfg.leo.saa.driftWestDegPerYear}°/year west.</span>
      <span className="rr-caption">Forecast dose rate, next 24 h · top strip = route risk (green Normal · yellow Caution · orange Warning · red Critical)</span>
      <RateChart s={thin} t0={now} t1={now + DAY} label="Forecast dose rate, next 24 h" ticks={[0, 6, 12, 18, 24].map((h) => ({ t: now + h * H, label: h ? `+${h} h` : `now ${hm(now)}` }))} />
    </div>
  )
}

// ---------------- Moon ----------------
function Moon() {
  const sys = useSystem()
  const launch = Math.floor(sys.now / H) * H // demo: as if launched at the current hour
  const total = cfg.moon.durationDays * 24
  const [h, setH] = useState(0)
  const [play, setPlay] = useState(true)
  const [zoom, setZoom] = useState(true)
  const [shield, setShield] = useState<'mostShielded' | 'leastShielded'>('leastShielded')
  const [attitude, setAttitude] = useState(false)
  const span = zoom ? 3 : total
  useEffect(() => {
    if (!play) return
    const id = setInterval(() => setH((x) => (x + span / 300) % span), 100)
    return () => clearInterval(id)
  }, [play, span])
  const opts = { shield, attitude }
  const fine = useMemo(() => series(launch, launch + total * H, 60_000, (t) => moonRate((t - launch) / H, { shield, attitude })), [launch, total, shield, attitude])
  const s = useMemo(() => (zoom ? fine.filter((p) => p.time <= launch + 3 * H) : fine.filter((_, i) => i % 60 === 0)), [zoom, fine, launch])
  const cur = moonRate(h, opts), belt = moonBelt(h), dist = moonDistance(h)
  const cum = fine.filter((p) => p.time < launch + h * H).reduce((a, p) => a + p.rate.mid / 1440, 0)
  const zones = riskZones(fine)
  const outer = intervals(fine, (p) => moonBelt((p.time - launch) / H) === 'outer')
  const nowRisk = evaRisk(fine, launch + h * H, 0)
  const dx = (km: number) => 40 + (Math.log10(km / 6371) / Math.log10(cfg.moon.moonDistanceKm / 6371)) * 540
  const ticks = zoom ? [0, 1, 2, 3].map((x) => ({ t: launch + x * H, label: `T+${x} h` })) : [0, 5, 10, 15, 20, 25].map((d) => ({ t: launch + d * DAY, label: `day ${d}` }))
  const midBelt = (k: number[]) => (dx(6371 + k[0]) + dx(6371 + k[1])) / 2
  return (
    <div className="rr-case">
      <Advice
        now={{ ...nowRisk, what: belt === 'inner' ? 'in the inner radiation belt' : belt === 'outer' ? 'in the outer belt (no dose number)' : 'outside the belts' }}
        zones={zones.map((z) => ({ ...z, label: `${utc(z.from)}–${hm(z.to)} UTC · the spacecraft crosses the inner Van Allen belt (peak ERI ${f(z.peak)})` }))}
        best={`Outer-belt crossings ${outer.map((o) => `${utc(o.from)}–${hm(o.to)}`).join(' and ')} UTC: the source gives no dose number, ask the radiation officer before any EVA. The rest of the transit is GCR only (route ratio ${f(routeRatio(moonRate(48, opts)))}, Normal).`}
        extra={<span className="muted">Times as if launched now ({utc(launch)} UTC). Reference: {shield === 'leastShielded' ? 'least shielded place' : 'most shielded place'}{attitude ? ', attitude changed in the belt' : ''}.</span>}
      />
      <div className="rr-controls">
        <button onClick={() => setPlay(!play)}>{play ? <Pause size={16} /> : <Play size={16} />} {play ? 'Pause' : 'Play'}</button>
        <input type="range" min={0} max={span} step={span / 300} value={Math.min(h, span)} onChange={(e) => { setPlay(false); setH(Number(e.target.value)) }} aria-label="Mission elapsed time" />
        <div className="seg" role="group" aria-label="Time span">
          <button aria-pressed={zoom} onClick={() => { setZoom(true); setH(0) }}>First 3 h</button>
          <button aria-pressed={!zoom} onClick={() => { setZoom(false); setH(0) }}>Whole mission</button>
        </div>
        <div className="seg" role="group" aria-label="Reference shield">
          <button aria-pressed={shield === 'leastShielded'} onClick={() => setShield('leastShielded')}>Least shielded</button>
          <button aria-pressed={shield === 'mostShielded'} onClick={() => setShield('mostShielded')}>Most shielded</button>
        </div>
        <button aria-pressed={attitude} onClick={() => setAttitude(!attitude)}>Attitude change</button>
      </div>
      <div className="rr-values">
        <span>T+ <b className="num">{h < 48 ? `${h.toFixed(2)} h` : `${(h / 24).toFixed(1)} d`}</b> · altitude <b className="num">{Math.round(dist - 6371).toLocaleString('en')}</b> km</span>
        <span><Tag kind="FORECAST" /> <b className="num">{f(cur.lo)}–{f(cur.hi)}</b> mGy/day</span>
        <span>Cumulative <b className="num">{f(cum)}</b> mGy</span>
      </div>
      <svg viewBox="0 0 640 86" className="rr-route" role="img" aria-label="Earth to Moon, belts shaded (log distance)">
        <rect x={dx(6371 + cfg.moon.innerBeltKm[0])} width={dx(6371 + cfg.moon.innerBeltKm[1]) - dx(6371 + cfg.moon.innerBeltKm[0])} y="22" height="36" fill="var(--orange)" opacity="0.35" />
        <rect x={dx(6371 + cfg.moon.outerBeltKm[0])} width={dx(6371 + cfg.moon.outerBeltKm[1]) - dx(6371 + cfg.moon.outerBeltKm[0])} y="22" height="36" fill="var(--real)" opacity="0.2" />
        <text x={midBelt(cfg.moon.innerBeltKm)} y="14" textAnchor="middle" className="chart-tick">inner belt</text>
        <text x={midBelt(cfg.moon.outerBeltKm)} y="14" textAnchor="middle" className="chart-tick">outer belt</text>
        <line x1="40" x2="580" y1="40" y2="40" className="rr-grid" />
        <circle cx="24" cy="40" r="14" className="rr-earth" />
        <circle cx="604" cy="40" r="7" className="rr-moon" />
        <text x="24" y="80" textAnchor="middle" className="chart-tick">Earth</text>
        <text x="604" y="80" textAnchor="middle" className="chart-tick">Moon</text>
        <circle cx={dx(Math.max(6371 * 1.001, dist))} cy="40" r="6" className="rr-craft" />
      </svg>
      <span className="rr-caption">Forecast dose rate along the transit, {zoom ? 'first 3 hours' : `${cfg.moon.durationDays} days`} · top strip = route risk</span>
      <RateChart s={s} t0={launch} t1={launch + span * H} ticks={ticks} marker={launch + h * H} label="Forecast dose rate along the lunar transit" />
      <span className="muted note">DEMO replay of an Artemis I type flight (trajectory profile is a sample). Inner-belt peak {cfg.moon.innerPeakUGyMin.mostShielded} µGy/min most shielded vs {cfg.moon.innerPeakUGyMin.leastShielded} least shielded (George et al. 2024); attitude change −50 % (NASA); GCR {thresholds.radiation.normalRateMSvDay} mSv/day (radiation document), one third lower near the Moon.</span>
    </div>
  )
}

// ---------------- Mars ----------------
function Mars() {
  const sys = useSystem()
  const start = Date.parse(mission.startDate), end = Date.parse(mission.endDate)
  const days = (end - start) / DAY, today = (sys.now - start) / DAY
  const goes = sys.history('goes_proton_flux', null)
  const g = goes.at(-1)
  const sep = !!g && g.value >= cfg.mars.sepThresholdPfu
  const evaTask = mission.criticalTasks.find((t) => t.label === 'EVA')
  const evaAt = evaTask ? start + (evaTask.day - 1) * DAY + evaTask.hour * H : sys.now
  const s = useMemo(() => series(sys.now, sys.now + 2 * DAY, H, () => { const r = marsCumulative(1); return { lo: r.lo, mid: r.mid, hi: r.hi, belt: 0, gcr: r.mid } }), [sys.now])
  const nowRisk = evaRisk(s, sys.now, 0, { sepActive: sep })
  const meas = sys.latest('radiation_cumulative', null)
  const fc = marsCumulative(today)
  const W = 640, CH = 200, PL = 52, PR = 92, TOP = 18, BOT = 24
  const top = Math.ceil(marsCumulative(days).hi / 20) * 20
  const x = (d: number) => PL + (d / days) * (W - PL - PR)
  const y = (v: number) => TOP + (1 - v / top) * (CH - TOP - BOT)
  const pts = Array.from({ length: 61 }, (_, i) => (i / 60) * days)
  const months = Array.from({ length: 8 }, (_, i) => Date.UTC(new Date(start).getUTCFullYear(), new Date(start).getUTCMonth() + i + 1, 1)).filter((t) => t < end)
  const sH = 96, sTop = 8, sBot = 20
  const gx = (t: number) => PL + ((t - (sys.now - DAY)) / DAY) * (W - PL - PR)
  const lg = (v: number) => sTop + (1 - Math.log10(Math.max(0.1, v) / 0.1) / 4) * (sH - sTop - sBot)
  const seps = sepEvents(sys.simStart).filter((e) => e.time > sys.now - DAY && e.time <= sys.now)
  return (
    <div className="rr-case">
      <Advice
        now={{ ...nowRisk, what: sep ? 'solar particle event running' : 'cruise in galactic cosmic rays' }}
        zones={sep ? [{ from: sys.now, to: sys.now, level: 'red', label: `Now · a solar particle event is running (GOES ${g!.value} pfu, event at ${cfg.mars.sepThresholdPfu})` }] : []}
        best={`No radiation zone on this route: the forecast stays at the cosmic-ray level (route ratio ${f(routeRatio(s[0].rate))}). Only a solar particle event (LIVE strip below) or a person's own dose can stop an EVA.`}
        rows={<CrewRisk s={s} from={Math.max(sys.now, Math.min(evaAt, sys.now + DAY))} sepActive={sep} title={evaTask ? `EVA day ${evaTask.day}, ${String(evaTask.hour).padStart(2, '0')}:00 UTC` : 'EVA now'} />}
      />
      <div className="rr-values">
        <span>Mission day <b className="num">{Math.floor(today) + 1}</b> / {Math.round(days)}</span>
        <span><Tag kind="FORECAST" /> cumulative <b className="num">{fc.lo.toFixed(0)}–{fc.hi.toFixed(0)}</b> mSv</span>
        <span><Tag kind="MEASURED" /> cabin monitor <b className="num">{meas ? meas.value : '—'}</b> mSv <span className="tag">SIM</span></span>
        {meas && (meas.value < fc.lo || meas.value > fc.hi) && <span className="rr-diff">Measured is {meas.value > fc.hi ? 'above' : 'below'} the forecast band: the measurement counts.</span>}
      </div>
      <span className="rr-caption">Cumulative dose over the transit, mSv · band = cosmic rays ± {cfg.mars.uncertainty * 100} % · dot = measured</span>
      <HoverChart x0={PL} x1={W - PR} t0={0} t1={days} read={(d) => { const c = marsCumulative(Math.max(0, Math.min(days, d))); return { time: start + d * DAY, pos: d, rows: [{ label: 'Forecast cumulative', value: `${c.lo.toFixed(0)}–${c.hi.toFixed(0)} mSv` }] } }}>
        <svg viewBox={`0 0 ${W} ${CH}`} className="rr-chart" role="img" aria-label="Cumulative dose band along the Mars transit">
          <rect x={PL} y={TOP} width={W - PL - PR} height={CH - TOP - BOT} fill="none" stroke="var(--line-2)" />
          {[0, top / 2, top].map((v) => (
            <g key={v}>
              <line x1={PL} x2={W - PR} y1={y(v)} y2={y(v)} className="rr-grid" />
              <text x={PL - 6} y={y(v) + 4} textAnchor="end" className="chart-tick">{v}</text>
            </g>
          ))}
          <polygon points={[...pts.map((d) => `${x(d).toFixed(1)},${y(marsCumulative(d).hi).toFixed(1)}`), ...[...pts].reverse().map((d) => `${x(d).toFixed(1)},${y(marsCumulative(d).lo).toFixed(1)}`)].join(' ')} fill="var(--text)" opacity={0.2} />
          <polyline points={pts.map((d) => `${x(d).toFixed(1)},${y(marsCumulative(d).mid).toFixed(1)}`).join(' ')} fill="none" stroke="var(--text)" strokeWidth={1.4} strokeDasharray="6 3" />
          <line x1={x(today)} x2={x(today)} y1={TOP} y2={CH - BOT} stroke="var(--real)" strokeWidth={2} />
          {meas && <circle cx={x(today)} cy={y(meas.value)} r={5} fill="var(--green)" stroke="#fff" />}
          <text x={x(today)} y={TOP - 5} textAnchor="middle" className="chart-tick" fill="var(--real)">today</text>
          <text x={W - PR + 6} y={y(marsCumulative(days).mid) + 4} className="chart-tick">{marsCumulative(days).mid.toFixed(0)} mSv</text>
          <text x={W - PR + 6} y={y(marsCumulative(days).mid) + 18} className="chart-tick">at landing</text>
          {months.map((t) => <text key={t} x={x((t - start) / DAY)} y={CH - 6} textAnchor="middle" className="chart-tick">{new Date(t).toLocaleString('en-GB', { month: 'short', timeZone: 'UTC' })}</text>)}
        </svg>
      </HoverChart>
      <span className="rr-caption"><Tag kind="LIVE" /> Solar protons ≥10 MeV, last 24 h (NOAA GOES replay, {goesMeta.retrieved}) · above the red line = solar particle event</span>
      <HoverChart x0={PL} x1={W - PR} t0={sys.now - DAY} t1={sys.now} read={(t) => { const p = nearestPoint(goes, t); return p && { time: p.time, rows: [{ label: 'Protons ≥10 MeV', value: `${p.value} pfu` }] } }}>
        <svg viewBox={`0 0 ${W} ${sH}`} className="rr-chart" role="img" aria-label="Live solar proton strip, last 24 h">
          <rect x={PL} y={sTop} width={W - PL - PR} height={lg(cfg.mars.sepThresholdPfu) - sTop} fill="var(--red)" opacity={0.12} />
          {[0.1, 1, 10, 100, 1000].map((d) => <text key={d} x={PL - 6} y={lg(d) + 4} textAnchor="end" className="chart-tick">{d}</text>)}
          <line x1={PL} x2={W - PR} y1={lg(cfg.mars.sepThresholdPfu)} y2={lg(cfg.mars.sepThresholdPfu)} stroke="var(--red)" strokeDasharray="5 3" />
          <text x={W - PR + 6} y={lg(cfg.mars.sepThresholdPfu) + 4} className="chart-tick" fill="var(--red)">{cfg.mars.sepThresholdPfu} pfu</text>
          <polyline points={goes.filter((p) => p.time > sys.now - DAY).map((p) => `${gx(p.time).toFixed(1)},${lg(p.value).toFixed(1)}`).join(' ')} fill="none" stroke="var(--real)" strokeWidth={1.4} />
          {seps.map((e) => <line key={e.time} x1={gx(e.time)} x2={gx(e.time)} y1={sTop} y2={sH - sBot} stroke="var(--yellow)" strokeDasharray="2 2" />)}
          <text x={PL} y={sH - 4} className="chart-tick">−24 h</text>
          <text x={W - PR} y={sH - 4} textAnchor="end" className="chart-tick">now {hm(sys.now)}</text>
        </svg>
      </HoverChart>
    </div>
  )
}

export function CabinRadiation() {
  const [c, setC] = useState<RouteCase>('mars')
  const label = (k: RouteCase) => (k === 'mars' ? `${cfg.mars.label} · this mission` : cfg[k].label)
  return (
    <div className="rr">
      <div className="rr-head">
        <div className="seg" role="group" aria-label="Route case (demo)">
          {(['leo', 'moon', 'mars'] as const).map((k) => <button key={k} aria-pressed={c === k} onClick={() => setC(k)}>{label(k)}</button>)}
        </div>
        <span className="tag">DEMO</span>
        <Info />
      </div>
      {c === 'leo' && <Leo />}
      {c === 'moon' && <Moon />}
      {c === 'mars' && <Mars />}
    </div>
  )
}
