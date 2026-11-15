import { describe, expect, it } from 'vitest'
import tree from '../config/acuteTree.json'
import { AcuteSession, environmentRoute, instructions, nodes, unsureDirection, type Answer, type EnvState } from './acute'

const calm: EnvState = { cabinRed: false, co2Emergency: false, anySpo2Red: false, noData: false }
const start = (env: EnvState = calm) => {
  const s = new AcuteSession(() => env, () => 0)
  s.safety([])
  s.who('A3', true)
  return s
}
/** answer the listed questions as given, everything else "no", until an instruction is reached */
const run = (s: AcuteSession, answers: Record<string, Answer> = {}) => {
  for (let i = 0; i < 200 && s.step.kind === 'question'; i++) s.answer(answers[s.step.id] ?? 'no')
  return s.step.kind === 'outcome' ? s.step.code : s.step.kind
}

describe('tree data matches the document', () => {
  it('4 selection screens + 111 questions = 115', () => expect(Object.keys(nodes).length + 4).toBe(115))
  it('64 instructions: 15 emergency, 17 priority, 32 watch', () => {
    const count = (l: string) => Object.values(instructions).filter((i) => i.level === l).length
    expect([count('emergency'), count('priority'), count('watch')]).toEqual([15, 17, 32])
  })
  it('every destination exists and every instruction has "do now" steps', () => {
    const ok = (t: string) => t === 'ENV' || !!nodes[t] || !!instructions[t]
    for (const [id, n] of Object.entries(nodes)) {
      expect(ok(n.yes) && ok(n.no), id).toBe(true)
      if (n.noWhen) expect(ok(n.noWhen.to), id).toBe(true)
    }
    for (const o of [...tree.safety.options, ...tree.redFlags.options, ...tree.consciousness.options]) expect(ok(o.to) || o.to === 'S4', o.label).toBe(true)
    for (const [code, i] of Object.entries(instructions)) expect(i.now.length, code).toBeGreaterThan(0)
  })
  it('every instruction can be reached', () => {
    const reachable = new Set<string>(['A-ENVIRONMENT', 'C-ENVIRONMENT-CO2', ...tree.consciousness.options.map((o) => o.to), ...tree.redFlags.options.map((o) => o.to)])
    for (const n of Object.values(nodes)) [n.yes, n.no, n.noWhen?.to].forEach((t) => t && reachable.add(t))
    for (const code of Object.keys(instructions)) expect(reachable.has(code), code).toBe(true)
  })
})

describe('"not sure" goes to the dangerous side', () => {
  it('T and X questions go to Yes', () => {
    expect(unsureDirection('T3')).toBe('yes')
    expect(unsureDirection('X1')).toBe('yes')
  })
  it('explicit directions from the tables', () => {
    expect(unsureDirection('TR4a')).toBe('no')
    expect(unsureDirection('GN2b')).toBe('no')
  })
  it('branch questions pick the higher-level result', () => {
    expect(unsureDirection('KS1a')).toBe('no') // No → A-DCS
    expect(unsureDirection('TR1d')).toBe('yes') // PRIORITY beats WATCH
    expect(unsureDirection('K4a')).toBe('yes') // EMERGENCY
  })
  it('not sure at a main question enters the branch, and a generic WATCH result returns to the next main question', () => {
    const s = start()
    s.redFlags('none')
    const code = run(s, { M3: 'unsure' }) // skin branch ends in C-DERMATITIS (watch) → back to M4 … → C-UNCLEAR
    expect(code).toBe('C-UNCLEAR')
    expect(s.log.some((l) => l.id === 'CL4')).toBe(true)
    expect(s.unsureCount).toBe(1)
  })
})

