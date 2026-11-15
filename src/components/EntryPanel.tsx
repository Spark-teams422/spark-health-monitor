// Personal entries (Step 4a), compact: pick a type by icon, fill the form, see the last entries.
// Every entry goes to the shared record store with crew member + mission time.
import { CalendarDays, Gauge, Pill, Scale, Smile, Stethoscope, Utensils, Droplet, type LucideIcon } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import forms from '../config/forms.json'
import mental from '../config/mental.json'
import { mentalBand, useSystem } from '../core/system'
import type { LogRecord, RecordKind } from '../core/types'
import { clock } from './NotificationList'

type Field = { name: string; label: string; type: string; options?: string[]; unit?: string; min?: number; max?: number; step?: number | string; optional?: boolean }
const FORMS = forms as unknown as Record<string, { title: string; fields: Field[] }>
const KINDS: { kind: RecordKind; title: string; icon: LucideIcon }[] = [
  { kind: 'mental', title: 'Mental', icon: Smile },
  { kind: 'symptom', title: FORMS.symptom.title, icon: Stethoscope },
  { kind: 'water', title: FORMS.water.title, icon: Droplet },
  { kind: 'meal', title: FORMS.meal.title, icon: Utensils },
  { kind: 'medication', title: FORMS.medication.title, icon: Pill },
  { kind: 'mass', title: FORMS.mass.title, icon: Scale },
  { kind: 'menstrual', title: FORMS.menstrual.title, icon: CalendarDays },
  { kind: 'value', title: FORMS.value.title, icon: Gauge },
]
export const kindTitle = (k: RecordKind) => KINDS.find((x) => x.kind === k)?.title ?? (k === 'checkin' ? 'Check-in' : k)

function Chips({ options, selected, onChange }: { options: string[]; selected: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="chips">
      {options.map((o) => (
        <button type="button" key={o} aria-pressed={selected.includes(o)} onClick={() => onChange(selected.includes(o) ? selected.filter((x) => x !== o) : [...selected, o])}>
          {o}
        </button>
      ))}
    </div>
  )
}

/** Guided breathing: inhale / hold / exhale, timings from mental.json. */
function Breathing({ onDone }: { onDone: () => void }) {
  const { inhaleS, holdS, exhaleS, totalS } = mental.breathing
  const [t, setT] = useState(0)
  useEffect(() => {
    const timer = setInterval(() => setT((x) => x + 1), 1000)
    return () => clearInterval(timer)
  }, [])
  useEffect(() => {
    if (t >= totalS) onDone()
  }, [t, totalS, onDone])
  const p = t % (inhaleS + holdS + exhaleS)
  const phase = p < inhaleS ? 'in' : p < inhaleS + holdS ? 'hold' : 'out'
  return (
    <div className="breath">
      <div className="breath-ring" data-phase={phase} style={{ transitionDuration: `${phase === 'in' ? inhaleS : exhaleS}s` }} />
      <b aria-live="polite">{{ in: 'Breathe in', hold: 'Hold', out: 'Breathe out' }[phase]}</b>
      <span className="muted">{totalS - t} s</span>
      <button type="button" onClick={onDone}>Stop</button>
    </div>
  )
}

function MentalForm({ onSave }: { onSave: (data: LogRecord['data']) => void }) {
  const [score, setScore] = useState(20)
  const [emotions, setEmotions] = useState<string[]>([])
  const [triggers, setTriggers] = useState<string[]>([])
  const [breathing, setBreathing] = useState(false)
  const band = mentalBand(score)
  if (breathing) return <Breathing onDone={() => setBreathing(false)} />
  return (
    <form
      className="entry-form"
      onSubmit={(e) => {
        e.preventDefault()
        onSave({ score, state_label: band.label, emotions, triggers })
        setEmotions([])
        setTriggers([])
      }}
    >
      <label className="field wide">
        <span className="field-label">Stress level <b className="num">{score}</b> · {band.label}</span>
        <input type="range" min={1} max={100} value={score} onChange={(e) => setScore(Number(e.target.value))} aria-label="Stress level, 1 calm to 100 very stressed" />
      </label>
      <span className="field-label wide">Feeling</span>
      <Chips options={mental.emotions} selected={emotions} onChange={setEmotions} />
      <span className="field-label wide">Trigger</span>
      <Chips options={mental.triggers} selected={triggers} onChange={setTriggers} />
      <div className="form-actions wide">
        <button type="submit" className="primary">Save</button>
        <button type="button" onClick={() => setBreathing(true)}>Breathing, 1 min</button>
      </div>
    </form>
  )
}

function RecordForm({ kind, onSave }: { kind: string; onSave: (data: LogRecord['data']) => void }) {
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const data: LogRecord['data'] = {}
    for (const f of FORMS[kind].fields) {
      const v = String(fd.get(f.name) ?? '').trim()
      if (v !== '') data[f.name] = f.type === 'number' ? Number(v) : v
    }
    onSave(data)
    e.currentTarget.reset()
  }
  return (
    <form className="entry-form" onSubmit={submit} key={kind}>
      {FORMS[kind].fields.map((f) => (
        <label key={f.name} className={`field ${f.type === 'text' ? 'wide' : ''}`}>
          <span className="field-label">{f.label}{f.unit ? ` (${f.unit})` : ''}{f.optional ? ' · opt.' : ''}</span>
          {f.type === 'select' ? (
            <select name={f.name} required>{f.options!.map((o) => <option key={o}>{o}</option>)}</select>
          ) : (
            <input name={f.name} type={f.type} min={f.min} max={f.max} step={f.step} required={!f.optional} />
          )}
        </label>
      ))}
      <div className="form-actions wide">
        <button type="submit" className="primary">Save</button>
        {kind === 'symptom' && <span className="muted">An open symptom skips the repeat reading for critical values.</span>}
      </div>
    </form>
  )
}

export function EntryPanel({ crewId }: { crewId: string }) {
  const sys = useSystem()
  const [kind, setKind] = useState<RecordKind>('mental')
  const [saved, setSaved] = useState('')
  const save = (data: LogRecord['data']) => {
    const rec = sys.addRecord(kind, crewId, data)
    setSaved(`${kindTitle(kind)} saved ${clock(rec.time)}`)
  }
  return (
    <section className="panel entry" aria-label="Add entry">
      <div className="panel-head">
        <h2>Add entry</h2>
        {saved && <span className="badge" data-level="green" role="status">{saved}</span>}
      </div>
      <div className="kind-bar" role="tablist" aria-label="Entry type">
        {KINDS.map(({ kind: k, title, icon: Icon }) => (
          <button key={k} role="tab" aria-selected={kind === k} title={title} aria-label={title} onClick={() => { setKind(k); setSaved('') }}>
            <Icon size={16} strokeWidth={1.75} />
            <span>{title}</span>
          </button>
        ))}
      </div>
      <div className="entry-title">{kindTitle(kind)}</div>
      {kind === 'mental' ? <MentalForm onSave={save} /> : <RecordForm kind={kind} onSave={save} />}
    </section>
  )
}
