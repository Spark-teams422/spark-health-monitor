import { X, ZoomIn } from 'lucide-react'
import { useRef, useState, type ReactNode } from 'react'

/** Magnifier button: opens the chart large in a sub panel. The content is only rendered while it is open. */
export function ZoomButton({ title, children }: { title: string; children: () => ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [open, setOpen] = useState(false)
  return (
    <>
      <button className="zoom-btn" title={`Enlarge: ${title}`} aria-label={`Enlarge ${title}`} onClick={() => { setOpen(true); dialog.current?.showModal() }}><ZoomIn size={20} /></button>
      <dialog ref={dialog} className="panel drawer zoom" onClose={(e) => { if (e.target === e.currentTarget) setOpen(false) }}>
        <div className="drawer-head">
          <h2>{title}</h2>
          <button className="ghost" onClick={() => dialog.current?.close()} aria-label="Close"><X size={16} /></button>
        </div>
        <div className="drawer-body zoom-body">{open && children()}</div>
      </dialog>
    </>
  )
}
