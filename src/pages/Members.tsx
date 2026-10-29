import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Avatar } from '../components/Avatar'
import { useForum } from '../context/ForumContext'
import { timeAgo } from '../lib/utils'

export function Members() {
  const { state, followerCount } = useForum()
  const [q, setQ] = useState('')

  const members = useMemo(() => {
    const list = state.users.filter((u) => !u.banned)
    const query = q.trim().toLowerCase()
    const filtered = query
      ? list.filter(
          (u) =>
            u.username.includes(query) ||
            u.displayName.toLowerCase().includes(query) ||
            u.bio.toLowerCase().includes(query),
        )
      : list
    return filtered.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
  }, [state.users, q])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Members</h1>
        <input
          className="input max-w-xs"
          placeholder="Search members..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      <div className="forum-card divide-y divide-[var(--color-border)] dark:divide-[#2a3542]">
        {members.map((u) => (
          <Link
            key={u.id}
            to={`/profile/${u.username}`}
            className="flex gap-3 p-4 hover:bg-[white]/40 dark:hover:bg-[#243040]"
          >
            <Avatar user={u} size={44} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{u.displayName}</span>
                <span className="text-sm prose-muted">@{u.username}</span>
                {u.role !== 'user' && (
                  <span className="text-[10px] uppercase font-bold text-[var(--color-gold)]">{u.role}</span>
                )}
              </div>
              <p className="text-sm prose-muted line-clamp-1 mt-0.5">{u.bio || 'No bio'}</p>
              <div className="text-xs prose-muted mt-1">
                {followerCount(u.id)} followers · Joined {timeAgo(u.createdAt)}
              </div>
            </div>
          </Link>
        ))}
        {members.length === 0 && <div className="p-6 text-center prose-muted">No members found.</div>}
      </div>
    </div>
  )
}
