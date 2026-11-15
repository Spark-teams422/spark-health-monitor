import { Maximize, Minimize, Moon, Sun } from 'lucide-react'
import { useEffect, useState } from 'react'
import logo from './assets/spark-logo.png'
import mission from './config/mission.json'
import { LinkBadge } from './components/StatusBadge'
import { SimulatorPanel } from './components/SimulatorPanel'
import { Welcome } from './components/Welcome'
import { crew, metricConfig, metricIds, useSystem } from './core/system'
import { CabinScreen } from './screens/CabinScreen'
import { PeriodicScreen } from './screens/PeriodicScreen'
import { TasksScreen } from './screens/TasksScreen'
import { CheckInButton } from './components/CheckIn'
import { Bell, X } from 'lucide-react'
import { PhysicalScreen } from './screens/PhysicalScreen'
import { EvaScreen } from './screens/EvaScreen'
import { MainScreen } from './screens/MainScreen'
import { PersonalScreen } from './screens/PersonalScreen'
import type { Mode } from './core/types'

type Light = 'auto' | 'day' | 'night'
const LIGHT_KEY = 'ahm.light.v1'
const savedLight = (): Light => { try { return (localStorage.getItem(LIGHT_KEY) as Light) || 'auto' } catch { return 'auto' } }

const MODES: { id: Mode; label: string }[] = [
  { id: 'main', label: 'Main' },
  { id: 'personal', label: 'Personal' },
  { id: 'tasks', label: 'Tasks & Calendar' },
  { id: 'periodic', label: 'Periodic' },
  { id: 'physical', label: 'Physical' },
  { id: 'cabin', label: 'Cabin' },
  { id: 'eva', label: 'EVA' },
]

/** Application shell (Step 1.7): the roadmap's three screens over one shared layer, sized to one screen. */
export default function App() {
  const sys = useSystem()
  const [mode, setMode] = useState<Mode>('main')
  const [crewId, setCrewId] = useState(crew[0].id)
  const [light, setLight] = useState<Light>(savedLight)
  const pickLight = (l: Light) => { setLight(l); try { localStorage.setItem(LIGHT_KEY, l) } catch { /* private window: keep for this visit */ } }
  // full screen for the demo display; Esc (browser) also leaves it
  const [full, setFull] = useState(() => !!document.fullscreenElement)
  useEffect(() => { const on = () => setFull(!!document.fullscreenElement); document.addEventListener("fullscreenchange", on); return () => document.removeEventListener("fullscreenchange", on) }, [])
  const toggleFull = () => { (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()).catch(() => { /* not allowed (e.g. iframe): stay windowed */ }) }
  // day / night follows the mission clock in auto; the EVA screen always stays dark
  const hour = new Date(sys.now).getUTCHours()
  const isDay = light === 'auto' ? hour >= mission.dayNight.dayFromHour && hour < mission.dayNight.nightFromHour : light === 'day'
  // automatic mode switch: the panel goes to EVA when the airlock opens (EVA document, principle 6)
  const outside = sys.scenario.startsWith('eva')
  useEffect(() => {
    if (outside) setMode('eva')
  }, [outside])
  // the Mars-transit solar event scenario opens the Cabin screen (Cabin Radiation, Mars transit)
  const solar = sys.scenario === 'solarEvent'
  useEffect(() => {
    if (solar) setMode('cabin')
  }, [solar])
  // Alert band: every critical status the engine reports right now (crew and cabin).
  const critical = [
    ...crew.filter((c) => sys.crewStatus(c.id).level === 'red').map((c) => ({ who: c.id, text: sys.crewStatus(c.id).reason })),
    ...metricIds('cabin').filter((id) => sys.status(id, null).level === 'red').map((id) => ({ who: 'Cabin', text: metricConfig(id).label })),
  ]
  const crewCount = crew.filter((c) => ['yellow', 'red'].includes(sys.crewStatus(c.id).level)).length

  return (
    <div className={`app ${mode === 'eva' ? 'theme-eva' : isDay ? 'theme-day' : 'theme-night'}`}>
      <header className="topbar">
        <img className="brand" src={logo} alt="Spark" />
        <h1>Astronaut Health Monitor</h1>
        <nav className="nav" role="tablist" aria-label="View">
          {MODES.map((m) => (
            <button key={m.id} role="tab" aria-selected={mode === m.id} onClick={() => setMode(m.id)}>
              {m.label}
              {m.id === 'main' && crewCount > 0 && <span className="count">{crewCount}</span>}
            </button>
          ))}
        </nav>
        {mode !== 'main' && ( // the main table has its own link and mission-day cells
          <LinkBadge link={sys.link} queued={sys.notifications.queue.length} />
        )}
        {mode !== 'eva' && (
          <div className="seg light" role="group" aria-label={`Day or night display, now ${isDay ? 'day' : 'night'}`}>
            <button aria-pressed={light === 'auto'} onClick={() => pickLight('auto')} title={`Follows the mission clock: day ${mission.dayNight.dayFromHour}:00–${mission.dayNight.nightFromHour}:00 UTC`}>Auto {isDay ? <Sun size={14} /> : <Moon size={14} />}</button>
            <button aria-pressed={light === 'day'} onClick={() => pickLight('day')} aria-label="Day"><Sun size={14} /></button>
            <button aria-pressed={light === 'night'} onClick={() => pickLight('night')} aria-label="Night"><Moon size={14} /></button>
          </div>
        )}
        <span className="chip">Data <b>simulated</b></span>
        <button className="icon-btn ghost fs-btn" onClick={toggleFull} aria-pressed={full} title={full ? "Exit full screen (Esc)" : "Full screen"} aria-label={full ? "Exit full screen" : "Full screen"}>{full ? <Minimize size={16} /> : <Maximize size={16} />}</button>
      </header>
      {critical.length > 0 && (
        <div className="alert-band" role="alert">
          <b>CRITICAL</b>
          <span>{critical.map((c) => `${c.who} · ${c.text}`).join('   ')}</span>
          <button onClick={() => { setCrewId(crew.find((c) => c.id === critical[0].who)?.id ?? crewId); setMode('personal') }}>Open</button>
        </div>
      )}
      <SimulatorPanel />
      <Welcome />
      {mode === 'main' && <MainScreen onOpen={(id) => { setCrewId(id); setMode('personal') }} />}
      {mode === 'personal' && <PersonalScreen crewId={crewId} onSelect={setCrewId} />}
      {mode === 'tasks' && <TasksScreen crewId={crewId} onSelect={setCrewId} />}
      {mode === 'periodic' && <PeriodicScreen crewId={crewId} onSelect={setCrewId} />}
      {mode === 'physical' && <PhysicalScreen crewId={crewId} onSelect={setCrewId} />}
      {mode === 'cabin' && <CabinScreen />}
      {mode === 'eva' && <EvaScreen />}
      {(mode === 'personal' || mode === 'tasks') && sys.reminders.filter((r) => r.crewId === crewId).slice(0, 1).map((r) => (
        <div key={r.part} className="reminder-toast" role="status">
          <Bell size={18} />
          <span><b>{crew.find((c) => c.id === crewId)?.name}</b> · {r.message}</span>
          <CheckInButton crewId={crewId} />
          <button className="ghost" aria-label="Dismiss" onClick={() => sys.dismissReminder(crewId, r.part)}><X size={16} /></button>
        </div>
      ))}
    </div>
  )
}
