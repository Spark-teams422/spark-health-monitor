// Acute question sequence engine (Step 4c). Pure logic over config/acuteTree.json and the
// instruction cards; no question or instruction text lives in code.
import tree from '../config/acuteTree.json'
import emergencyAndPriority from '../config/acuteInstructions.json'
import watch from '../config/acuteWatch.json'

export type Answer = 'yes' | 'no' | 'unsure'
export type AcuteLevel = 'emergency' | 'priority' | 'watch'
export interface Instruction {
  level: AcuteLevel
  title: string
  now: string[]
  waiting?: string[]
  monitor?: string
  comms?: string
  worse?: string
  then?: string
  followUp?: string
}
interface Node {
  s: 'T' | 'X' | 'M' | 'B'
  q: string
  hint?: string
  yes: string
  no: string
  unsure?: 'yes' | 'no'
  setFlag?: 'EVA' | 'RAD'
  onlyIf?: 'EVA' | 'RAD'
  noWhen?: { node: string; is: string; to: string }
}

export const nodes = tree.nodes as unknown as Record<string, Node>
/** S4 option: one tap straight to the card, or one confirming question first (team review, 15 Nov 2026). */
export interface RedFlag { label: string; to: string; oneTap?: boolean; verify?: { q: string; basis: string[]; prefill?: string } }
export const redFlagOptions = tree.redFlags.options as RedFlag[]
const strip = (o: object) => Object.fromEntries(Object.entries(o).filter(([k]) => !k.startsWith('_')))
export const instructions = { ...strip(emergencyAndPriority), ...strip(watch) } as Record<string, Instruction>
export const LEVEL_LABEL: Record<AcuteLevel, string> = { emergency: 'EMERGENCY', priority: 'PRIORITY', watch: 'WATCH' }
const UNSURE_HELP_COUNT = 3
const RANK: Record<AcuteLevel, number> = { emergency: 3, priority: 2, watch: 1 }

/** How dangerous a destination is: an instruction by its level, a further question between WATCH and PRIORITY. */
const danger = (target: string) => (target === 'ENV' ? 3 : instructions[target] ? RANK[instructions[target].level] : 1.5)

/**
 * "Not sure" rule of the document: T and X questions go to Yes; M questions enter the branch;
 * elsewhere the answer goes to the more dangerous side (ties go to Yes). Explicit per-question
 * directions in the tables win.
 */
export function unsureDirection(id: string): 'yes' | 'no' {
  const n = nodes[id]
  if (n.unsure) return n.unsure
  if (n.s !== 'B') return 'yes'
  return danger(n.no) > danger(n.yes) ? 'no' : 'yes'
}

/** What the panel knows about the cabin and crew when the environment rule is applied. */
export interface EnvState {
  cabinRed: boolean
  co2Emergency: boolean
  anySpo2Red: boolean
  noData: boolean
}
/** Environment routing rule: EMERGENCY if any acute condition holds, otherwise the gradual-CO₂ card. */
export const environmentRoute = (e: EnvState) => (e.cabinRed || e.co2Emergency || e.anySpo2Red || e.noData ? 'A-ENVIRONMENT' : 'C-ENVIRONMENT-CO2')

export type Step =
  | { kind: 'problem' }
  | { kind: 'safety' }
  | { kind: 'verify'; label: string }
  | { kind: 'who' }
  | { kind: 'conscious' }
  | { kind: 'flags' }
  | { kind: 'question'; id: string }
  | { kind: 'pick'; ids: string[] }
  | { kind: 'context' }
  | { kind: 'outcome'; code: string }

export interface LoggedAnswer {
  id: string
  question: string
  answer: string
  time: number
}

/** One run through the tree for one person. */
export class AcuteSession {
  step: Step = { kind: 'problem' }
  personId: string | null = null
  forSelf = true
  flags = { EVA: false, RAD: false }
  log: LoggedAnswer[] = []
  unsureCount = 0
  /** instructions (or a question) waiting behind the current card */
  queue: string[] = []
  /** after an environment card the flow continues with the person selection */
  resumeAtWho = false
  selfHarmSelected = false
  private pendingM: string | null = null
  private effective = new Map<string, 'yes' | 'no'>()

  /** screens the person has answered (a list screen counts once) */
  screens = 0
  /** runs the person asked to go through one by one ("Not sure" on a list) */
  private sequential = new Set<string>()
  /** true while a list or the context screen is replayed through answer() */
  private replay = false

