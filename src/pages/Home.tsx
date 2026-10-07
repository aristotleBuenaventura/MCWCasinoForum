import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ThreadCard } from '../components/ThreadCard'
import { useForum } from '../context/ForumContext'

const PAGE = 5

export function Home() {
  const { state, currentUser } = useForum()
  const [tab, setTab] = useState<'latest' | 'following'>('latest')
  const [visible, setVisible] = useState(PAGE)

  const followingIds = useMemo(() => {
    if (!currentUser) return new Set<string>()
    return new Set(
      state.follows.filter((f) => f.followerId === currentUser.id).map((f) => f.followingId),
    )
  }, [state.follows, currentUser])

  const threads = useMemo(() => {
    const sorted = [...state.threads].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
    if (tab === 'following' && currentUser) {
      return sorted.filter((t) => followingIds.has(t.authorId) || t.authorId === currentUser.id)
    }
    return sorted
  }, [state.threads, tab, currentUser, followingIds])

  const shown = threads.slice(0, visible)
  const members = state.users.filter((u) => !u.banned).length
  const messages = state.threads.length + state.comments.length
  const since = 2024

  return (
    <div className="space-y-5">
      <section className="forum-card overflow-hidden">
        <div className="bg-[linear-gradient(135deg,#e8f3fb,#ffffff)] dark:bg-[linear-gradient(135deg,#1e2a38,#1a222c)] p-5 md:p-6">
          <h1 className="text-2xl md:text-3xl font-bold text-[var(--color-brand)]">MCW Casino Forum</h1>
          <div className="mt-3 flex flex-wrap gap-4 text-sm">
            <div>
              <div className="text-xs uppercase tracking-wide prose-muted">posts</div>
              <div className="text-xl font-bold">{messages.toLocaleString()}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide prose-muted">members</div>
              <div className="text-xl font-bold">{members.toLocaleString()}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide prose-muted">Since</div>
              <div className="text-xl font-bold">{since}</div>
            </div>
          </div>
          <p className="mt-3 max-w-2xl prose-muted">
            A forum community dedicated to casino players and enthusiasts. Join the discussion about
            slots, table games, promotions, strategies, and more.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {!currentUser ? (
              <Link to="/register" className="btn btn-primary">
                Join Community
              </Link>
            ) : (
              <Link to="/create" className="btn btn-primary">
                Create thread
              </Link>
            )}
            <Link to="/forums" className="btn btn-secondary">
              Browse Forums
            </Link>
          </div>
        </div>
      </section>

      <div className="flex items-center gap-2">
        <button
          type="button"
          className={`btn ${tab === 'latest' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => {
            setTab('latest')
            setVisible(PAGE)
          }}
        >
          Latest
        </button>
        <button
          type="button"
          className={`btn ${tab === 'following' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => {
            setTab('following')
            setVisible(PAGE)
          }}
          disabled={!currentUser}
          title={!currentUser ? 'Log in to see following feed' : undefined}
        >
          Following
        </button>
      </div>

      <section className="space-y-3">
        {shown.map((t) => (
          <ThreadCard key={t.id} thread={t} />
        ))}
        {shown.length === 0 && (
          <div className="forum-card p-6 text-center prose-muted">
            {tab === 'following'
              ? 'Follow people to see their threads here.'
              : 'No threads yet. Be the first to post!'}
          </div>
        )}
        {visible < threads.length && (
          <button type="button" className="btn btn-secondary w-full" onClick={() => setVisible((v) => v + PAGE)}>
            Load More
          </button>
        )}
      </section>

      <section className="forum-card overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--color-border)] dark:border-[#2a3542] font-semibold flex items-center justify-between">
          <span>Our Top Forums</span>
          <Link to="/forums" className="text-sm text-[var(--color-brand)] hover:underline">
            View All
          </Link>
        </div>
        <div className="grid sm:grid-cols-2 gap-0 divide-y sm:divide-y-0 dark:divide-[#2a3542]">
          {state.categories.map((c) => (
            <Link
              key={c.id}
              to={`/forums#${c.id}`}
              className="p-4 hover:bg-[var(--color-brand-soft)]/50 dark:hover:bg-[#243040] border-b sm:border-b border-[var(--color-border)] dark:border-[#2a3542]"
            >
              <div className="font-semibold text-[var(--color-brand)]">{c.name}</div>
              <p className="text-sm prose-muted mt-1 line-clamp-2">{c.description}</p>
              <div className="text-xs prose-muted mt-2">
                {c.threadCount} threads · {c.postCount} messages
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}
