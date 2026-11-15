// Daily check-in: one question per screen. Morning = sleep diary, evening = symptom diary; both start with the
// non-urgent health issue question (with a free-text log) and end with the mental check-in. The level comes from core/checkin.ts, never from here.
import { ClipboardCheck, Flame } from 'lucide-react'
import { useRef, useState } from 'react'
import cfg from '../config/checkin.json'
import mental from '../config/mental.json'
import { type CheckinResult, type Complaint } from '../core/checkin'
import { mentalBand, useSystem } from '../core/system'
import type { LogRecord } from '../core/types'
import { Emergency } from './Emergency'
import { LEVEL_UI, Shape } from './StatusBadge'

type Part = 'morning' | 'evening'
type Step = { id: string; label: string; topic?: number }

function Toggle({ options, selected, onChange }: { options: string[]; selected: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="chips">
      {options.map((o) => (
        <button type="button" key={o} aria-pressed={selected.includes(o)} onClick={() => onChange(selected.includes(o) ? selected.filter((x) => x !== o) : [...selected, o])}>{o}</button>
      ))}
    </div>
  )
}

function Flow({ crewId, onClose }: { crewId: string; onClose: () => void }) {
  const sys = useSystem()
  const hour = new Date(sys.now).getUTCHours()
  const [part, setPart] = useState<Part>(hour < cfg.morningUntilHour ? 'morning' : 'evening')
  const [i, setI] = useState(0)
  const [hasIssue, setHasIssue] = useState(false)
  const [issue, setIssue] = useState('')
  const [sleep, setSleep] = useState({ bedtime: '22:30', wakeups: 0, rested: true, pattern: [] as string[] })
  const [topics, setTopics] = useState<string[]>([])
  const [complaints, setComplaints] = useState<Record<string, Complaint>>({})
  const [score, setScore] = useState<number | null>(null)
  const [emotions, setEmotions] = useState<string[]>([])
  const [triggers, setTriggers] = useState<string[]>([])
  const [result, setResult] = useState<CheckinResult | null>(null)

  const steps: Step[] = [
    { id: 'issue', label: 'Health issue' },
    ...(hasIssue ? [{ id: 'issueText', label: 'Health issue' }] : []),
    ...(part === 'morning'
      ? [{ id: 'bedtime', label: 'Sleep diary' }, { id: 'wakeups', label: 'Sleep diary' }, { id: 'rested', label: 'Sleep diary' }, ...(!sleep.rested ? [{ id: 'pattern', label: 'Sleep diary' }] : [])]
      : [{ id: 'topics', label: 'Symptom diary' }, ...topics.map((_, t) => ({ id: 'complaint', label: 'Symptom diary', topic: t }))]),
    { id: 'mental', label: 'State of mind' },
    { id: 'result', label: 'Result' },
  ]
  const step = steps[Math.min(i, steps.length - 1)]
  const next = () => setI((x) => x + 1)
  const c = (t: string): Complaint => complaints[t] ?? { topic: t, severity: 3, started: cfg.complaint.startedOptions[0] }
  const setC = (t: string, patch: Partial<Complaint>) => setComplaints({ ...complaints, [t]: { ...c(t), ...patch } })

  const finish = (mood: number | null) => {
    if (mood !== null) sys.addRecord('mental', crewId, { score: mood, state_label: mentalBand(mood).label, emotions, triggers })
    const extra: LogRecord['data'] = {
      ...(part === 'morning' ? { bedtime: sleep.bedtime, wakeups: sleep.wakeups, rested: sleep.rested, sleepPattern: sleep.pattern } : {}),
      ...(hasIssue && issue.trim() ? { issue: issue.trim() } : {}),
    }
    setResult(sys.addCheckin(crewId, part, [], part === 'evening' ? topics.map(c) : [], extra))
    next()
  }

  const yesNo = (yes: () => void, no: () => void) => (
    <div className="ci-answers">
      <button onClick={yes}>Yes</button>
      <button onClick={no}>No</button>
    </div>
  )
  const band = mentalBand(score ?? 20)

  return (
    <div className="checkin">
      <div className="ci-head">
        <h2>Daily check-in · {crewId}</h2>
        <div className="seg" role="group" aria-label="Diary">
          {(['morning', 'evening'] as Part[]).map((p) => (
            <button key={p} aria-pressed={part === p} disabled={i > 0} onClick={() => setPart(p)}>{p === 'morning' ? 'Morning · sleep' : 'Evening · symptoms'}</button>
          ))}
        </div>
        <button className="ghost" onClick={onClose}>Close</button>
      </div>
      <div className="ci-progress" aria-hidden><span style={{ width: `${((i + 1) / steps.length) * 100}%` }} /></div>

      <div className="ci-card" data-level={result?.level}>
        <span className="ci-label">{step.label}</span>

        {step.id === 'issue' && (
          <>
            <h3>Do you have a health problem that does not need urgent care?</h3>
            <span className="muted">If it is urgent, do not wait: use EMERGENCY.</span>
            {yesNo(() => { setHasIssue(true); next() }, () => { setHasIssue(false); setIssue(''); next() })}
            <div className="ci-answers"><Emergency crewId={crewId} /></div>
          </>
        )}
        {step.id === 'issueText' && (
          <>
            <h3>Describe the problem</h3>
            <span className="muted">What, where, since when. It is saved in your health issue history.</span>
            <textarea className="ci-input ci-text" rows={5} value={issue} onChange={(e) => setIssue(e.target.value)} autoFocus />
            <button className="primary ci-next" disabled={!issue.trim()} onClick={next}>Continue</button>
          </>
        )}

        {step.id === 'bedtime' && (
          <>
            <h3>{cfg.sleep.bedtime}</h3>
            <input className="ci-input" type="time" value={sleep.bedtime} onChange={(e) => setSleep({ ...sleep, bedtime: e.target.value })} />
            <button className="primary ci-next" onClick={next}>Continue</button>
          </>
        )}
        {step.id === 'wakeups' && (
          <>
            <h3>{cfg.sleep.wakeups}</h3>
            <div className="stepper">
              <button onClick={() => setSleep({ ...sleep, wakeups: Math.max(0, sleep.wakeups - 1) })} aria-label="Less">−</button>
              <span className="num">{sleep.wakeups}</span>
              <button onClick={() => setSleep({ ...sleep, wakeups: sleep.wakeups + 1 })} aria-label="More">+</button>
            </div>
            <button className="primary ci-next" onClick={next}>Continue</button>
          </>
        )}
        {step.id === 'rested' && (
          <>
            <h3>{cfg.sleep.rested}</h3>
            {yesNo(() => { setSleep({ ...sleep, rested: true, pattern: [] }); next() }, () => { setSleep({ ...sleep, rested: false }); next() })}
          </>
        )}
        {step.id === 'pattern' && (
          <>
            <h3>{cfg.sleep.pattern}</h3>
            <Toggle options={cfg.sleep.patternOptions} selected={sleep.pattern} onChange={(pattern) => setSleep({ ...sleep, pattern })} />
            <button className="primary ci-next" onClick={next}>Continue</button>
          </>
        )}

        {step.id === 'topics' && (
          <>
            <h3>Did you notice anything today?</h3>
            <span className="muted">Mark every topic with a complaint. You will rate each one next.</span>
            {(() => {
              // sex rule 2 (baseline / sex document): urinary symptoms asked first for women
              const first = sys.sexRules(crewId).flatMap((r) => r.topics ?? [])
              return (
                <>
                  {first.length > 0 && <span className="hint">Asked first for you: {first.join(', ')} (burning or frequent urination is more common in women in flight).</span>}
                  <Toggle options={[...first, ...cfg.topics.filter((t) => !first.includes(t))]} selected={topics} onChange={setTopics} />
                </>
              )
            })()}
            <button className="primary ci-next" onClick={next}>{topics.length ? `Continue · ${topics.length}` : 'Nothing to report'}</button>
          </>
        )}
        {step.id === 'complaint' && step.topic !== undefined && (() => {
          const t = topics[step.topic], v = c(t)
          return (
            <>
              <h3>{t}</h3>
              <label className="field">
                <span className="field-label">{cfg.complaint.severity} · <b className="num">{v.severity}</b></span>
                <input type="range" min={0} max={10} value={v.severity} onChange={(e) => setC(t, { severity: Number(e.target.value) })} />
              </label>
              <div className="ci-grid">
                <label className="field"><span className="field-label">{cfg.complaint.where}</span><input value={v.where ?? ''} onChange={(e) => setC(t, { where: e.target.value })} /></label>
                <label className="field"><span className="field-label">{cfg.complaint.started}</span>
                  <select value={v.started} onChange={(e) => setC(t, { started: e.target.value })}>{cfg.complaint.startedOptions.map((o) => <option key={o}>{o}</option>)}</select>
                </label>
                <label className="field wide"><span className="field-label">{cfg.complaint.helped}</span><input value={v.helped ?? ''} onChange={(e) => setC(t, { helped: e.target.value })} /></label>
              </div>
              <button className="primary ci-next" onClick={next}>Continue</button>
            </>
          )
        })()}

        {step.id === 'mental' && (
          <>
            <h3>How do you feel right now?</h3>
            <div className="ci-mood">
              <div className="mood-orb" style={{ background: `radial-gradient(circle at 35% 30%, #ffffff55, ${band.color} 55%, transparent 72%)`, animationDuration: `${7 - (score ?? 20) / 20}s` }} />
              <div className="stack">
                <span className="field-label">1 calm · 100 very stressed · <b className="num">{score ?? '—'}</b> {score !== null && band.label}</span>
                <input type="range" min={1} max={100} value={score ?? 20} onChange={(e) => setScore(Number(e.target.value))} aria-label="Stress level" />
              </div>
            </div>
            <span className="field-label">Feeling</span>
            <Toggle options={mental.emotions} selected={emotions} onChange={setEmotions} />
            <span className="field-label">Trigger</span>
            <Toggle options={mental.triggers} selected={triggers} onChange={setTriggers} />
            <div className="ci-answers">
              <button className="primary" onClick={() => finish(score ?? 20)}>Save check-in</button>
              <button onClick={() => finish(null)}>Skip mood · save</button>
            </div>
          </>
        )}

        {step.id === 'result' && result && (
          <>
            <h3 className="ci-result" data-level={result.level}><Shape level={result.level} size={16} /> {LEVEL_UI[result.level].word}</h3>
            {result.reasons.length > 0 && <ul className="ci-list">{result.reasons.map((r) => <li key={r}>{r}</li>)}</ul>}
            <p>{cfg.actions[result.level]}</p>
            <div className="ci-answers">
              {result.level === 'red' && <Emergency crewId={crewId} />}
              <button className="primary" onClick={onClose}>Done</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

/** Header button: opens the check-in and shows the day streak. */
export function CheckInButton({ crewId }: { crewId: string }) {
  const sys = useSystem()
  const dialog = useRef<HTMLDialogElement>(null)
  const [run, setRun] = useState(0)
  const streak = sys.chain(crewId).streak // the same "don't break the chain" count as the check-in panel
  const today = sys.recordsOf(crewId, 'checkin').some((r) => Math.floor(r.time / 86400000) === Math.floor(sys.now / 86400000))
  return (
    <>
      <span className="chip" title="Day chain: days in a row with a check-in"><Flame size={13} strokeWidth={1.75} /> <b className="num">{streak}</b> day{streak === 1 ? '' : 's'}</span>
      <button className={today ? '' : 'primary'} onClick={() => { setRun((x) => x + 1); dialog.current?.showModal() }}>
        <ClipboardCheck size={15} strokeWidth={1.75} /> Daily check-in{today ? ' · done' : ''}
      </button>
      <dialog ref={dialog} className="panel checkin-dialog">
        <Flow key={run} crewId={crewId} onClose={() => dialog.current?.close()} />
      </dialog>
    </>
  )
}