describe('paths', () => {
  it('nothing wrong anywhere ends in the general watch card; EVA-only questions are skipped', () => {
    const s = start()
    s.redFlags('none')
    expect(run(s)).toBe('C-UNCLEAR')
    expect(s.log.some((l) => l.id === 'M0')).toBe(false)
  })
  it('red flag goes straight to its instruction', () => {
    const s = start()
    s.redFlags(['Pressure or tightness in the chest'])
    expect(s.step).toEqual({ kind: 'outcome', code: 'A-HEART' })
  })
  it('several red flags: airway first, the rest wait behind the card', () => {
    const s = start()
    s.redFlags(['Thoughts of self-harm', 'Bleeding that will not stop', 'Swelling of lips, tongue or throat'])
    expect(s.step).toEqual({ kind: 'outcome', code: 'A-ANAPHYLAXIS' })
    expect(s.selfHarmSelected).toBe(true)
    s.next()
    expect(s.step).toEqual({ kind: 'outcome', code: 'A-BLEEDING' })
    s.next()
    expect(s.step).toEqual({ kind: 'verify', label: 'Thoughts of self-harm' }) // diagnosis-like: one confirming question
    s.verify('yes')
    expect(s.step).toEqual({ kind: 'outcome', code: 'A-PSYCH' })
  })
  it('EVA in the last 24 h opens the decompression and glove questions', () => {
    const s = start()
    s.redFlags('none')
    expect(run(s, { X1: 'yes', X1c: 'yes' })).toBe('A-DCS')
    const t = start()
    t.redFlags('none')
    expect(run(t, { X1: 'yes', M0: 'yes' })).toBe('C-EVA-HAND')
  })
  it('R1c is asked only when fever was confirmed', () => {
    const fever = start()
    fever.redFlags('none')
    expect(run(fever, { M2: 'yes', BY3: 'yes', R1: 'yes', R1c: 'yes' })).toBe('C-BREATHING-SEVERE')
    const noFever = start()
    noFever.redFlags('none')
    expect(run(noFever, { M2: 'yes', BY3: 'yes', R1b: 'yes' })).toBe('C-BREATHING')
    expect(noFever.log.some((l) => l.id === 'R1c')).toBe(false)
  })
  it('someone else: unconscious and not breathing goes to CPR; not sure too', () => {
    const s = new AcuteSession(() => calm, () => 0)
    s.safety([])
    s.who('A1', false)
    expect(s.step.kind).toBe('conscious')
    s.conscious('unsure')
    expect(s.step).toEqual({ kind: 'outcome', code: 'A-CPR' })
  })
})

describe('environment routing rule', () => {
  it('gradual CO₂ → priority card; any acute condition → emergency card', () => {
    expect(environmentRoute(calm)).toBe('C-ENVIRONMENT-CO2')
    expect(environmentRoute({ ...calm, anySpo2Red: true })).toBe('A-ENVIRONMENT')
    expect(environmentRoute({ ...calm, co2Emergency: true })).toBe('A-ENVIRONMENT')
    expect(environmentRoute({ ...calm, noData: true })).toBe('A-ENVIRONMENT')
  })
  it('G1 "several people affected" applies the rule, then continues with the person selection', () => {
    const s = new AcuteSession(() => calm, () => 0)
    s.safety(['multi'])
    expect(s.step).toEqual({ kind: 'outcome', code: 'C-ENVIRONMENT-CO2' })
    s.next()
    expect(s.step.kind).toBe('who')
  })
  it('smoke always goes to the emergency card', () => {
    const s = new AcuteSession(() => calm, () => 0)
    s.safety(['smoke', 'multi'])
    expect(s.step).toEqual({ kind: 'outcome', code: 'A-ENVIRONMENT' })
  })
})

describe('team review changes (15 Nov 2026)', () => {
  const health = () => {
    const s = new AcuteSession(() => calm, () => 0)
    s.problem('health')
    s.who('A3', true)
    return s
  }
  it('first screen: cabin → cabin options → environment card; health → who', () => {
    const c = new AcuteSession(() => calm, () => 0)
    expect(c.step.kind).toBe('problem')
    c.problem('cabin')
    expect(c.step.kind).toBe('safety')
    c.safety(['smoke'])
    expect(c.step).toEqual({ kind: 'outcome', code: 'A-ENVIRONMENT' })
    const u = new AcuteSession(() => calm, () => 0)
    u.problem('cabin')
    u.safety(['other'])
    expect(u.step).toEqual({ kind: 'outcome', code: environmentRoute(calm) })
    const h = new AcuteSession(() => calm, () => 0)
    h.problem('health')
    expect(h.step.kind).toBe('who')
  })
  it('one-tap signs go straight to the card', () => {
    for (const [label, code] of [['Bleeding that will not stop', 'A-BLEEDING'], ['Swelling of lips, tongue or throat', 'A-ANAPHYLAXIS'], ['Pressure or tightness in the chest', 'A-HEART']]) {
      const s = health()
      s.redFlags([label])
      expect(s.step, label).toEqual({ kind: 'outcome', code })
    }
  })
  it('diagnosis-like signs ask one confirming question: yes / not sure → card, no → T1', () => {
    const yes = health(); yes.redFlags(['Fever with confusion'])
    expect(yes.step).toEqual({ kind: 'verify', label: 'Fever with confusion' })
    yes.verify('yes'); expect(yes.step).toEqual({ kind: 'outcome', code: 'A-SEPSIS' })
    const unsure = health(); unsure.redFlags(['Overheating and confusion']); unsure.verify('unsure')
    expect(unsure.step).toEqual({ kind: 'outcome', code: 'A-HEAT' })
    const no = health(); no.redFlags(['Abdominal pain too severe to touch']); no.verify('no')
    expect(no.step).toEqual({ kind: 'question', id: tree.redFlags.other })
  })
  it('a "no" moves on to the next selected sign; one-tap signs keep their urgency order', () => {
    const s = health()
    s.redFlags(['Thoughts of self-harm', 'Slurred speech, drooping face'])
    expect(s.step).toEqual({ kind: 'verify', label: 'Slurred speech, drooping face' })
    s.verify('no')
    expect(s.step).toEqual({ kind: 'verify', label: 'Thoughts of self-harm' })
  })
})

