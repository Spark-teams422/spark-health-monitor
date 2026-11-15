import { X } from 'lucide-react'
import { useRef, useState, type ReactNode } from 'react'

/** A grid cell that opens a sub panel. The content is only rendered while the panel is open. */
export function Drawer({ title, summary, className = '', children }: { title: string; summary: ReactNode; className?: string; children: () => ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [open, setOpen] = useState(false)
  return (
    <>
      <button className={`cell-btn ${className}`} onClick={() => { setOpen(true); dialog.current?.showModal() }}>
        <span className="cell-title">{title}</span>
        {summary}
      </button>
      <dialog ref={dialog} className="panel drawer" onClose={(e) => { if (e.target === e.currentTarget) setOpen(false) /* a nested dialog (check-in) closing must not empty this one */ }}>
        <div className="drawer-head">
          <h2>{title}</h2>
          <button className="ghost" onClick={() => dialog.current?.close()} aria-label="Close"><X size={16} /></button>
        </div>
        <div className="drawer-body">{open && children()}</div>
      </dialog>
    </>
  )
}
