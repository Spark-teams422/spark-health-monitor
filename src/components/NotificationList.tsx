import { useSystem } from '../core/system'

export const clock = (t: number) => new Date(t).toISOString().slice(11, 16)

/** Critical notifications as delivered to the astronaut, the health screen and Earth. */
export function NotificationList({ max = 6 }: { max?: number }) {
  const { notifications } = useSystem()
  if (notifications.list.length === 0) return <span className="muted">No critical notifications.</span>
  return (
    <>
      {notifications.list.slice(0, max).map((n) => (
        <div key={n.id} className="notice" role="alert">
          <b className="num">{clock(n.time)}</b> {n.message}
          <div className="muted">
            Astronaut, health screen · Earth {n.earth === 'sent' ? `sent ${clock(n.earthSentAt!)}` : 'queued, no link'}
          </div>
        </div>
      ))}
    </>
  )
}
