import { Siren } from 'lucide-react'
import { useRef, useState } from 'react'
import { AcuteFlow } from '../screens/AcuteFlow'

/** Emergency button + the acute decision tree dialog. `big` = the panel-sized button of the Crew screen. */
export function Emergency({ crewId, big }: { crewId: string; big?: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [run, setRun] = useState(0)
  return (
    <>
      <button
        className={big ? 'emergency emergency-big' : 'emergency'}
        onClick={() => {
          setRun((x) => x + 1) // fresh session with the panel data of this moment
          dialog.current?.showModal()
        }}
      >
        <Siren size={big ? 28 : 16} strokeWidth={1.75} />
        <span>EMERGENCY</span>
        {big && <small>Opens the acute decision tree</small>}
      </button>
      <dialog ref={dialog} className="panel acute-dialog">
        <AcuteFlow key={run} openedBy={crewId} onClose={() => dialog.current?.close()} />
      </dialog>
    </>
  )
}
