// Emergency acute question sequence (Step 4c). Questions, routing and instruction cards all come
// from the acute tree data through core/acute.ts; this file only draws the current step.
import { useEffect, useMemo, useReducer, useState } from 'react'
import { clock } from '../components/NotificationList'
import tree from '../config/acuteTree.json'
import { AcuteSession, instructions, LEVEL_LABEL, nodes, redFlagOptions, type AcuteLevel, type Answer } from '../core/acute'
import { crew, useSystem } from '../core/system'
import type { Level } from '../core/types'

const LEVEL_COLOR: Record<AcuteLevel, Level> = { emergency: 'red', priority: 'yellow', watch: 'green' }
const LEVEL_SHAPE: Record<AcuteLevel, string> = { emergency: '■', priority: '▲', watch: '●' }

function Multi({ options, preset, onDone, noneLabel, extra }: { options: { key: string; label: string; hint?: string }[]; preset: string[]; onDone: (keys: string[]) => void; noneLabel: string; extra?: React.ReactNode }) {
  const [sel, setSel] = useState<string[]>(preset)
  return (
    <div className="stack">
      {options.map((o) => (
        <button key={o.key} className="acute-choice" aria-pressed={sel.includes(o.key)} onClick={() => setSel(sel.includes(o.key) ? sel.filter((k) => k !== o.key) : [...sel, o.key])}>
          {o.label}
          {o.hint && <small>{o.hint}</small>}
          {preset.includes(o.key) && <small>Pre-selected from panel data · confirm or remove</small>}
        </button>
      ))}
      <div className="row">
        {sel.length > 0 && <button className="primary acute-choice" onClick={() => onDone(sel)}>Confirm selection ({sel.length})</button>}
        <button className="acute-choice" onClick={() => onDone([])}>{noneLabel}</button>
        {extra}
      </div>
    </div>
  )
}

type Gate = { answer: Answer; pick?: string }
/** X1 and X2 on one screen, each with its follow-up symptoms (same document questions, pre-filled from the panel). */
function Context({ hints, onDone }: { hints: Record<string, { answer: Answer; why: string }>; onDone: (g: Gate[]) => void }) {
  const [gates, setGates] = useState<(Gate | null)[]>(tree.lists.context.map((g) => (hints[g.gate] ? { answer: hints[g.gate].answer } : null)))
  const set = (i: number, g: Gate) => setGates((cur) => cur.map((x, k) => (k === i ? g : x)))
  const ready = gates.every((g) => g && (g.answer === 'no' || g.pick))
  return (
    <div className="stack">
      <h2>Context</h2>
      {tree.lists.context.map((c, i) => {
        const g = gates[i]
        return (
          <div key={c.gate} className="acute-gate">
            <b>{nodes[c.gate].q}</b>
            {nodes[c.gate].hint && <span className="muted">{nodes[c.gate].hint}</span>}
            {hints[c.gate] && <span className="muted">Panel suggests {hints[c.gate].answer === 'yes' ? 'Yes' : 'No'} · {hints[c.gate].why}</span>}
            <div className="acute-answers">
              {(['yes', 'no', 'unsure'] as const).map((a) => (
                <button key={a} className="acute-choice" aria-pressed={g?.answer === a} onClick={() => set(i, { answer: a })}>{{ yes: 'Yes', no: 'No', unsure: 'Not sure' }[a]}</button>
              ))}
            </div>
            {g && g.answer !== 'no' && (
              <div className="stack">
                <span className="muted">Then: tap the first one that fits.</span>
                {c.run.map((id) => <button key={id} className="acute-choice" aria-pressed={g.pick === id} onClick={() => set(i, { ...g, pick: id })}>{nodes[id].q}</button>)}
                <div className="row">
                  <button className="acute-choice" aria-pressed={g.pick === 'none'} onClick={() => set(i, { ...g, pick: 'none' })}>None of these</button>
                  <button className="acute-choice" aria-pressed={g.pick === 'unsure'} onClick={() => set(i, { ...g, pick: 'unsure' })}>Not sure</button>
                </div>
              </div>
            )}
          </div>
        )
      })}
      <button className="primary acute-choice" disabled={!ready} onClick={() => onDone(gates as Gate[])}>Continue</button>
    </div>
  )
}

