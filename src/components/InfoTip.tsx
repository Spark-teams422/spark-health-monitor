import { Info, X } from 'lucide-react'
import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'

/**
 * Small "i" button that opens a short explanation. The bubble is fixed to the window (not to its panel), so a
 * scrolling or clipped panel, or a chart next to it, can never cover it; it stays inside the window.
 */
export function InfoTip({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const btn = useRef<HTMLButtonElement>(null)
  const pop = useRef<HTMLDivElement>(null)
  const [style, setStyle] = useState<CSSProperties>({ visibility: 'hidden' })
  useLayoutEffect(() => {
    if (!open || !btn.current || !pop.current) return
    const b = btn.current.getBoundingClientRect(), p = pop.current.getBoundingClientRect()
    const m = 8, W = window.innerWidth, H = window.innerHeight
    const left = Math.min(Math.max(m, b.right - p.width), W - p.width - m)
    const below = H - b.bottom - m, above = b.top - m
    const top = p.height <= below || below >= above ? b.bottom + 6 : Math.max(m, b.top - 6 - p.height)
    setStyle({ left, top, maxHeight: Math.max(below, above) - 6 })
  }, [open])
  return (
    <span className="info">
      <button ref={btn} className="info-btn" aria-expanded={open} aria-label={`About: ${title}`} title={`About: ${title}`} onClick={() => { setStyle({ visibility: 'hidden' }); setOpen(!open) }}><Info size={14} strokeWidth={1.75} /></button>
      {open && (
        <div ref={pop} className="info-pop" role="note" style={style}>
          <div className="info-head"><b>{title}</b><button className="ghost" onClick={() => setOpen(false)} aria-label="Close"><X size={14} /></button></div>
          {children}
        </div>
      )}
    </span>
  )
}
