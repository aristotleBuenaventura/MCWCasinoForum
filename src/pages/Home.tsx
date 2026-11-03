import { Bookmark, ChevronDown, ChevronUp, MessageCircle, Search, Share2, Star } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Avatar } from '../components/Avatar'
import { Username } from '../components/Username'
import { DocumentTitle } from '../components/DocumentTitle'
import { ForumImage } from '../components/ForumMedia'
import { useToast } from '../components/Toast'
import { useForum } from '../context/ForumContext'
import { useLocale } from '../i18n/locale'
import { api } from '../lib/api'
import { ART, CATEGORY_LOGOS, GUIDE_ART, REVIEW_ART, WIN_ART } from '../data/artwork'
import { timeAgo } from '../lib/utils'
import type { Thread, User } from '../types'

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
  const { state, toggleLike, currentUser, toggleBookmark } = useForum()
  const toast = useToast()
  const [liked, setLiked] = useState(!!thread.liked)
  const [likes, setLikes] = useState(thread.likeCount || 0)
  const [saved, setSaved] = useState(!!thread.bookmarked)
  const author = thread.author
  const forum = state.categories.find((c) => c.id === thread.forumId)
  const replies = thread.replyCount || 0
  const rating = thread.forumId === 'cat_pragmatic' ? 4.8 : null

  const vote = () => {
    if (!currentUser) {
      toast('Log in to vote')
      return
    }
    setLiked((v) => !v)
    setLikes((n) => n + (liked ? -1 : 1))
    toggleLike('thread', thread.id)
  }

  const share = async () => {
    const path = window.location.pathname.startsWith('/bn') ? `/bn/thread/${thread.id}` : `/thread/${thread.id}`
    const url = `${window.location.origin}${path}`
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
          <Link to={`/thread/${thread.id}`} className="block text-[14px] font-semibold leading-snug gold-text hover:underline">
            {thread.title}
          </Link>
          <p className="text-[12px] prose-muted mt-1 line-clamp-1">{thread.content}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] prose-muted">
            <Avatar user={author} size={16} />
            <Username user={author} label="username" />
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
            {currentUser && (
              <button
                type="button"
                className={`inline-flex items-center gap-1 ${saved ? 'text-[var(--color-gold)]' : ''}`}
                onClick={() => {
                  void toggleBookmark(thread.id).then((on) => setSaved(on))
                }}
                aria-label="Bookmark"
              >
                <Bookmark size={12} />
              </button>
            )}
            {thread.unread && currentUser && <span className="text-[var(--color-gold)]">Unread</span>}
          </div>
        </div>
      </div>
    </article>
  )
}