  /** `lists` = show runs of questions as one screen (the panel); off = the document's one-question-per-screen order. */
  constructor(private env: () => EnvState, private clock: () => number, private lists = false) {}

  /** The rest of a run from `id`, when it is shown as one list screen. */
  private runFrom(id: string): string[] | null {
    const run = tree.lists.runs.find((r) => r.includes(id))
    if (!run || this.sequential.has(run[0])) return null
    const rest = run.slice(run.indexOf(id)).filter((x) => !nodes[x].onlyIf || this.flags[nodes[x].onlyIf!])
    return rest.length >= 2 ? rest : null
  }

  private note(id: string, question: string, answer: string) {
    this.log.push({ id, question, answer, time: this.clock() })
  }

  private goTo(target: string): void {
    if (target === 'ENV') return this.goTo(environmentRoute(this.env()))
    if (target === 'S4') return void (this.step = { kind: 'flags' })
    if (target.startsWith('V:')) return void (this.step = { kind: 'verify', label: target.slice(2) })
    if (instructions[target]) {
      // "not sure" at a main-elimination question: a generic WATCH result does not close the region
      if (this.pendingM && instructions[target].level === 'watch') {
        const back = nodes[this.pendingM].no
        this.pendingM = null
        return this.goTo(back)
      }
      this.pendingM = null
      return void (this.step = { kind: 'outcome', code: target })
    }
    const n = nodes[target]
    if (n.onlyIf && !this.flags[n.onlyIf]) return this.goTo(n.no)
    if (this.lists && !this.replay) {
      if (target === tree.lists.context[0].gate) return void (this.step = { kind: 'context' })
      const run = this.runFrom(target)
      if (run) return void (this.step = { kind: 'pick', ids: run })
    }
    this.step = { kind: 'question', id: target }
  }

  /** First screen (replaces G1): cabin goes to what is wrong in the cabin, health to G2 (who). */
  problem(p: 'cabin' | 'health') {
    this.screens++
    this.note('G1', tree.problem.question, tree.problem.options.find((o) => o.id === p)!.label)
    this.step = p === 'cabin' ? { kind: 'safety' } : { kind: 'who' }
  }

  /** Cabin: selected safety option ids ('other' = not sure what; empty = no cabin problem after all). */
  safety(selected: string[]) {
    this.screens++
    const picked = tree.safety.options.filter((o) => selected.includes(o.id))
    const other = selected.includes('other')
    this.note('G1a', tree.safety.cabinQuestion, [...picked.map((o) => o.label), ...(other ? [tree.safety.otherLabel] : [])].join('; ') || 'No problem')
    if (!picked.length && !other) return void (this.step = { kind: 'who' })
    this.resumeAtWho = true
    this.goTo(picked.some((o) => o.to === 'A-ENVIRONMENT') ? 'A-ENVIRONMENT' : 'ENV')
  }

  /** G2: who the panel was opened for. */
  who(personId: string, forSelf: boolean) {
    this.screens++
    this.personId = personId
    this.forSelf = forSelf
    this.resumeAtWho = false
    this.note('G2', 'Who is this for?', forSelf ? `${personId} (myself)` : personId)
    this.step = forSelf ? { kind: 'flags' } : { kind: 'conscious' }
  }

  /** G3: index of the selected option, or 'unsure' (treated as the most dangerous option after a repeat check). */
  conscious(choice: number | 'unsure') {
    this.screens++
    const o = tree.consciousness.options
    const picked = choice === 'unsure' ? o[o.length - 1] : o[choice]
    if (choice === 'unsure') this.unsureCount++
    this.note('G3', tree.consciousness.question, choice === 'unsure' ? `Not sure → ${picked.to}` : picked.label)
    this.goTo(picked.to)
  }

  /** S4: selected red-flag labels; 'other' starts the T questions, 'none' goes on to the context questions. */
  redFlags(choice: string[] | 'other' | 'none') {
    this.screens++
    const rf = tree.redFlags
    if (choice === 'other' || choice === 'none' || choice.length === 0) {
      this.note('S4', rf.question, choice === 'other' ? 'Something else / not sure' : 'None')
      return this.goTo(choice === 'other' ? rf.other : rf.none)
    }
    this.note('S4', rf.question, choice.join('; '))
    const order = (t: string) => (rf.order.includes(t) ? rf.order.indexOf(t) : rf.order.length)
    // one entry per card, most urgent first; a diagnosis-like label goes through its confirming question
    const picked = redFlagOptions.filter((o) => choice.includes(o.label)).sort((a, b) => order(a.to) - order(b.to))
    const seen = new Set<string>()
    const items = picked.filter((o) => !seen.has(o.to) && seen.add(o.to)).map((o) => (o.verify ? `V:${o.label}` : o.to))
    this.selfHarmSelected = seen.has('A-PSYCH') && picked[0].to !== 'A-PSYCH'
    this.queue = items.slice(1)
    this.goTo(items[0])
  }

