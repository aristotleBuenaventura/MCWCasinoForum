import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useForum } from '../context/ForumContext'
import { timeAgo } from '../lib/utils'

export function Notifications() {
  const { currentUser, state, markNotificationsRead } = useForum()

  useEffect(() => {
    markNotificationsRead()
    // Intentionally run once on mount so opening the page clears unread badges.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!currentUser) {
    return (
      <div className="forum-card p-6 text-center">
        <p className="prose-muted">Log in to see notifications.</p>
        <Link to="/login" className="btn btn-primary mt-3 inline-flex">
          Log in
        </Link>
      </div>
    )
  }

  const items = state.notifications.filter((n) => n.userId === currentUser.id)

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Notifications</h1>
      <div className="forum-card divide-y divide-[var(--color-border)] dark:divide-[#2a3542]">
        {items.map((n) => (
          <Link
            key={n.id}
            to={n.link}
            className={`block p-4 hover:bg-[var(--color-brand-soft)]/40 dark:hover:bg-[#243040] ${
              n.read ? '' : 'bg-[var(--color-brand-soft)]/30'
            }`}
          >
            <div className="text-sm">{n.message}</div>
            <div className="text-xs prose-muted mt-1">{timeAgo(n.createdAt)}</div>
          </Link>
        ))}
        {items.length === 0 && <div className="p-6 text-center prose-muted">No notifications yet.</div>}
      </div>
    </div>
  )
}