function Card({ code, session, onNext, onClose }: { code: string; session: AcuteSession; onNext: () => void; onClose: () => void }) {
  const sys = useSystem()
  const i = instructions[code]
  const [done, setDone] = useState<Record<number, number>>({})
  const rad = session.flags.RAD && code !== 'A-RAD'
  const n = sys.notifications.list.find((x) => x.metricId.startsWith(`acute:${code}:`))
  return (
    <div className="stack">
      <div className="acute-head" data-level={LEVEL_COLOR[i.level]}>
        <b>{LEVEL_SHAPE[i.level]} {LEVEL_LABEL[i.level]}</b> · {code}
        <h2>{i.title}</h2>
        <span>For: {session.personId ?? 'whole crew'} · reached in {session.screens} screens</span>
      </div>
      {session.selfHarmSelected && <div className="hint"><b>▲</b> {tree.selfHarmNote}</div>}
      {session.needsHelper && <div className="hint"><b>▲</b> Three or more "Not sure" answers: ask a crewmate to answer the questions. Package priority is raised one level.</div>}
      <h3>Do now</h3>
      <ol className="acute-steps">
        {i.now.map((s, k) => (
          <li key={k}>
            <span>{s}</span>
            <button aria-pressed={k in done} onClick={() => setDone({ ...done, [k]: sys.now })}>{k in done ? `Done ${clock(done[k])}` : 'Done'}</button>
          </li>
        ))}
      </ol>
      {i.waiting && (<><h3>While waiting for communication</h3><ul>{i.waiting.map((s) => <li key={s}>{s}</li>)}</ul></>)}
      {i.then && (<><h3>Then</h3><p>{i.then}</p></>)}
      {i.followUp && (<><h3>Follow-up</h3><p>{i.followUp}</p></>)}
      {i.monitor && <p className="muted"><b>Automatic monitoring:</b> {i.monitor}</p>}
      {i.worse && <p><b>If it gets worse:</b> {i.worse}</p>}
      {rad && (<><h3>{tree.radFollowUp.title}</h3><ul>{tree.radFollowUp.steps.map((s) => <li key={s}>{s}</li>)}</ul></>)}
      <details>
        <summary>Package for Earth {n ? (n.earth === 'sent' ? `· sent ${clock(n.earthSentAt!)}` : '· … queued (no link)') : ''}</summary>
        {i.comms && <p><b>When communication returns:</b> {i.comms}</p>}
        <table><tbody>
          {session.log.map((l, k) => <tr key={k}><td>{clock(l.time)}</td><td>{l.id}</td><td style={{ whiteSpace: 'normal' }}>{l.question}</td><td><b>{l.answer}</b></td></tr>)}
          {Object.entries(done).map(([k, t]) => <tr key={`d${k}`}><td>{clock(t)}</td><td>step {Number(k) + 1}</td><td style={{ whiteSpace: 'normal' }}>{i.now[Number(k)]}</td><td><b>done</b></td></tr>)}
        </tbody></table>
      </details>
      <p className="muted">Decision support, not a diagnosis. Medication and doses follow the mission medical kit procedure and the crew medical officer. Draft content awaiting physician approval.</p>
      <div className="row">
        {session.hasNext && <button className="primary acute-choice" onClick={onNext}>{session.queue.length ? `Next instruction (${session.queue.length} waiting)` : 'Continue: assess each affected person'}</button>}
        <button className="acute-choice" onClick={onClose}>Close</button>
      </div>
    </div>
  )
}

