import { Pin, Star } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Avatar } from '../components/Avatar'
import { MediaOrPlaceholder } from '../components/Placeholder'
import { useForum } from '../context/ForumContext'
import { timeAgo } from '../lib/utils'
import type { Thread } from '../types'

type FeedTab = 'popular' | 'trending' | 'latest' | 'saved'

function Stars({ value = 4.8 }: { value?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5 text-xs">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} size={12} className="star" fill={i < Math.round(value) ? 'currentColor' : 'none'} />
      ))}
      <span className="ml-1 prose-muted">{value.toFixed(1)}</span>
    </span>
  )
}

function FeedItem({ thread }: { thread: Thread }) {
  const { getUser, state, likeCount } = useForum()
  const author = getUser(thread.authorId)
  const forum = state.categories.find((c) => c.id === thread.forumId)
  const replies = state.comments.filter((c) => c.threadId === thread.id).length
  const likes = likeCount('thread', thread.id)

  return (
    <article className="forum-card p-4">
      <div className="flex gap-3">
        <Avatar user={author} size={40} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 text-xs prose-muted">
            {thread.pinned && (
              <span className="inline-flex items-center gap-1 text-[var(--color-gold)]">
                <Pin size={11} /> Pinned
              </span>
            )}
            <Link to={`/communities/${forum?.slug}`} className="gold-text hover:underline">
              {forum?.name}
            </Link>
            <span>· {timeAgo(thread.createdAt)}</span>
          </div>
          <Link to={`/thread/${thread.id}`} className="block mt-1">
            <h3 className="font-semibold leading-snug hover:text-[var(--color-gold)]">{thread.title}</h3>
            <p className="text-sm prose-muted mt-1 line-clamp-2">{thread.content}</p>
          </Link>
          <div className="mt-2 flex gap-4 text-xs prose-muted">
            <span>{likes} likes</span>
            <span>{replies} replies</span>
            <span>{thread.views} views</span>
          </div>
        </div>
      </div>
    </article>
  )
}

