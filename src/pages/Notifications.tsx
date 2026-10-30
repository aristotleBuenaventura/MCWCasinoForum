import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { DocumentTitle } from '../components/DocumentTitle'
import { LoginLink } from '../components/LoginModal'
import { useForum } from '../context/ForumContext'
import { api } from '../lib/api'
import { timeAgo } from '../lib/utils'
import type { Notification } from '../types'

export function Notifications() {
  const { currentUser, markNotificationsRead } = useForum()
  const [items, setItems] = useState<Notification[]>([])

  useEffect(() => {
    if (!currentUser) return
    void api<{ notifications: Notification[] }>('/api/notifications').then((res) => {
      if (res.ok) setItems(res.notifications)
    })
    markNotificationsRead()
  }, [currentUser, markNotificationsRead])

  if (!currentUser) {
    return (
      <div className="forum-card p-6 text-center">
        <p className="prose-muted">Log in to see notifications.</p>
        <LoginLink className="btn btn-primary mt-3 inline-flex">Log in</LoginLink>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <DocumentTitle title="Notifications — MCW Forum" />
      <h1 className="page-title gold-text">Notifications</h1>
      <div className="forum-card divide-y divide-[var(--color-border)]">
        {items.map((n) => (
          <Link
            key={n.id}
            to={n.link}
            className={`list-row block p-3 ${n.read ? '' : 'bg-[rgba(215,174,85,0.06)]'}`}
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
