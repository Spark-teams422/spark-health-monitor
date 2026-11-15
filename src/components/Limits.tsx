// The caution / critical limits of a metric, as the shared layer reports them (thresholdBands).
import { thresholdBands } from '../core/statusEngine'
import type { EvalContext } from '../core/types'
import { Shape } from './StatusBadge'

const fmt = (v: number) => String(Number(v.toPrecision(3)))

export function Limits({ metricId, ctx }: { metricId: string; ctx: EvalContext }) {
  const bands = thresholdBands(metricId, ctx)
  if (!bands.length) return null
  return (
    <span className="limits" title="Caution and critical limits">
      {bands.map((b, i) => (
        <span key={i} data-level={b.level}>
          <Shape level={b.level} size={7} />
          {b.side === 'below' ? '<' : '>'}
          {fmt(b.value)}
        </span>
      ))}
    </span>
  )
}