export function Home() {
  const { state, currentUser, memberCount, cacheThreads, cacheUsers } = useForum()
  const { t, lang } = useLocale()
  const [params] = useSearchParams()
  const tab = ((params.get('feed') as FeedTab) || 'latest')
  const [reviewQuery, setReviewQuery] = useState('')
  const [feed, setFeed] = useState<Thread[]>([])
  const [reviews, setReviews] = useState<Thread[]>([])
  const [guides, setGuides] = useState<Thread[]>([])
  const [bigWins, setBigWins] = useState<Thread[]>([])
  const [weekly, setWeekly] = useState<{ user: User | null; replies: number }[]>([])
  const [feedReady, setFeedReady] = useState(false)
  const members = memberCount

  useEffect(() => {
    setFeedReady(false)
    void api<{
      feed: { threads: Thread[] }
      reviews: Thread[]
      guides: Thread[]
      wins: Thread[]
      weekly: { user: User | null; replies: number }[]
    }>(`/api/home?tab=${encodeURIComponent(tab)}`).then((res) => {
      if (!res.ok) {
        setFeedReady(true)
        return
      }
      const feedThreads = res.feed?.threads ?? []
      const nextReviews = res.reviews ?? []
      const nextGuides = res.guides ?? []
      const nextWins = res.wins ?? []
      const nextWeekly = res.weekly ?? []
      setFeed(feedThreads)
      setReviews(nextReviews)
      setGuides(nextGuides)
      setBigWins(nextWins)
      setWeekly(nextWeekly)
      cacheThreads([...feedThreads, ...nextReviews, ...nextGuides, ...nextWins])
      cacheUsers(
        [...feedThreads, ...nextReviews, ...nextGuides, ...nextWins]
          .map((t) => t.author)
          .filter((u): u is User => Boolean(u)),
      )
      setFeedReady(true)
    })
  }, [tab, cacheThreads, cacheUsers])

  const filteredReviews = reviews.filter(
    (t) =>
      t.title.toLowerCase().includes(reviewQuery.toLowerCase()) ||
      t.tags.some((tag) => tag.toLowerCase().includes(reviewQuery.toLowerCase())),
  )
  const providers = [...state.providers].sort((a, b) => a.order - b.order)

  const countFor = (...ids: string[]) =>
    state.categories.filter((c) => ids.includes(c.id)).reduce((n, c) => n + c.threadCount, 0)
  const activity = [
    { name: 'JILI Games', count: countFor('cat_jili') },
    { name: 'RTP Discussions', count: countFor('cat_rtp', 'cat_pragmatic') },
    { name: 'Casino Reviews', count: countFor('cat_reviews') },
  ]
  const maxActivity = Math.max(...activity.map((a) => a.count), 1)

  return (
    <div className="space-y-3">
      <DocumentTitle
        title="MCW Casino Forum"
        description="Discuss slots, casino reviews, RTP, and bonuses with a verified player community."
      />
      <section className="forum-card overflow-hidden">
        <div className="flex items-center gap-4 px-4 py-3">
          <img src={ART.hero} alt="MCW casino crest" className="h-[88px] w-[88px] rounded-full object-cover shrink-0 border border-[#d7ae55]/40" />
          <div className="min-w-0">
            <h1 className="text-[18px] font-semibold gold-text leading-snug">
              {lang === 'bn'
                ? 'অনলাইন ক্যাসিনো খেলোয়াড়দের গ্র্যান্ড ফোরাম'
                : 'The grand forum for online casino players'}
            </h1>
            <p className="text-[12px] prose-muted mt-1">
              {lang === 'bn'
                ? 'যাচাইকৃত প্লেয়ার কমিউনিটির সাথে আলোচনা, রিভিউ ও স্ট্র্যাটেজি শেয়ার করুন।'
                : 'Discuss, review and share strategies with a verified player community.'}
            </p>
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              {!currentUser ? (
                <Link to="/register" className="btn btn-primary">{t('nav.register')}</Link>
              ) : (
                <Link to="/create" className="btn btn-primary">{t('nav.postThread')}</Link>
              )}
              <Link to="/communities" className="btn btn-secondary">{t('home.forumList')}</Link>
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
        {!feedReady && <div className="forum-card p-5 text-center prose-muted text-sm">Loading discussions…</div>}
        {feedReady && feed.map((t) => <FeedItem key={t.id} thread={t} />)}
        {feedReady && feed.length === 0 && (
          <div className="forum-card p-5 text-center prose-muted text-sm">
            {tab === 'saved' ? 'Bookmark threads to save them here.' : 'No threads yet.'}
          </div>
        )}
      </section>

      <section>
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="section-title">Latest casino reviews</div>
          <div className="flex items-center gap-1.5">
            <div className="relative">
              <Search size={12} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 prose-muted" />
              <input
                value={reviewQuery}
                onChange={(e) => setReviewQuery(e.target.value)}
                placeholder="Search"
                className="input h-7 w-32 pl-7 text-[12px]"
              />
            </div>
            <Link to="/communities/casino-reviews" className="btn btn-secondary h-7 text-[11px]">{t('home.filter')}</Link>
          </div>
        </div>
        <div className="grid md:grid-cols-3 gap-2">
          {filteredReviews.map((t) => (
            <Link key={t.id} to={`/thread/${t.id}`} className="forum-card overflow-hidden hover:border-[var(--color-gold)]/40">
              <ForumImage url={t.mediaUrl} fallback={REVIEW_ART[t.id]} className="h-24 w-full object-cover" />
              <div className="p-2.5">
                <div className="text-[13px] font-semibold gold-text line-clamp-2">{t.title.replace(/ review.*/i, '')}</div>
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
                <div className="text-[13px] font-semibold gold-text leading-snug">{t.title}</div>
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
            {weekly.map(({ user, replies }, rank) =>
              user ? (
                <li key={user.id} className="flex items-center justify-between gap-2">
                  <Link to={`/profile/${user.username}`} className="flex items-center gap-2 min-w-0">
                    <Avatar user={user} size={28} />
                    <div className="min-w-0">
                      <div className="text-[13px] truncate"><Username user={user} link={false} /></div>
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
              const author = t.author || state.users.find((u) => u.id === t.authorId)
              return (
                <li key={t.id}>
                  <Link to={`/thread/${t.id}`} className="flex items-center justify-between gap-2">
                    <span className="text-[13px] line-clamp-1"><Username user={author} link={false} /></span>
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
                <div className="h-1.5 rounded-sm bg-[#0e1526] overflow-hidden">
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
            <Link to="/communities/big-wins" className="text-[11px] gold-text">{t('home.viewAll')}</Link>
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
                  <div className="text-[13px] font-semibold gold-text">{p.name}</div>
                  <Stars value={p.rating} />
                </div>
              </Link>
            ))}
            <Link to="/communities/game-providers" className="btn btn-secondary w-full">{t('home.viewProviders')}</Link>
          </div>
        </div>
      </section>
    </div>
  )
}
