import type { Level, Status } from '../core/types'

const lv = (s: Status): Level => (s.silent ? 'green' : s.level)

/** A value in the colour of its level (the team asked for colour only, no shape; the reason is the tooltip). */
export function Value({ value, unit, status }: { value: string | number; unit: string; status: Status; size?: number }) {
  return (
    <span className="mt-value num" data-level={lv(status)} title={status.reason}>
      {value}<small>{unit}</small>
    </span>
  )
}