export function AcuteFlow({ openedBy, onClose }: { openedBy: string; onClose: () => void }) {
  const sys = useSystem()
  const session = useMemo(() => new AcuteSession(() => sys.acuteEnv(), () => sys.now, true), [sys])
  const [, refresh] = useReducer((x: number) => x + 1, 0)
  const act = (fn: () => void) => { fn(); refresh() }
  const step = session.step
  const hints = sys.acuteHints(session.personId)
  const outcome = step.kind === 'outcome' ? step.code : null
  // reaching an instruction sends the result to the astronaut, the health screen and Earth
  useEffect(() => {
    if (outcome) sys.acuteResult(session.personId, outcome)
  }, [outcome, session, sys])

  return (
    <div className="stack acute">
      <div className="row">
        <b>EMERGENCY</b>
        <span className="muted">screen {session.screens + 1}{session.personId ? ` · for ${session.personId}` : ''}</span>
        <button style={{ marginLeft: 'auto' }} onClick={onClose}>Close</button>
      </div>

      {step.kind === 'problem' && (
        <>
          <h2>{tree.problem.question}</h2>
          <div className="stack">
            {tree.problem.options.map((o) => (
              <button key={o.id} className={`acute-choice ${o.id === 'cabin' && hints.safety.length ? 'primary' : ''}`} onClick={() => act(() => session.problem(o.id as 'cabin' | 'health'))}>
                {o.label}<small>{o.hint}</small>
                {o.id === 'cabin' && hints.safety.length > 0 && <small>Panel data shows a cabin problem · confirm</small>}
              </button>
            ))}
          </div>
        </>
      )}

      {step.kind === 'safety' && (
        <>
          <h2>{tree.safety.cabinQuestion}</h2>
          <div className="stack">
            {tree.safety.options.map((o) => (
              <button key={o.id} className={`acute-choice ${hints.safety.includes(o.id) ? 'primary' : ''}`} onClick={() => act(() => session.safety([o.id]))}>
                {o.label}
                {'hint' in o && <small>{o.hint}</small>}
                {hints.safety.includes(o.id) && <small>Panel data points here · confirm</small>}
              </button>
            ))}
            <button className="acute-choice" onClick={() => act(() => session.safety(['other']))}>{tree.safety.otherLabel}</button>
          </div>
        </>
      )}

      {step.kind === 'who' && (
        <>
          <h2>Who did you open this panel for?</h2>
          <div className="stack">
            <button className="acute-choice" onClick={() => act(() => session.who(openedBy, true))}>Myself ({openedBy})</button>
            {crew.filter((c) => c.id !== openedBy).map((c) => (
              <button key={c.id} className="acute-choice" onClick={() => act(() => session.who(c.id, false))}>
                {c.id} · {c.role}
                {sys.crewStatus(c.id).level === 'red' && <small>Critical value now</small>}
              </button>
            ))}
          </div>
        </>
      )}

      {step.kind === 'conscious' && (
        <>
          <h2>{tree.consciousness.question}</h2>
          <div className="stack">
            {tree.consciousness.options.map((o, k) => <button key={o.label} className="acute-choice" onClick={() => act(() => session.conscious(k))}>{o.label}</button>)}
            <button className="acute-choice" onClick={() => act(() => session.conscious('unsure'))}>Not sure<small>{tree.consciousness.unsureNote}</small></button>
          </div>
        </>
      )}

      {step.kind === 'flags' && (
        <>
          <h2>{tree.redFlags.question}</h2>
          <span className="muted">Time-critical: one tap opens the instruction.</span>
          <div className="acute-onetap">
            {redFlagOptions.filter((o) => o.oneTap).map((o) => <button key={o.label} className="acute-choice acute-urgent" onClick={() => act(() => session.redFlags([o.label]))}>{o.label}</button>)}
          </div>
          <span className="muted">Other signs: select, then confirm. Each is checked with one short question.</span>
          <Multi
            options={redFlagOptions.filter((o) => !o.oneTap).map((o) => ({ key: o.label, label: o.label }))}
            preset={[]}
            noneLabel="None of these"
            onDone={(k) => act(() => session.redFlags(k.length ? k : 'none'))}
            extra={<button className="acute-choice" onClick={() => act(() => session.redFlags('other'))}>Something else / not sure</button>}
          />
        </>
      )}

      {step.kind === 'verify' && (() => {
        const o = redFlagOptions.find((x) => x.label === step.label)!
        const r = o.verify!.prefill ? hints.reading(o.verify!.prefill) : null
        return (
          <>
            <span className="muted">Check: {o.label} · {o.verify!.basis.join(', ')}</span>
            <h2>{o.verify!.q}</h2>
            {r && <div className="hint"><b>Panel data: {r.text}</b>{r.off ? ' · outside the normal range' : ' · within the normal range'}. Confirm the rest yourself.</div>}
            <div className="acute-answers">
              {(['yes', 'no', 'unsure'] as const).map((a) => (
                <button key={a} className="acute-choice" onClick={() => act(() => session.verify(a))}>{{ yes: 'Yes', no: 'No', unsure: 'Not sure' }[a]}</button>
              ))}
            </div>
          </>
        )
      })()}

      {step.kind === 'question' && (() => {
        const n = nodes[step.id]
        const hint = hints.answers[step.id]
        return (
          <>
            <span className="muted">{step.id}</span>
            <h2>{n.q}</h2>
            {n.hint && <span className="muted">{n.hint}</span>}
            {hint && <div className="hint"><b>Panel suggests: {hint.answer === 'yes' ? 'Yes' : 'No'}</b> · {hint.why}. Confirm or correct.</div>}
            {hints.notes[step.id] && <div className="hint"><b>Note</b> · {hints.notes[step.id]} (own baseline; not a limit).</div>}
            <div className="acute-answers">
              {(['yes', 'no', 'unsure'] as const).map((a) => (
                <button key={a} className={`acute-choice ${hint?.answer === a ? 'primary' : ''}`} onClick={() => act(() => session.answer(a))}>
                  {{ yes: 'Yes', no: 'No', unsure: 'Not sure' }[a]}
                </button>
              ))}
            </div>
          </>
        )
      })()}

      {step.kind === 'pick' && (
        <>
          <h2>Which of these fits? Tap the first one that fits.</h2>
          <span className="muted">The ones above your choice are recorded as No.</span>
          <div className="stack">
            {step.ids.map((id) => {
              const h = hints.answers[id]
              return (
                <button key={id} className={`acute-choice ${h?.answer === 'yes' ? 'primary' : ''}`} onClick={() => act(() => session.pick(id))}>
                  {nodes[id].q}
                  {nodes[id].hint && <small>{nodes[id].hint}</small>}
                  {h && <small>Panel suggests {h.answer === 'yes' ? 'Yes' : 'No'} · {h.why}</small>}
                </button>
              )
            })}
            <div className="row">
              <button className="acute-choice" onClick={() => act(() => session.pick('none'))}>None of these</button>
              <button className="acute-choice" onClick={() => act(() => session.pick('unsure'))}>Not sure – ask one by one</button>
            </div>
          </div>
        </>
      )}

      {step.kind === 'context' && <Context hints={hints.answers} onDone={(g) => act(() => session.context(g))} />}

      {outcome && <Card key={outcome} code={outcome} session={session} onNext={() => act(() => session.next())} onClose={onClose} />}
    </div>
  )
}
