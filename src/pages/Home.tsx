import { ChevronDown, ChevronUp, MessageCircle, Search, Share2, Star } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Avatar } from '../components/Avatar'
import { ForumImage } from '../components/ForumMedia'
import { useToast } from '../components/Toast'
import { useForum } from '../context/ForumContext'
import { ART, CATEGORY_LOGOS, GUIDE_ART, REVIEW_ART, WIN_ART } from '../data/artwork'
import { timeAgo } from '../lib/utils'
import type { Thread } from '../types'

type FeedTab = 'popular' | 'trending' | 'latest' | 'saved'

function Stars({ value = 4.8 }: { value?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5 text-[11px]">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} size={11} className="star" fill={i < Math.round(value) ? 'currentColor' : 'none'} />
      ))}
      <span className="ml-1 prose-muted">{value.toFixed(1)}</span>
    </span>
  )
}

function FeedItem({ thread }: { thread: Thread }) {
  const { getUser, state, likeCount, isLiked, toggleLike, currentUser } = useForum()
  const toast = useToast()
  const author = getUser(thread.authorId)
  const forum = state.categories.find((c) => c.id === thread.forumId)
  const replies = state.comments.filter((c) => c.threadId === thread.id).length
  const likes = likeCount('thread', thread.id)
  const liked = isLiked('thread', thread.id)
  const rating = thread.forumId === 'cat_pragmatic' ? 4.8 : null

  const vote = () => {
    if (!currentUser) {
      toast('Log in to vote')
      return
    }
    toggleLike('thread', thread.id)
  }

  const share = async () => {
    const url = `${window.location.origin}/thread/${thread.id}`
    try {
      await navigator.clipboard.writeText(url)
      toast('Link copied')
    } catch {
      toast(url)
    }
  }

  return (
    <article className="forum-card px-3 py-2.5">
      <div className="flex gap-2.5">
        <div className="vote-col pt-0.5">
          <button type="button" className={liked ? 'text-[var(--color-gold)]' : ''} onClick={vote} aria-label="Upvote">
            <ChevronUp size={16} />
          </button>
          <span>{likes}</span>
          <button type="button" onClick={() => liked && vote()} aria-label="Remove vote">
            <ChevronDown size={16} />
          </button>
        </div>
        <div className="min-w-0 flex-1">
          <Link to={`/thread/${thread.id}`} className="block text-[14px] font-semibold leading-snug hover:text-[var(--color-gold)]">
            {thread.title}
          </Link>
          <p className="text-[12px] prose-muted mt-1 line-clamp-1">{thread.content}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] prose-muted">
            <Avatar user={author} size={16} />
            <Link to={`/profile/${author?.username}`} className="hover:text-[var(--color-gold)]">{author?.username}</Link>
            <span>· {timeAgo(thread.createdAt)}</span>
            <Link to={`/communities/${forum?.slug}`} className="gold-text">{forum?.name}</Link>
            {thread.solved && <span className="badge">Accepted answer</span>}
            {rating && <Stars value={rating} />}
            <Link to={`/thread/${thread.id}`} className="inline-flex items-center gap-1 ml-auto hover:text-[var(--color-gold)]">
              <MessageCircle size={12} /> {replies}
            </Link>
            <button type="button" className="inline-flex items-center gap-1 hover:text-[var(--color-gold)]" onClick={share}>
              <Share2 size={12} /> Share
            </button>
          </div>
        </div>
      </div>
    </article>
  )
}

