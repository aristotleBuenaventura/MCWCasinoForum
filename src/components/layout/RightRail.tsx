import { Link } from 'react-router-dom'
import { useForum } from '../../context/ForumContext'
import { AdRotator } from '../AdRotator'
import { MediaOrPlaceholder } from '../Placeholder'

export function RightRail() {
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

  const members = state.users.filter((u) => !u.banned).length
  const messages = state.threads.length + state.comments.length
  const featured = state.categories.filter((c) => c.featured).slice(0, 4)
  const deepCount = (id: string) => {
    const ids = [id, ...state.categories.filter((c) => c.parentId === id).map((c) => c.id)]
    return state.threads.filter((t) => ids.includes(t.forumId)).length
  }
  const games = [...state.trendingGames].sort((a, b) => a.order - b.order)

  return (
    <aside className="space-y-4">
      <section className="forum-card overflow-hidden">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="section-title">Trending games</div>
          <Link to="/communities/slot-games" className="text-xs gold-text hover:underline">View more</Link>
        </div>
        <ul className="divide-y divide-[var(--color-border)]">
          {games.map((g) => (
            <li key={g.id}>
              <Link to={g.url || '/communities'} className="flex items-center gap-3 px-4 py-3 hover:bg-white/5">
                <MediaOrPlaceholder src={g.imageUrl} label="Game" className="w-10 h-10 rounded-md shrink-0" />
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{g.title}</div>
                  <div className="text-xs prose-muted truncate">{g.subtitle}</div>
                </div>
              </Link>
            </li>
          ))}
          {games.length === 0 && <li className="px-4 py-4 text-sm prose-muted">No games set yet.</li>}
        </ul>
      </section>

      <section className="forum-card overflow-hidden">
        <div className="px-4 py-3 section-title">Top contributors</div>
        <ul className="divide-y divide-[var(--color-border)]">
          {topContributors.map(({ user, replies }) => (
            <li key={user!.id} className="px-4 py-2.5 flex items-center justify-between text-sm">
              <Link to={`/profile/${user!.username}`} className="gold-text hover:underline truncate">
                {user!.displayName}
              </Link>
              <span className="prose-muted text-xs">{replies}</span>
            </li>
          ))}
          {topContributors.length === 0 && <li className="px-4 py-4 text-sm prose-muted">No replies yet.</li>}
        </ul>
      </section>

      <section className="forum-card overflow-hidden">
        <div className="px-4 py-3 section-title">Community statistics</div>
        <dl className="px-4 pb-4 grid grid-cols-2 gap-y-2 text-sm">
          <dt className="prose-muted">Threads</dt>
          <dd className="text-right font-semibold">{state.threads.length}</dd>
          <dt className="prose-muted">Messages</dt>
          <dd className="text-right font-semibold">{messages}</dd>
          <dt className="prose-muted">Members</dt>
          <dd className="text-right font-semibold">{members}</dd>
          <dt className="prose-muted">Active users</dt>
          <dd className="text-right font-semibold">{members}</dd>
        </dl>
      </section>

      <AdRotator slot="right-1" />

      <section className="forum-card overflow-hidden">
        <div className="px-4 py-3 section-title">Featured communities</div>
        <ul className="divide-y divide-[var(--color-border)]">
          {featured.map((c) => (
            <li key={c.id}>
              <Link to={`/communities/${c.slug}`} className="block px-4 py-3 hover:bg-white/5">
                <div className="text-sm font-medium">{c.name}</div>
                <div className="text-xs prose-muted">{deepCount(c.id)} threads</div>
              </Link>
            </li>
          ))}
          {featured.length === 0 && <li className="px-4 py-4 text-sm prose-muted">None featured yet.</li>}
        </ul>
      </section>
    </aside>
  )
}
