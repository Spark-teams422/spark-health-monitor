// Body panel: 3D hologram + region detail / log. A region glows only in the status colour the shared layer gives it.
import { useState } from 'react'
import { worst } from '../core/statusEngine'
import { metricConfig, useSystem } from '../core/system'
import type { Level } from '../core/types'
import { kindTitle } from './EntryPanel'
import { Hologram, type HoloGroup, type Pick, type ViewCmd } from './Hologram'
import { Limits } from './Limits'
import { clock } from './NotificationList'
import { LEVEL_UI, Shape } from './StatusBadge'

const REGIONS = [
  { id: 'head', label: 'Head · mind', groups: ['brain'] as HoloGroup[], metrics: [] as string[] },
  { id: 'chest', label: 'Chest · heart, lungs', groups: ['heart', 'lungs'] as HoloGroup[], metrics: ['spo2', 'hrv'] },
  { id: 'arm', label: 'Circulation', groups: ['vessels'] as HoloGroup[], metrics: ['bp_systolic', 'bp_diastolic'] },
  { id: 'core', label: 'Core · temperature', groups: ['abdomen'] as HoloGroup[], metrics: ['body_temp'] },
]
const BY_GROUP: Partial<Record<HoloGroup, string>> = { brain: 'head', heart: 'chest', lungs: 'chest', vessels: 'arm', abdomen: 'core' }
// Skin and bone carry no metric: a click there picks the region by height (metres from body centre).
const regionAt = (p: Pick) => BY_GROUP[p.group] ?? (p.y > 0.62 ? 'head' : Math.abs(p.x) > 0.19 ? 'arm' : p.y > 0.25 ? 'chest' : 'core')
const VIEWS = [
  { id: 'front', label: 'Front' },
  { id: 'side', label: 'Side' },
  { id: 'back', label: 'Back' },
  { id: 'spin', label: 'Rotate' },
] as const

const summary = (data: Record<string, unknown>) =>
  Object.entries(data).filter(([k]) => k !== 'resolved').map(([, v]) => (Array.isArray(v) ? v.join(', ') : String(v))).filter(Boolean).join(' · ')

export function BodyPanel({ crewId }: { crewId: string }) {
  const sys = useSystem()
  const [sel, setSel] = useState('chest')
  const [view, setView] = useState<ViewCmd>({ id: 'front', n: 0 })
  const [free, setFree] = useState(false)
  const [tab, setTab] = useState<'region' | 'log'>('region')
  const symptoms = sys.recordsOf(crewId, 'symptom').filter((r) => !r.data.resolved)
  const level = (id: string): Level => {
    if (id === 'head') return symptoms.length ? 'yellow' : 'green'
    const st = worst(...REGIONS.find((r) => r.id === id)!.metrics.map((m) => sys.status(m, crewId)))
    return st.silent ? 'green' : st.level
  }
  const glow: Partial<Record<HoloGroup, Level>> = {}
  for (const r of REGIONS) for (const g of r.groups) glow[g] = level(r.id)
  const region = REGIONS.find((r) => r.id === sel)!
  const mental = sys.mental(crewId)
  const records = sys.recordsOf(crewId).slice().reverse()
  const ctx = sys.context(crewId)

  return (
    <div className="body-panel">
      <div className="holo-stage">
        <Hologram
          glow={glow}
          selected={region.groups}
          view={view}
          onPick={(p) => { setSel(regionAt(p)); setTab('region') }}
          onFree={() => setFree(true)}
          label={`Body model of ${crewId}, drag to rotate, scroll to zoom: ${REGIONS.map((r) => `${r.label} ${LEVEL_UI[level(r.id)].word}`).join(', ')}`}
        />
        <div className="holo-regions">
          {REGIONS.map((r) => (
            <button key={r.id} aria-pressed={sel === r.id} data-level={level(r.id)} onClick={() => { setSel(r.id); setTab('region') }}>
              <Shape level={level(r.id)} size={7} />{r.label.split(' · ')[0]}
            </button>
          ))}
        </div>
        <div className="seg holo-views" role="group" aria-label="Camera">
          {VIEWS.map((v) => <button key={v.id} aria-pressed={!free && view.id === v.id} onClick={() => { setFree(false); setView({ id: v.id, n: view.n + 1 }) }}>{v.label}</button>)}
        </div>
        <a className="holo-credit" href="https://github.com/ashemag/human-atlas" target="_blank" rel="noreferrer" title="Model: Human Atlas (MIT), meshes from BodyParts3D, © DBCLS, CC BY 4.0">Human Atlas · BodyParts3D · CC BY 4.0</a>
      </div>

      <div className="subtabs" role="tablist">
        <button role="tab" aria-selected={tab === 'region'} onClick={() => setTab('region')}>{region.label}</button>
        <button role="tab" aria-selected={tab === 'log'} onClick={() => setTab('log')}>Log · {records.length}</button>
      </div>

      {tab === 'region' ? (
        <div className="cards">
          {region.metrics.map((id) => {
            const m = sys.latest(id, crewId), cfg = metricConfig(id), st = sys.status(id, crewId)
            const lv = st.silent ? 'green' : st.level
            return (
              <div key={id} className="card" data-level={lv} title={st.level === 'green' ? cfg.explain : st.reason}>
                <span className="card-label">{cfg.label}</span>
                <span className="card-value num">{m ? m.value : '—'}<small>{cfg.unit}</small></span>
                <Limits metricId={id} ctx={ctx} />
              </div>
            )
          })}
          {sel === 'head' && (
            <>
              <div className="card">
                <span className="card-label">Mental check-in</span>
                <span className="card-value num">{mental ? mental.score : '—'}<small>/100</small></span>
                <span className="muted">{mental ? `${mental.band.label} · ${clock(mental.time)}` : 'No check-in'}</span>
              </div>
              <div className="card" data-level={symptoms.length ? 'yellow' : 'green'}>
                <span className="card-label">Open symptoms</span>
                <span className="card-value num">{symptoms.length}</span>
                <span className="muted clip">{symptoms.map((s) => `${s.data.symptom} ${s.data.severity}/10`).join(', ') || 'None'}</span>
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="log-list">
          {records.length === 0 && <span className="muted">No entries yet.</span>}
          {records.slice(0, 4).map((r) => (
            <div key={r.id} className="log-row">
              <span className="num muted">{clock(r.time)}</span>
              <b>{kindTitle(r.kind)}</b>
              <span className="clip">{summary(r.data)}</span>
              {r.kind === 'symptom' && (r.data.resolved ? <span className="muted">resolved</span> : <button onClick={() => sys.resolveSymptom(r.id)}>Resolve</button>)}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