export function Home() {
  const { state, currentUser, likeCount } = useForum()
  const [params] = useSearchParams()
  const tab = ((params.get('feed') as FeedTab) || 'latest')
  const [reviewQuery, setReviewQuery] = useState('')
  const members = state.users.filter((u) => !u.banned).length

  const engagement = (t: Thread) =>
    likeCount('thread', t.id) + state.comments.filter((c) => c.threadId === t.id).length

  const feed = useMemo(() => {
    const skip = new Set(['cat_guides', 'cat_bigwins', 'cat_responsible'])
    let list = state.threads.filter((t) => !skip.has(t.forumId))
    const spotlight = ['thread_mahjong', 'thread_cashout', 'thread_olympus']
    if (tab === 'latest') {
      const picked = spotlight.map((id) => list.find((t) => t.id === id)).filter(Boolean) as Thread[]
      if (picked.length) return picked
    }
    if (tab === 'saved' && currentUser) {
      const liked = new Set(
        state.likes.filter((l) => l.userId === currentUser.id && l.targetType === 'thread').map((l) => l.targetId),
      )
      list = list.filter((t) => liked.has(t.id))
    }
    if (tab === 'popular') list.sort((a, b) => engagement(b) - engagement(a))
    else if (tab === 'trending') {
      list.sort((a, b) => engagement(b) * 2 - (+new Date(b.createdAt) - +new Date(a.createdAt)) / 3.6e6)
    } else {
      list.sort((a, b) => Number(b.pinned) - Number(a.pinned) || +new Date(b.createdAt) - +new Date(a.createdAt))
    }
    return list.slice(0, 3)
  }, [state.threads, state.likes, state.comments, tab, currentUser])

  const reviews = ['thread_spin_palace', 'thread_casino_royale', 'thread_mega_jackpot']
    .map((id) => state.threads.find((t) => t.id === id))
    .filter((t): t is Thread => !!t)
    .filter((t) => t.title.toLowerCase().includes(reviewQuery.toLowerCase()) || t.tags.some((tag) => tag.toLowerCase().includes(reviewQuery.toLowerCase())))

  const guides = state.threads.filter((t) => t.forumId === 'cat_guides').slice(0, 3)
  const bigWins = state.threads.filter((t) => t.forumId === 'cat_bigwins').slice(0, 6)
  const providers = [...state.providers].sort((a, b) => a.order - b.order)

  const replyCounts = new Map<string, number>()
  for (const c of state.comments) replyCounts.set(c.authorId, (replyCounts.get(c.authorId) ?? 0) + 1)
  const weekly = [...replyCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([id, replies], i) => ({ user: state.users.find((u) => u.id === id), replies, rank: i }))

  const activity = [
    { name: 'JILI Games', count: state.threads.filter((t) => t.forumId === 'cat_jili').length },
    { name: 'RTP Discussions', count: state.threads.filter((t) => t.forumId === 'cat_rtp' || t.forumId === 'cat_pragmatic').length },
    { name: 'Casino Reviews', count: state.threads.filter((t) => t.forumId === 'cat_reviews').length },
  ]
  const maxActivity = Math.max(...activity.map((a) => a.count), 1)

  return (
    <div className="space-y-3">
      <section className="forum-card overflow-hidden">
        <div className="flex items-center gap-4 px-4 py-3">
          <img src={ART.hero} alt="MCW casino crest" className="h-[88px] w-[88px] rounded-full object-cover shrink-0 border border-[#d7ae55]/40" />
          <div className="min-w-0">
            <h1 className="text-[22px] md:text-[26px] font-extrabold gold-text leading-tight tracking-wide">
              THE GRAND FORUM FOR<br className="hidden md:block" /> ONLINE CASINO PLAYERS
            </h1>
            <p className="text-[12px] prose-muted mt-1">
              Discuss, review and share strategies with a verified player community.
            </p>
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              {!currentUser ? (
                <Link to="/register" className="btn btn-primary">Join the Community</Link>
              ) : (
                <Link to="/create" className="btn btn-primary">Create Post</Link>
              )}
              <Link to="/communities" className="btn btn-secondary">Explore Discussions</Link>
              <span className="text-[11px] prose-muted ml-1">Active members {members.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="section-title mb-2">Category cards</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {CATEGORY_LOGOS.map((c) => (
            <Link key={c.slug} to={`/communities/${c.slug}`} className="forum-card p-1.5 hover:border-[var(--color-gold)]/40">
              <img src={c.src} alt={c.name} className="h-14 w-full object-cover rounded-md" />
            </Link>
          ))}
        </div>
      </section>

      <section className="space-y-2">
        {feed.map((t) => <FeedItem key={t.id} thread={t} />)}
        {feed.length === 0 && (
          <div className="forum-card p-5 text-center prose-muted text-sm">
            {tab === 'saved' ? 'Like threads to save them here.' : 'No threads yet.'}
          </div>
        )}
      </section>

      <section>
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="section-title">Latest casino reviews</div>
          <div className="flex items-center gap-1.5">
            <div className="relative">
              <Search size={12} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[#929cb3]" />
              <input
                value={reviewQuery}
                onChange={(e) => setReviewQuery(e.target.value)}
                placeholder="Search"
                className="input h-7 w-32 pl-7 text-[12px]"
              />
            </div>
            <Link to="/communities/casino-reviews" className="btn btn-secondary h-7 text-[11px]">Filter</Link>
          </div>
        </div>
        <div className="grid md:grid-cols-3 gap-2">
          {reviews.map((t) => (
            <Link key={t.id} to={`/thread/${t.id}`} className="forum-card overflow-hidden hover:border-[var(--color-gold)]/40">
              <ForumImage url={t.mediaUrl} fallback={REVIEW_ART[t.id]} className="h-24 w-full object-cover" />
              <div className="p-2.5">
                <div className="text-[13px] font-semibold line-clamp-2">{t.title.replace(/ review.*/i, '')}</div>
                <div className="mt-1"><Stars /></div>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {(t.tags.length ? t.tags : ['Community Review']).map((tag) => (
                    <span key={tag} className="tag">{tag}</span>
                  ))}
                </div>
                <div className="mt-2 text-[11px] gold-text">Read Full Review</div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <div className="section-title mb-2">Community guides & resources</div>
        <div className="grid md:grid-cols-3 gap-2">
          {guides.map((t) => (
            <Link key={t.id} to={`/thread/${t.id}`} className="forum-card overflow-hidden hover:border-[var(--color-gold)]/40">
              <ForumImage url={t.mediaUrl} fallback={GUIDE_ART[t.id]} className="h-[72px] w-full object-cover" />
              <div className="p-2.5">
                <div className="text-[13px] font-semibold leading-snug">{t.title}</div>
                <div className="text-[11px] prose-muted mt-1">{t.views} reads</div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="grid md:grid-cols-2 gap-2">
        <div className="forum-card p-3">
          <div className="section-title mb-2">Weekly top contributors</div>
          <ul className="space-y-2">
            {weekly.map(({ user, replies, rank }) =>
              user ? (
                <li key={user.id} className="flex items-center justify-between gap-2">
                  <Link to={`/profile/${user.username}`} className="flex items-center gap-2 min-w-0">
                    <Avatar user={user} size={28} />
                    <div className="min-w-0">
                      <div className="text-[13px] truncate">{user.displayName}</div>
                      <div className="text-[10px] prose-muted">
                        {rank === 0 ? 'Reviewer of the Month' : rank === 1 ? 'High Roller Tier' : 'Community Voice'}
                      </div>
                    </div>
                  </Link>
                  <span className="text-[12px] gold-text tabular-nums">{replies}</span>
                </li>
              ) : null,
            )}
          </ul>
        </div>
        <div className="forum-card p-3">
          <div className="section-title mb-2">Big win showcases</div>
          <ul className="space-y-2">
            {bigWins.slice(0, 3).map((t) => {
              const author = state.users.find((u) => u.id === t.authorId)
              return (
                <li key={t.id}>
                  <Link to={`/thread/${t.id}`} className="flex items-center justify-between gap-2">
                    <span className="text-[13px] line-clamp-1">{author?.displayName}</span>
                    <span className="text-[12px] gold-text shrink-0">{t.views}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
          <div className="mt-3">
            <div className="section-title mb-2">Community activity</div>
            {activity.map((a) => (
              <div key={a.name} className="mb-1.5">
                <div className="flex justify-between text-[11px] mb-0.5">
                  <span className="prose-muted">{a.name}</span>
                  <span>{a.count}</span>
                </div>
                <div className="h-1.5 rounded bg-[#0e1526] overflow-hidden">
                  <div className="h-full bg-[var(--color-gold)]" style={{ width: `${(a.count / maxActivity) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid md:grid-cols-2 gap-2">
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="section-title">Live community wins & screenshots</div>
            <Link to="/communities/big-wins" className="text-[11px] gold-text">View all</Link>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {bigWins.slice(0, 4).map((t) => (
              <Link key={t.id} to={`/thread/${t.id}`} className="forum-card overflow-hidden hover:border-[var(--color-gold)]/40">
                <ForumImage url={t.mediaUrl} fallback={WIN_ART[t.id]} className="h-20 w-full object-cover" />
                <div className="p-2 text-[11px] font-medium line-clamp-2">{t.title}</div>
              </Link>
            ))}
          </div>
        </div>
        <div>
          <div className="section-title mb-2">Top game providers</div>
          <div className="space-y-2">
            {providers.map((p) => (
              <Link key={p.id} to={p.url || '/communities'} className="forum-card p-2 flex items-center gap-3 hover:border-[var(--color-gold)]/40">
                <img src={p.imageUrl} alt="" className="h-10 w-16 object-cover rounded" />
                <div>
                  <div className="text-[13px] font-semibold">{p.name}</div>
                  <Stars value={p.rating} />
                </div>
              </Link>
            ))}
            <Link to="/communities/game-providers" className="btn btn-secondary w-full">View All Providers</Link>
          </div>
        </div>
      </section>
    </div>
  )
}
