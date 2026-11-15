// Real NASA data shown next to the simulated telemetry (see scripts/fetch_nasa_data.py):
// ISS DOSTEL dose rate from OSDR RadLab, replayed with shifted dates, and DONKI solar particle events.
import donki from '../data/donki_sep.json'
import radlab from '../data/radlab_dostel.json'

const points = radlab.points as [number, number][]
const STEP = 5 * 60_000
/** The data moment that is replayed at the start of the simulation (a few hours after a real SEP event). */
const ANCHOR = Date.parse('2022-04-02T18:00:00Z')

export const radlabMeta = { source: radlab.source, instrument: `${radlab.spacecraft} ${radlab.instrument}`, unit: radlab.unit, url: radlab.url, retrieved: radlab.retrieved }

/** Real measurement time that a simulated time stands for. */
export const replayTime = (simTime: number, simStart: number) => ANCHOR + (simTime - simStart)

/** Measured dose rate for a simulated time (nearest 5-minute mean; the week loops if the replay runs past its end). */
export function radlabAt(simTime: number, simStart: number): number {
  const i = Math.round((replayTime(simTime, simStart) - points[0][0]) / STEP)
  return points[((i % points.length) + points.length) % points.length][1]
}

/** DONKI SEP events placed on the simulated clock. */
export const sepEvents = (simStart: number) =>
  donki.events.map((e) => ({ time: simStart + (Date.parse(e.time) - ANCHOR), realTime: e.time, label: `SEP · ${e.instruments.join(', ')}`, link: e.link }))

// NOAA SWPC GOES >=10 MeV integral proton flux (scripts/fetch_open_data.py), replayed like RadLab on the simulated clock.
import goes from '../data/goes_protons.json'
const goesPts = goes.points as [number, number][]
const GOES_ANCHOR = goesPts[Math.floor(goesPts.length / 2)][0]
export const goesMeta = { source: goes.source, unit: goes.unit, retrieved: goes.retrieved, note: goes.note }

export function goesAt(simTime: number, simStart: number): number {
  const i = Math.round((GOES_ANCHOR + (simTime - simStart) - goesPts[0][0]) / STEP)
  return goesPts[((i % goesPts.length) + goesPts.length) % goesPts.length][1]
}

/** NOAA solar radiation storm level for a >=10 MeV flux: 0 = none, 1..5 = S1..S5. */
export function sLevel(flux: number): number {
  return Object.values(goes.sScale).filter((limit) => flux >= limit).length
}

// Inspiration4 crew blood values (NASA OSDR OSD-569 CBC, OSD-575 CMP): real before / after flight reference.
import i4 from '../data/inspiration4_blood.json'
export const inspiration4Meta = { source: i4.source, retrieved: i4.retrieved, timepoints: i4.timepoints }
export const inspiration4 = (metricId: string) => i4.rows.filter((r) => r.metric === metricId)
