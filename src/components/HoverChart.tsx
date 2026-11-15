// Hover read-out shared by every chart: a dashed vertical line at the pointer with the date, time and values there.
// The chart says how its time axis maps to its own SVG x (x0..x1 = t0..t1) and what to read at a time.
import { useRef, useState, type ReactNode } from 'react'

export type HoverRow = { label: string; value: string; color?: string }
/** `time` = the time the line snaps to (usually the nearest reading) */
export interface HoverRead { time: number; rows: HoverRow[]; /** axis position of the line when the axis is not time (default `time`) */ pos?: number }

export const stamp = (t: number) => `${new Date(t).toISOString().slice(0, 16).replace('T', ' ')} UTC`

/** Nearest point in time; null when there are none. */
export function nearestPoint<T extends { time: number }>(pts: T[], t: number): T | null {
  let best: T | null = null
  for (const p of pts) if (!best || Math.abs(p.time - t) < Math.abs(best.time - t)) best = p
  return best
}

export function HoverChart({ x0, x1, t0, t1, read, className = '', children }: { x0: number; x1: number; t0: number; t1: number; read: (t: number) => HoverRead | null; className?: string; children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null)
  const [at, setAt] = useState<{ left: number; top: number; height: number; r: HoverRead; flip: boolean } | null>(null)
  const move = (e: React.MouseEvent) => {
    const svg = box.current?.querySelector('svg')
    const ctm = svg?.getScreenCTM()
    if (!svg || !ctm || t1 <= t0) return
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse())
    if (p.x < x0 - 2 || p.x > x1 + 2) return setAt(null)
    const r = read(t0 + ((p.x - x0) / (x1 - x0)) * (t1 - t0))
    if (!r || !r.rows.length) return setAt(null)
    const sx = Math.min(x1, Math.max(x0, x0 + (((r.pos ?? r.time) - t0) / (t1 - t0)) * (x1 - x0)))
    const q = new DOMPoint(sx, 0).matrixTransform(ctm)
    const b = box.current!.getBoundingClientRect(), s = svg.getBoundingClientRect()
    setAt({ left: q.x - b.left, top: s.top - b.top, height: s.height, r, flip: q.x - b.left > b.width * 0.55 })
  }
  return (
    <div ref={box} className={`hover-chart ${className}`} onMouseMove={move} onMouseLeave={() => setAt(null)}>
      {children}
      {at && (
        <>
          <i className="hc-line" style={{ left: at.left, top: at.top, height: at.height }} />
          <div className="hc-tip" style={at.flip ? { right: `calc(100% - ${at.left - 8}px)`, top: at.top } : { left: at.left + 8, top: at.top }}>
            <b>{stamp(at.r.time)}</b>
            {at.r.rows.map((row) => (
              <span key={row.label}><i style={{ background: row.color ?? 'var(--text)' }} />{row.label} <b className="num">{row.value}</b></span>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
