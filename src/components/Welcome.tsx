import { Monitor, Play } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { SCENARIOS, type ScenarioId } from '../core/simulator'
import { useSystem } from '../core/system'

/** What each demo scenario shows and where to look (visitor guide, not flight UI). */
const ABOUT: Record<ScenarioId, string> = {
  normal: 'All crew and cabin values in range. Explore the screens freely.',
  slowTrend: "A3's heart-rate variability drops a little more each day for a week. See Personal → Early warning.",
  suddenCritical: "A3's blood oxygen falls within minutes: caution first, then a verified critical alert on every screen.",
  linkLoss: 'The same oxygen drop while the Earth link is down: alerts queue and are sent when the link returns.',
  multiCrew: 'Cabin CO₂ rises and two crew members lose oxygen saturation: is it the person or the environment?',
  solarEvent: 'A solar radiation storm on the way to Mars. Opens Cabin → Cabin Radiation (Mars transit) with dose rate and EVA advice.',
  eva: 'Nominal spacewalk on the Mars surface. Opens the EVA suit display: time budget and next task.',
  evaWorkload: 'High workload uses oxygen faster, so "Return by" moves earlier.',
  evaCo2: 'The suit CO₂ scrubber degrades and inspired CO₂ rises.',
  evaLeak: 'A slow suit leak: pressure and oxygen margin fall.',
  evaCooling: 'Suit cooling degrades and heat load builds up.',
  evaOrtho: 'Orthostatic intolerance risk rises (G-TRANSIT model).',
  evaBackupO2: 'The primary oxygen supply fails and the backup takes over.',
  evaSolar: 'A solar particle event warning arrives during the spacewalk.',
  evaMismatch: 'Heart rate is too high for the measured workload.',
  evaPartner: 'The spacewalk partner stops responding.',
}
// the welcome window offers a short demo set; every scenario stays in the Scenario bar at the top
const GROUPS: [string, ScenarioId[]][] = [
  ['Habitat and transit', ['normal', 'slowTrend', 'suddenCritical', 'solarEvent']],
  ['Spacewalk (EVA)', ['eva', 'evaWorkload', 'evaOrtho']],
]

/** Opens on every visit: a desktop-screen notice and a scenario picker that starts the simulation. */
export function Welcome() {
  const sys = useSystem()
  const ref = useRef<HTMLDialogElement>(null)
  const [pick, setPick] = useState<ScenarioId>('suddenCritical')
  // guard: React StrictMode runs this twice in development, and Safari throws on showModal() of an open dialog
  useEffect(() => { const d = ref.current; if (d && !d.open) try { d.showModal() } catch { d.setAttribute("open", "") } }, [])
  const start = () => { sys.setScenario(pick); sys.setRunning(true); ref.current?.close() }
  return (
    <dialog ref={ref} className="panel welcome" aria-labelledby="welcome-title">
      <h2 id="welcome-title">Astronaut Health Monitor</h2>
      <p className="welcome-desk">
        <Monitor size={22} aria-hidden />
        <span><b>Please open this on a desktop or laptop screen</b> (1366 × 768 or larger). The panels are designed for a crew station display and do not fit a phone.</span>
      </p>
      <h3>Choose a scenario</h3>
      <div className="welcome-list" role="radiogroup" aria-label="Scenario">
        {GROUPS.map(([label, ids]) => (
          <fieldset key={label}>
            <legend>{label}</legend>
            {ids.map((id) => (
              <label key={id} className="welcome-opt" data-on={pick === id}>
                <input type="radio" name="scenario" checked={pick === id} onChange={() => setPick(id)} />
                <span><b>{SCENARIOS[id]}</b><small>{ABOUT[id]}</small></span>
              </label>
            ))}
          </fieldset>
        ))}
      </div>
      <p className="muted">All values are simulated sample data (seed 42); time runs at {sys.speed} mission minutes per second. You can change the scenario and the speed any time in the bar at the top.</p>
      <div className="row welcome-actions">
        <button className="ghost" onClick={() => ref.current?.close()}>Explore without starting</button>
        <button className="icon-btn primary" onClick={start} autoFocus><Play size={16} />Start scenario</button>
      </div>
    </dialog>
  )
}