  /** Confirming question of a diagnosis-like S4 label: Yes / Not sure → the card; No → next selected sign, else T1. */
  verify(a: Answer) {
    this.screens++
    if (this.step.kind !== 'verify') return
    const label = this.step.label
    const o = redFlagOptions.find((x) => x.label === label)!
    if (a === 'unsure') this.unsureCount++
    this.note(`S4·${o.verify!.basis.join('/')}`, o.verify!.q, a === 'unsure' ? '? (taken as yes)' : a)
    if (a !== 'no') return this.goTo(o.to)
    this.goTo(this.queue.shift() ?? tree.redFlags.other)
  }

  /** Answer the current yes/no question. */
  answer(a: Answer) {
    if (this.step.kind !== 'question') return
    if (!this.replay) this.screens++
    const id = this.step.id
    const n = nodes[id]
    const eff = a === 'unsure' ? unsureDirection(id) : a
    if (a === 'unsure') this.unsureCount++
    if (n.s === 'M') this.pendingM = a === 'unsure' ? id : null
    this.effective.set(id, eff)
    this.note(id, n.q, a === 'unsure' ? `? (taken as ${eff})` : a)
    if (eff === 'yes' && n.setFlag) this.flags[n.setFlag] = true
    const no = n.noWhen && this.effective.get(n.noWhen.node) === n.noWhen.is ? n.noWhen.to : n.no
    this.goTo(eff === 'yes' ? n.yes : no)
  }

  /** Replay answers through answer() (same routing, flags and log as one-by-one), then show the next screen. */
  private replayed(fn: () => void) {
    this.screens++
    this.replay = true
    fn()
    this.replay = false
    if (this.step.kind === 'question') this.goTo(this.step.id)
  }
  private at = (id: string) => this.step.kind === 'question' && this.step.id === id

  /** Walk a run: No to each item until `pick`, Yes to `pick` ('none' = No to all). Stops if the path leaves the run. */
  private walk(ids: string[], pick: string | 'none') {
    for (const id of ids) {
      if (!this.at(id)) return
      if (id === pick) return this.answer('yes')
      this.answer('no')
    }
  }

  /** List screen: the first item that fits, 'none', or 'unsure' (ask the run one by one). */
  pick(choice: string | 'none' | 'unsure') {
    if (this.step.kind !== 'pick') return
    const ids = this.step.ids
    if (choice === 'unsure') {
      this.sequential.add(tree.lists.runs.find((r) => r.includes(ids[0]))![0])
      this.screens++
      return void (this.step = { kind: 'question', id: ids[0] })
    }
    this.replayed(() => { this.step = { kind: 'question', id: ids[0] }; this.walk(ids, choice) })
  }

  /** Context screen: each gate (X1, X2) Yes / No / Not sure, and for Yes the first follow-up that fits. */
  context(gates: { answer: Answer; pick?: string | 'none' | 'unsure' }[]) {
    if (this.step.kind !== 'context') return
    this.replayed(() => {
      tree.lists.context.forEach((g, i) => {
        if (!this.at(g.gate) && !(i === 0 && this.step.kind === 'context')) return
        this.step = { kind: 'question', id: g.gate }
        const a = gates[i] ?? { answer: 'no' }
        this.answer(a.answer)
        if (!this.at(g.run[0])) return
        if (a.pick === 'unsure') return this.answer('unsure') // X rule: not sure → yes
        this.walk(g.run, a.pick ?? 'none')
      })
    })
  }

  /** Open the next waiting instruction (multiple red flags), or continue after an environment card. */
  next(): void {
    const t = this.queue.shift()
    if (t) return this.goTo(t)
    if (this.resumeAtWho) this.step = { kind: 'who' }
  }

  /** Document rule: after 3 or more "not sure" answers, a crewmate should answer and the package priority rises. */
  get needsHelper() {
    return this.unsureCount >= UNSURE_HELP_COUNT
  }

  get hasNext() {
    return this.queue.length > 0 || this.resumeAtWho
  }
}
