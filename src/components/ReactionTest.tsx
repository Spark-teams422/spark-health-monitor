// Reaction time test (Periodic Health Tasks Checklist, section 3): the box turns green after a random wait; the astronaut
// presses Space or clicks as fast as possible. Five reactions; the median is saved. No colour limit (open item).
import { useEffect, useRef, useState } from 'react'
import { useSystem } from '../core/system'

const TRIALS = 5
const WAIT_MS: [number, number] = [1500, 4000]
type Phase = 'idle' | 'wait' | 'go' | 'early' | 'done'
const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2 }

export function ReactionTest({ crewId }: { crewId: string }) {
  const sys = useSystem()
  const [phase, setPhase] = useState<Phase>('idle')
  const [times, setTimes] = useState<number[]>([])
  const timer = useRef<number | undefined>(undefined)
  const shownAt = useRef(0)
  const all = sys.history('reaction_ms', crewId).map((m) => m.value)
  const earlier = phase === 'done' ? all.slice(0, -1) : all // the test just saved is not its own normal
  const own = earlier.length ? median(earlier.slice(-6)) : null

  const arm = () => {
    setPhase('wait')
    timer.current = window.setTimeout(() => { shownAt.current = performance.now(); setPhase('go') }, WAIT_MS[0] + Math.random() * (WAIT_MS[1] - WAIT_MS[0]))
  }
  const start = () => { setTimes([]); arm() }
  const press = () => {
    if (phase === 'wait') { window.clearTimeout(timer.current); setPhase('early'); return }
    if (phase === 'early') { arm(); return }
    if (phase !== 'go') return
    const next = [...times, Math.round(performance.now() - shownAt.current)]
    setTimes(next)
    if (next.length < TRIALS) { arm(); return }
    setPhase('done')
    sys.addReaction(crewId, Math.round(median(next)), next)
  }
  const pressRef = useRef(press)
  pressRef.current = press
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.code === 'Space' && !['idle', 'done'].includes(phase)) { e.preventDefault(); pressRef.current() } }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [phase])
  useEffect(() => () => window.clearTimeout(timer.current), [])
  useEffect(() => { window.clearTimeout(timer.current); setPhase('idle'); setTimes([]) }, [crewId])

  const result = phase === 'done' ? Math.round(median(times)) : null
  const text = { idle: 'Start, then press Space or click when the box turns green', wait: 'Wait for green…', go: 'PRESS NOW', early: 'Too early – press to try again', done: `Done · median ${result} ms` }[phase]
  return (
    <div className="rt">
      <button className="rt-box" data-phase={phase} onMouseDown={phase === 'idle' || phase === 'done' ? undefined : press} aria-live="polite">
        <b>{text}</b>
        {phase !== 'idle' && <span className="num">{times.length} / {TRIALS}</span>}
      </button>
      <div className="rt-row">
        <button className="primary" onClick={start} disabled={phase === 'wait' || phase === 'go' || phase === 'early'}>{phase === 'done' ? 'Test again' : 'Start reaction test'}</button>
        <span className="num">{times.map((t) => `${t} ms`).join(' · ')}</span>
      </div>
      <span className="muted">
        Own normal (median of the last tests): <b className="num">{own === null ? '—' : `${Math.round(own)} ms`}</b>
        {result !== null && own !== null && <> · this test <b className="num">{result} ms ({result >= own ? '+' : ''}{Math.round(((result - own) / own) * 100)} %)</b></>}
        . Same time of day each test; no limit colour until the flight surgeon sets one.
      </span>
    </div>
  )
}
