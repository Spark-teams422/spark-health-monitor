// Health hexagon (team table, replaces the dynamic octagon): six loads, centre 0, outer edge full load.
// The polygon raises no alarm; alarms keep coming from the blocks. Scales in thresholds.json -> hexagon.
import type { OriResult } from './eva'
import { thresholds } from './statusEngine'

const clip = (x: number) => Math.min(1, Math.max(0, x))

export interface HexAxis {
  label: string
  /** 0 = no load, 1 = full load; null = no data */
  value: number | null
  note: string
}

export interface HexInput {
  /** rMSSD now and the person's own normal (EVA: suit baseline; otherwise the daily HRV and the crew baseline) */
  rmssd: number | null
  rmssd0: number
  /** EVA only */
  hr?: number
  ori?: OriResult | null
  /** EVA energy so far and the planned total (BTU) */
  effort?: { done: number; planned: number }
}

export function hexagon(x: HexInput): { axes: (HexAxis & { info: (typeof thresholds.hexagon.axes)[number] })[]; ori: number | null; ring: number } {
  const h = thresholds.hexagon
  const c = x.ori?.components ?? {}
  const hrExp = x.ori?.hrExpected ?? null
  const eva = 'EVA only'
  return {
    ring: h.cautionRing,
    ori: x.ori?.ori ?? null,
    axes: ([
      { label: 'Autonomic reserve', value: x.rmssd === null ? null : clip(1 - x.rmssd / x.rmssd0), note: 'rMSSD / own rMSSD₀' },
      { label: 'Heart-rate deviation', value: x.hr !== undefined && hrExp !== null ? clip((x.hr - hrExp) / h.hrDeviationFullBpm) : null, note: hrExp !== null ? 'measured − expected for effort' : eva },
      { label: 'Vasodilation', value: c.V ?? null, note: c.V !== undefined ? 'core–skin gradient (G-TRANSIT V)' : eva },
      { label: 'Heat storage', value: c.T ?? null, note: c.T !== undefined ? 'PSI temperature term (G-TRANSIT T)' : eva },
      { label: 'Volume deficit', value: c.H ?? null, note: c.H !== undefined ? 'plasma deficit (G-TRANSIT H)' : eva },
      { label: 'Cumulative effort', value: x.effort ? clip(x.effort.done / x.effort.planned) : null, note: x.effort ? `${Math.round(x.effort.done)} of ${Math.round(x.effort.planned)} BTU planned` : eva },
    ] as HexAxis[]).map((a, i) => ({ ...a, info: h.axes[i] })),
  }
}