describe('screen budget with list screens (team review, 15 Nov 2026)', () => {
  type Act = (s: AcuteSession) => void
  /** every screen choice except "Not sure" (that path asks one by one, by design) */
  const choices = (s: AcuteSession): Act[] => {
    const st = s.step
    if (st.kind === 'question') return [(x) => x.answer('yes'), (x) => x.answer('no')]
    if (st.kind === 'pick') return [...st.ids, 'none'].map((c) => (x: AcuteSession) => x.pick(c))
    if (st.kind === 'context') {
      const opts = (run: string[]) => [{ answer: 'no' as Answer }, ...[...run, 'none'].map((p) => ({ answer: 'yes' as Answer, pick: p }))]
      const [g1, g2] = tree.lists.context.map((g) => opts(g.run))
      return g1.flatMap((a) => g2.map((b) => (x: AcuteSession) => x.context([a, b])))
    }
    if (st.kind === 'verify') return [(x) => x.verify('yes'), (x) => x.verify('no')]
    return []
  }
  const fresh = (path: Act[]) => {
    const s = new AcuteSession(() => calm, () => 0, true)
    s.problem('health'); s.who('A3', true); s.redFlags('none')
    path.forEach((a) => a(s))
    return s
  }
  it('every non-emergency card is reached in 10 screens or fewer (self report: G1, G2, S4 + the rest), same cards as one by one', () => {
    const worst = new Map<string, number>()
    const stack: Act[][] = [[]]
    let leaves = 0
    while (stack.length) {
      const path = stack.pop()!
      const s = fresh(path)
      if (s.step.kind === 'outcome') {
        leaves++
        worst.set(s.step.code, Math.max(worst.get(s.step.code) ?? 0, s.screens))
        continue
      }
      for (const c of choices(s)) stack.push([...path, c])
    }
    const over = [...worst].filter(([code, n]) => instructions[code].level !== 'emergency' && n > 10)
    expect(leaves).toBeGreaterThan(100)
    expect(over).toEqual([])
    // same destinations as the document's one-by-one order from X1 (excluding T-path-only cards)
    const oneByOne = new Set<string>()
    const walk = (id: string, seen: string[]): void => {
      if (seen.length > 60) return
      if (instructions[id]) return void oneByOne.add(id)
      if (id === 'ENV') return void oneByOne.add(environmentRoute(calm))
      const n = nodes[id]
      for (const y of [n.yes, n.no, ...(n.noWhen ? [n.noWhen.to] : [])]) walk(y, [...seen, id])
    }
    walk('X1', [])
    expect([...worst.keys()].sort()).toEqual([...oneByOne].sort())
  })
  it('a list tap records the items above as No, so the Earth package shows the full path', () => {
    const s = fresh([(x) => x.context([{ answer: 'no' }, { answer: 'no' }])])
    expect(s.step).toMatchObject({ kind: 'pick', ids: expect.arrayContaining(['M1', 'M7']) })
    s.pick('M4')
    expect(s.log.filter((l) => /^M\d$/.test(l.id)).map((l) => `${l.id}:${l.answer}`)).toEqual(['M1:no', 'M2:no', 'M3:no', 'M4:yes'])
    expect(s.step).toMatchObject({ kind: 'pick', ids: expect.arrayContaining(['K1']) })
  })
})
