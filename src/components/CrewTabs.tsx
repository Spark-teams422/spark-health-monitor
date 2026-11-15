import { crew, useSystem } from '../core/system'
import { Shape } from './StatusBadge'

/** Crew selector row used by the Periodic and Physical screens. */
export function CrewTabs({ crewId, onSelect }: { crewId: string; onSelect: (id: string) => void }) {
  const sys = useSystem()
  return (
    <div className="crew-tabs" role="tablist" aria-label="Crew member">
      {crew.map((c) => (
        <button key={c.id} role="tab" aria-selected={c.id === crewId} onClick={() => onSelect(c.id)}>
          <Shape level={sys.crewStatus(c.id).level} /> {c.name} <span className="muted">{c.id}</span>
        </button>
      ))}
    </div>
  )
}
