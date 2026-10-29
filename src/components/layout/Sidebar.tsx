import { Link } from 'react-router-dom'
import { useForum } from '../../context/ForumContext'

export function Sidebar() {
  const { state, getUser } = useForum()

  const replyCounts = new Map<string, number>()
  for (const c of state.comments) {
    replyCounts.set(c.authorId, (replyCounts.get(c.authorId) ?? 0) + 1)
  }
  const topContributors = [...replyCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([userId, replies]) => ({ user: getUser(userId), replies }))
    .filter((x) => x.user && !x.user.banned)

  const totalThreads = state.threads.length
  const totalMessages = state.threads.length + state.comments.length
  const members = state.users.filter((u) => !u.banned).length
  const latest = [...state.users]
    .filter((u) => !u.banned)
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))[0]

  return (
    <aside className="space-y-4">
      <section className="forum-card overflow-hidden">
        <div className="px-3 py-2 bg-[white] dark:bg-[#243040] font-semibold text-sm border-b border-[var(--color-border)] dark:border-[#2a3542]">
          Our Top Forums
        </div>
        <ul className="divide-y divide-[var(--color-border)] dark:divide-[#2a3542]">
          {state.categories.slice(0, 5).map((c) => (
            <li key={c.id}>
              <Link to={`/forums#${c.id}`} className="block px-3 py-2.5 hover:bg-[white]/60 dark:hover:bg-[#243040]">
                <div className="font-medium text-sm text-[var(--color-gold)]">{c.name}</div>
                <div className="text-xs prose-muted">
                  {c.threadCount} threads · {c.postCount} posts
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="forum-card overflow-hidden">
        <div className="px-3 py-2 bg-[white] dark:bg-[#243040] font-semibold text-sm border-b border-[var(--color-border)] dark:border-[#2a3542]">
          Top Contributors this Month
        </div>
        <ul className="divide-y divide-[var(--color-border)] dark:divide-[#2a3542]">
          {topContributors.map(({ user, replies }) => (
            <li key={user!.id} className="px-3 py-2.5 flex items-center justify-between gap-2 text-sm">
              <Link to={`/profile/${user!.username}`} className="text-[var(--color-gold)] font-medium hover:underline">
                {user!.displayName}
              </Link>
              <span className="prose-muted text-xs">{replies} Replies</span>
            </li>
          ))}
          {topContributors.length === 0 && (
            <li className="px-3 py-3 text-sm prose-muted">No replies yet.</li>
          )}
        </ul>
      </section>

      <section className="forum-card overflow-hidden">
        <div className="px-3 py-2 bg-[white] dark:bg-[#243040] font-semibold text-sm border-b border-[var(--color-border)] dark:border-[#2a3542]">
          Forum statistics
        </div>
        <dl className="px-3 py-3 grid grid-cols-2 gap-y-2 text-sm">
          <dt className="prose-muted">Threads</dt>
          <dd className="text-right font-semibold">{totalThreads.toLocaleString()}</dd>
          <dt className="prose-muted">Messages</dt>
          <dd className="text-right font-semibold">{totalMessages.toLocaleString()}</dd>
          <dt className="prose-muted">Members</dt>
          <dd className="text-right font-semibold">{members.toLocaleString()}</dd>
          <dt className="prose-muted">Latest member</dt>
          <dd className="text-right font-semibold">
            {latest ? (
              <Link to={`/profile/${latest.username}`} className="text-[var(--color-gold)] hover:underline">
                {latest.username}
              </Link>
            ) : (
              '—'
            )}
          </dd>
        </dl>
      </section>
    </aside>
  )
}
