import { HoverChart } from './HoverChart'

/** Tiny trend line, no axes. Colour comes from the parent (currentColor). With `points` (time + value) it reads out on hover. */
export function Spark({ values, points, label = '', unit = '', className = 'spark' }: { values?: number[]; points?: { time: number; value: number }[]; label?: string; unit?: string; className?: string }) {
  const vs = points ? points.map((p) => p.value) : values ?? []
  if (vs.length < 2) return null
  const min = Math.min(...vs), max = Math.max(...vs), span = max - min || 1
  const pts = vs.map((v, i) => `${(i / (vs.length - 1)) * 100},${30 - ((v - min) / span) * 28}`).join(' ')
  const svg = (
    <svg viewBox="0 0 100 32" className={points ? 'spark-svg' : className} preserveAspectRatio="none" aria-hidden>
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
    </svg>
  )
  if (!points) return svg
  // points are drawn evenly spaced, so the hover maps the index, not the clock
  const read = (i: number) => {
    const k = Math.round(i), p = points[k]
    return p && { time: p.time, pos: k, rows: [{ label, value: `${p.value} ${unit}` }] }
  }
  return <HoverChart className={className} x0={0} x1={100} t0={0} t1={points.length - 1} read={read}>{svg}</HoverChart>
}