export function Home() {
  const { state, currentUser, childCategories, likeCount } = useForum()
  const [tab, setTab] = useState<FeedTab>('latest')
  const providerChildren = childCategories('cat_providers')
  const featuredProviders = providerChildren.slice(0, 4)

  const engagement = (t: Thread) =>
    likeCount('thread', t.id) + state.comments.filter((c) => c.threadId === t.id).length

  const feed = useMemo(() => {
    let list = [...state.threads]
    if (tab === 'saved' && currentUser) {
      const liked = new Set(
        state.likes.filter((l) => l.userId === currentUser.id && l.targetType === 'thread').map((l) => l.targetId),
      )
      list = list.filter((t) => liked.has(t.id))
    }
    if (tab === 'popular') list.sort((a, b) => engagement(b) - engagement(a) || +new Date(b.createdAt) - +new Date(a.createdAt))
    else if (tab === 'trending') {
      list.sort((a, b) => {
        const recency = (t: Thread) => Date.now() - +new Date(t.createdAt)
        const score = (t: Thread) => engagement(t) * 1000 - recency(t) / 3600000
        return score(b) - score(a)
      })
    } else {
      list.sort((a, b) => Number(b.pinned) - Number(a.pinned) || +new Date(b.createdAt) - +new Date(a.createdAt))
    }
    return list.slice(0, 8)
  }, [state.threads, state.likes, state.comments, tab, currentUser])

  const reviews = state.threads
    .filter((t) => t.forumId === 'cat_reviews')
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
    .slice(0, 3)

  const guides = state.threads
    .filter((t) => t.forumId === 'cat_guides')
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
    .slice(0, 3)

  const bigWins = state.threads
    .filter((t) => t.forumId === 'cat_bigwins')
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || +new Date(b.createdAt) - +new Date(a.createdAt))
    .slice(0, 6)

  const providers = [...state.providers].sort((a, b) => a.order - b.order)
  const members = state.users.filter((u) => !u.banned).length

  const replyCounts = new Map<string, number>()
  for (const c of state.comments) replyCounts.set(c.authorId, (replyCounts.get(c.authorId) ?? 0) + 1)
  const weekly = [...replyCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([id, replies]) => ({ user: state.users.find((u) => u.id === id), replies }))

  const tabs: { id: FeedTab; label: string }[] = [
    { id: 'popular', label: 'Popular' },
    { id: 'trending', label: 'Trending' },
    { id: 'latest', label: 'Latest' },
    { id: 'saved', label: 'Saved' },
  ]

  return (
    <div className="space-y-5">
      <section className="forum-card overflow-hidden relative">
        <div className="absolute inset-0 opacity-30 pointer-events-none bg-[radial-gradient(circle_at_20%_20%,#d4b15f33,transparent_40%),radial-gradient(circle_at_80%_0%,#e08a2a22,transparent_35%)]" />
        <div className="relative p-6 md:p-8 flex flex-col md:flex-row md:items-center gap-6">
          <div className="w-24 h-24 rounded-2xl overflow-hidden shrink-0">
            <MediaOrPlaceholder label="Logo" className="w-full h-full" />
          </div>
          <div className="flex-1">
            <div className="section-title mb-2">The grand forum for</div>
            <h1 className="text-3xl md:text-4xl font-bold gold-text">Online Casino Players</h1>
            <p className="mt-2 prose-muted max-w-xl">
              Discuss, review and share strategies with a verified player community.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {!currentUser ? (
                <Link to="/register" className="btn btn-primary">Join the Community</Link>
              ) : (
                <Link to="/create" className="btn btn-primary">Create Post</Link>
              )}
              <Link to="/communities" className="btn btn-secondary">Explore Discussions</Link>
            </div>
            <div className="mt-4 text-xs prose-muted">Active members {members.toLocaleString()}</div>
          </div>
        </div>
      </section>

      <section>
        <div className="section-title mb-3">Category cards</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {featuredProviders.map((c) => (
            <Link key={c.id} to={`/communities/${c.slug}`} className="forum-card p-3 hover:border-[var(--color-gold-dim)]">
              <MediaOrPlaceholder label={c.name} className="h-16 rounded-lg mb-2 w-full" />
              <div className="text-sm font-semibold text-center">{c.name}</div>
            </Link>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`btn ${tab === t.id ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
        {feed.map((t) => (
          <FeedItem key={t.id} thread={t} />
        ))}
        {feed.length === 0 && (
          <div className="forum-card p-6 text-center prose-muted">
            {tab === 'saved' ? 'Like threads to save them here.' : 'No threads yet.'}
          </div>
        )}
      </section>

      <section>
        <div className="flex items-center justify-between mb-3">
          <div className="section-title">Latest casino reviews</div>
          <Link to="/communities/casino-reviews" className="text-xs gold-text hover:underline">View all</Link>
        </div>
        <div className="grid md:grid-cols-3 gap-3">
          {reviews.map((t) => (
            <Link key={t.id} to={`/thread/${t.id}`} className="forum-card overflow-hidden hover:border-[var(--color-gold-dim)]">
              <MediaOrPlaceholder src={t.mediaUrl} label="Review" className="h-28 w-full" />
              <div className="p-3">
                <div className="font-semibold text-sm line-clamp-2">{t.title}</div>
                <div className="mt-2"><Stars /></div>
                <div className="mt-3 text-xs gold-text">Read Full Review</div>
              </div>
            </Link>
          ))}
          {reviews.length === 0 && <div className="forum-card p-6 prose-muted col-span-full">No review threads yet.</div>}
        </div>
      </section>

      <section>
        <div className="section-title mb-3">Community guides & resources</div>
        <div className="grid md:grid-cols-3 gap-3">
          {guides.map((t) => (
            <Link key={t.id} to={`/thread/${t.id}`} className="forum-card p-4 hover:border-[var(--color-gold-dim)]">
              <MediaOrPlaceholder src={t.mediaUrl} label="Guide" className="h-20 w-full rounded-lg mb-3" />
              <div className="font-semibold text-sm">{t.title}</div>
              <p className="text-xs prose-muted mt-1 line-clamp-2">{t.content}</p>
            </Link>
          ))}
          {guides.length === 0 && <div className="forum-card p-6 prose-muted col-span-full">No guides yet.</div>}
        </div>
      </section>

      <section className="grid md:grid-cols-2 gap-3">
        <div className="forum-card p-4">
          <div className="section-title mb-3">Weekly top contributors</div>
          <ul className="space-y-3">
            {weekly.map(({ user, replies }) =>
              user ? (
                <li key={user.id} className="flex items-center justify-between">
                  <Link to={`/profile/${user.username}`} className="flex items-center gap-2">
                    <Avatar user={user} size={32} />
                    <span className="text-sm">{user.displayName}</span>
                  </Link>
                  <span className="text-xs prose-muted">{replies} replies</span>
                </li>
              ) : null,
            )}
          </ul>
        </div>
        <div className="forum-card p-4">
          <div className="section-title mb-3">Big win showcases</div>
          <ul className="space-y-2">
            {bigWins.slice(0, 3).map((t) => (
              <li key={t.id}>
                <Link to={`/thread/${t.id}`} className="text-sm hover:text-[var(--color-gold)] line-clamp-1">
                  {t.title}
                </Link>
              </li>
            ))}
            {bigWins.length === 0 && <li className="text-sm prose-muted">No win threads yet.</li>}
          </ul>
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-3">
          <div className="section-title">Live community wins & screenshots</div>
          <Link to="/communities/big-wins" className="text-xs gold-text hover:underline">View all</Link>
        </div>
        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
          {bigWins.map((t) => (
            <Link key={t.id} to={`/thread/${t.id}`} className="forum-card overflow-hidden hover:border-[var(--color-gold-dim)]">
              <MediaOrPlaceholder src={t.mediaUrl} label="Screenshot" className="h-28 w-full" />
              <div className="p-3 text-sm font-medium line-clamp-2">{t.title}</div>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <div className="section-title mb-3">Top game providers</div>
        <div className="grid sm:grid-cols-3 gap-3">
          {providers.map((p) => (
            <Link key={p.id} to={p.url || '/communities'} className="forum-card p-4 hover:border-[var(--color-gold-dim)]">
              <MediaOrPlaceholder src={p.imageUrl} label={p.name} className="h-20 w-full rounded-lg mb-3" />
              <div className="font-semibold">{p.name}</div>
              <Stars value={p.rating} />
            </Link>
          ))}
          {providers.length === 0 && <div className="forum-card p-6 prose-muted col-span-full">No providers set in admin.</div>}
        </div>
      </section>
    </div>
  )
}
