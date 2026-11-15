import type { Level, LinkState, Status } from '../core/types'

// Shape + word + colour for every status (colour-blind safe): Normal ●, Caution ▲, Critical ■.
export const LEVEL_UI: Record<Level, { shape: string; word: string }> = {
  green: { shape: '●', word: 'Normal' },
  yellow: { shape: '▲', word: 'Caution' },
  red: { shape: '■', word: 'Critical' },
  nodata: { shape: '○', word: 'No data' },
}

/** The status shape as a crisp vector mark (circle, triangle, square, ring). */
export function Shape({ level, size = 9 }: { level: Level; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 10 10" aria-hidden className="shape">
      {level === 'green' && <circle cx="5" cy="5" r="4.2" fill="currentColor" />}
      {level === 'yellow' && <path d="M5 0.6 9.6 9.2H0.4Z" fill="currentColor" />}
      {level === 'red' && <rect x="0.8" y="0.8" width="8.4" height="8.4" fill="currentColor" />}
      {level === 'nodata' && <circle cx="5" cy="5" r="3.6" fill="none" stroke="currentColor" strokeWidth="1.4" />}
    </svg>
  )
}

export function StatusBadge({ status }: { status: Status }) {
  // A silent caution is logged but must not look like an alert.
  const level = status.silent ? 'green' : status.level
  const extra = status.level === 'red' && !status.confirmed ? ' · verifying' : status.silent ? ' · trend logged' : status.singleDeviation ? ' · repeat reading' : ''
  return (
    <span className="badge" data-level={level} title={status.reason}>
      <Shape level={level} />
      {LEVEL_UI[level].word}
      {extra}
    </span>
  )
}

const LINK_UI: Record<LinkState, { level: Level; word: string }> = {
  connected: { level: 'green', word: 'Connected' },
  weak: { level: 'yellow', word: 'Weak' },
  lost: { level: 'red', word: 'Lost' },
}

export function LinkBadge({ link, queued }: { link: LinkState; queued: number }) {
  const ui = LINK_UI[link]
  return (
    <span className="chip">
      Earth link
      <span className="badge" data-level={ui.level}>
        <Shape level={ui.level} />
        {ui.word}
      </span>
      {queued > 0 && <span className="tag">{queued} queued</span>}
    </span>
  )
}
