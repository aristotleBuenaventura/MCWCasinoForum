import { Shield } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useForum } from '../../context/ForumContext'
import { AdRotator } from '../AdRotator'
import { Username } from '../Username'

export function RightRail() {
  const { state, getUser } = useForum()

  const replyCounts = new Map<string, number>()
  for (const c of state.comments) replyCounts.set(c.authorId, (replyCounts.get(c.authorId) ?? 0) + 1)
  const topContributors = [...replyCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
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
    <aside className="space-y-3">
      <section className="forum-card overflow-hidden">
        <div className="px-3 py-2 flex items-center justify-between">
          <div className="section-title">Trending games</div>
          <Link to="/communities/slot-games" className="text-[11px] gold-text hover:underline">View more</Link>
        </div>
        <ul>
          {games.map((g) => (
            <li key={g.id}>
              <Link to={g.url || '/communities'} className="list-row flex items-center gap-2.5 px-3 py-2">
                <img src={g.imageUrl} alt="" className="w-9 h-9 rounded object-cover shrink-0" />
                <div className="min-w-0">
                  <div className="text-[13px] font-medium gold-text truncate">{g.title}</div>
                  <div className="text-[11px] prose-muted truncate">{g.subtitle}</div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="forum-card overflow-hidden">
        <div className="px-3 py-2 section-title">Top contributors</div>
        <ul>
          {topContributors.map(({ user, replies }) => (
            <li key={user!.id} className="px-3 py-1.5 flex items-center justify-between text-[13px]">
              <Username user={user} className="truncate" />
              <span className="prose-muted text-[11px] tabular-nums">{replies}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="forum-card p-3">
        <div className="section-title mb-2">Responsible gambling</div>
        <p className="text-[12px] prose-muted leading-relaxed">
          Set limits, take breaks, and never chase losses. This community is 18+.
        </p>
        <Link to="/communities/responsible-gambling" className="mt-2 inline-flex items-center gap-1 text-[12px] gold-text hover:underline">
          <Shield size={12} /> Read the tools
        </Link>
      </section>

      <section className="forum-card overflow-hidden">
        <div className="px-3 py-2 section-title">Community statistics</div>
        <dl className="px-3 pb-3 grid grid-cols-2 gap-y-1.5 text-[13px]">
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

      <AdRotator slot="right-1" heightClass="h-40" />

      <section className="forum-card p-3">
        <div className="section-title mb-2">Weekly awards</div>
        {[...state.providers].sort((a, b) => b.rating - a.rating).slice(0, 3).map((p, i) => (
          <div key={p.id} className="flex items-center justify-between text-[12px] py-1">
            <span className="prose-muted">{i + 1}. {p.name}</span>
            <span className="gold-text">{p.rating.toFixed(1)}</span>
          </div>
        ))}
      </section>

      <section className="forum-card overflow-hidden">
        <div className="px-3 py-2 section-title">Featured communities</div>
        <ul>
          {featured.map((c) => (
            <li key={c.id}>
              <Link to={`/communities/${c.slug}`} className="list-row block px-3 py-2">
                <div className="text-[13px] font-medium gold-text">{c.name}</div>
                <div className="text-[11px] prose-muted">{deepCount(c.id)} threads</div>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </aside>
  )
}
