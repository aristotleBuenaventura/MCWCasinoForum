import { Bookmark, ChevronDown, ChevronUp, MessageCircle, Search, Share2, Star } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Avatar } from '../components/Avatar'
import { Username } from '../components/Username'
import { DocumentTitle } from '../components/DocumentTitle'
import { ForumImage } from '../components/ForumMedia'
import { useToast } from '../components/Toast'
import { useForum } from '../context/ForumContext'
import { localizeCategoryName } from '../i18n/messages'
import { useLocale } from '../i18n/locale'
import { api } from '../lib/api'
import { ART, GUIDE_ART, REVIEW_ART, WIN_ART } from '../data/artwork'
import { prefetchCommunity } from '../lib/communityPrefetch'
import { readHomeExtrasCache, writeHomeExtrasCache } from '../lib/homeExtrasCache'
import { takePrefetchedHomeExtras } from '../lib/homeExtrasPrefetch'
import { readHomeFeedCache, writeHomeFeedCache } from '../lib/homeFeedCache'
import { takePrefetchedHomeFeed } from '../lib/homeFeedPrefetch'
import { DragScrollRow } from '../components/DragScrollRow'
import { brandCommunityCards } from '../lib/providerCommunity'
import { prefetchThread } from '../lib/threadPrefetch'
import { timeAgo } from '../lib/utils'
import type { Thread, User } from '../types'

type FeedTab = 'popular' | 'trending' | 'latest' | 'saved'

function FeedItemSkeleton() {
  return (
    <article className="forum-card px-3 py-2.5 animate-pulse" aria-hidden="true">
      <div className="flex gap-2.5">
        <div className="vote-col pt-0.5 space-y-1">
          <div className="h-3 w-3 mx-auto rounded bg-[var(--color-panel-2)]" />
          <div className="h-3 w-5 mx-auto rounded bg-[var(--color-panel-2)]" />
          <div className="h-3 w-3 mx-auto rounded bg-[var(--color-panel-2)]" />
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="h-3.5 w-3/4 max-w-md rounded bg-[var(--color-panel-2)]" />
          <div className="h-2.5 w-full max-w-lg rounded bg-[var(--color-panel-2)]" />
          <div className="h-2.5 w-48 rounded bg-[var(--color-panel-2)]" />
        </div>
      </div>
    </article>
  )
}

function CardSkeleton({ imageH = 'h-24' }: { imageH?: string }) {
  return (
    <div className="forum-card overflow-hidden animate-pulse" aria-hidden="true">
      <div className={`${imageH} w-full bg-[var(--color-panel-2)]`} />
      <div className="p-2.5 space-y-2">
        <div className="h-3 w-4/5 rounded bg-[var(--color-panel-2)]" />
        <div className="h-2.5 w-24 rounded bg-[var(--color-panel-2)]" />
      </div>
    </div>
  )
}

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
  const { t, lang } = useLocale()
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
      toast(t('thread.loginToVote'))
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
      toast(t('common.linkCopied'))
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
          <Link
            to={`/thread/${thread.id}`}
            className="block text-[14px] font-semibold leading-snug gold-text hover:underline"
            onMouseEnter={() => prefetchThread(thread.id, { lang, limit: 20 })}
            onFocus={() => prefetchThread(thread.id, { lang, limit: 20 })}
            onPointerDown={() => prefetchThread(thread.id, { lang, limit: 20 })}
          >
            {thread.title}
          </Link>
          <p className="text-[12px] prose-muted mt-1 line-clamp-1">{thread.content}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] prose-muted">
            <Avatar user={author} size={16} />
            <Username user={author} label="username" />
            <span>· {timeAgo(thread.createdAt, lang)}</span>
            <Link to={`/communities/${forum?.slug}`} className="gold-text">
              {forum ? localizeCategoryName(forum.slug, forum.name, lang) : ''}
            </Link>
            {thread.solved && <span className="badge">{t('home.acceptedAnswer')}</span>}
            {rating && <Stars value={rating} />}
            <Link to={`/thread/${thread.id}`} className="inline-flex items-center gap-1 ml-auto hover:text-[var(--color-gold)]">
              <MessageCircle size={12} /> {replies}
            </Link>
            <button type="button" className="inline-flex items-center gap-1 hover:text-[var(--color-gold)]" onClick={share}>
              <Share2 size={12} /> {t('common.share')}
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
            {thread.unread && currentUser && <span className="text-[var(--color-gold)]">{t('common.unread')}</span>}
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
  const [extrasReady, setExtrasReady] = useState(false)
  const members = memberCount

  // Feed first, then extras. Fresh session cache → no network; otherwise prefetch/API once.
  useEffect(() => {
    let cancelled = false

    const cachedFeed = readHomeFeedCache(tab, lang)
    const feedFresh = Boolean(cachedFeed?.length)
    if (feedFresh && cachedFeed) {
      setFeed(cachedFeed)
      setFeedReady(true)
      cacheThreads(cachedFeed)
      cacheUsers(cachedFeed.map((t) => t.author).filter((u): u is User => Boolean(u)))
    } else {
      setFeed([])
      setFeedReady(false)
    }

    const cachedExtras = readHomeExtrasCache(lang)
    const extrasFresh = Boolean(cachedExtras)
    if (cachedExtras) {
      setReviews(cachedExtras.reviews)
      setGuides(cachedExtras.guides)
      setBigWins(cachedExtras.wins)
      setWeekly(cachedExtras.weekly)
      setExtrasReady(true)
      cacheThreads([...cachedExtras.reviews, ...cachedExtras.guides, ...cachedExtras.wins])
      cacheUsers(
        [...cachedExtras.reviews, ...cachedExtras.guides, ...cachedExtras.wins]
          .map((t) => t.author)
          .filter((u): u is User => Boolean(u)),
      )
    } else {
      setReviews([])
      setGuides([])
      setBigWins([])
      setWeekly([])
      setExtrasReady(false)
    }

    if (feedFresh && extrasFresh) {
      return () => {
        cancelled = true
      }
    }

    void (async () => {
      if (!feedFresh) {
        const prefetched = takePrefetchedHomeFeed(tab, lang)
        let feedThreads: Thread[] = []
        if (prefetched) {
          feedThreads = await prefetched
        } else {
          const feedRes = await api<{ feed: { threads: Thread[] } }>(
            `/api/home?tab=${encodeURIComponent(tab)}&sections=feed`,
          )
          if (cancelled) return
          if (!feedRes.ok) {
            setFeedReady(true)
            return
          }
          feedThreads = feedRes.feed?.threads ?? []
        }
        if (cancelled) return
        setFeed(feedThreads)
        writeHomeFeedCache(tab, lang, feedThreads)
        cacheThreads(feedThreads)
        cacheUsers(feedThreads.map((t) => t.author).filter((u): u is User => Boolean(u)))
        setFeedReady(true)
      }

      if (extrasFresh) return

      const prefetchedExtras = takePrefetchedHomeExtras(lang)
      const extrasRes = prefetchedExtras
        ? await prefetchedExtras.then((extras) => ({ ok: true as const, ...extras }))
        : await api<{
            reviews: Thread[]
            guides: Thread[]
            wins: Thread[]
            weekly: { user: User | null; replies: number }[]
          }>(`/api/home?tab=${encodeURIComponent(tab)}&sections=extras`)
      if (cancelled || !extrasRes.ok) {
        setExtrasReady(true)
        return
      }
      const nextReviews = extrasRes.reviews ?? []
      const nextGuides = extrasRes.guides ?? []
      const nextWins = extrasRes.wins ?? []
      const nextWeekly = extrasRes.weekly ?? []
      setReviews(nextReviews)
      setGuides(nextGuides)
      setBigWins(nextWins)
      setWeekly(nextWeekly)
      writeHomeExtrasCache(lang, {
        reviews: nextReviews,
        guides: nextGuides,
        wins: nextWins,
        weekly: nextWeekly,
      })
      cacheThreads([...nextReviews, ...nextGuides, ...nextWins])
      cacheUsers(
        [...nextReviews, ...nextGuides, ...nextWins]
          .map((t) => t.author)
          .filter((u): u is User => Boolean(u)),
      )
      setExtrasReady(true)
    })()

    return () => {
      cancelled = true
    }
  }, [tab, lang, cacheThreads, cacheUsers])

  const filteredReviews = reviews.filter(
    (t) =>
      t.title.toLowerCase().includes(reviewQuery.toLowerCase()) ||
      t.tags.some((tag) => tag.toLowerCase().includes(reviewQuery.toLowerCase())),
  )
  const providers = [...state.providers].sort((a, b) => a.order - b.order).slice(0, 5)
  const brandCards = useMemo(
    () => brandCommunityCards(state.providers, state.categories, 28),
    [state.providers, state.categories],
  )
  const bonusesCategory = state.categories.find((c) => c.slug === 'bonuses')

  const countBySlug = (...slugs: string[]) =>
    state.categories.filter((c) => slugs.includes(c.slug)).reduce((n, c) => n + c.threadCount, 0)
  const activity = [
    { name: t('home.jiliGames'), count: countBySlug('jili') },
    { name: t('home.rtpDiscussions'), count: countBySlug('rtp-volatility', 'pragmatic-play') },
    { name: t('home.casinoReviewsActivity'), count: countBySlug('casino-reviews') },
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
          <img src={ART.hero} alt="MCW Forum" className="h-[88px] w-[88px] rounded-xl object-cover shrink-0 border border-[#d7ae55]/40" />
          <div className="min-w-0">
            <h1 className="text-[18px] font-semibold gold-text leading-snug">
              {t('home.heroTitle')}
            </h1>
            <p className="text-[12px] prose-muted mt-1">
              {t('home.heroSub')}
            </p>
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              {!currentUser ? (
                <Link to="/register" className="btn btn-primary">{t('nav.register')}</Link>
              ) : (
                <Link to="/create" className="btn btn-primary">{t('nav.postThread')}</Link>
              )}
              <Link to="/communities" className="btn btn-secondary">{t('home.forumList')}</Link>
              <span className="text-[11px] prose-muted ml-1">{t('home.activeMembers', { n: members.toLocaleString() })}</span>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="section-title">{t('home.categoryCards')}</div>
          <Link to="/communities/game-providers" className="text-[11px] gold-text hover:underline">
            {t('home.viewAll')}
          </Link>
        </div>
        <DragScrollRow>
          {brandCards.map((c) => (
            <Link
              key={c.key}
              to={`/communities/${c.slug}`}
              draggable={false}
              className="forum-card p-2 flex flex-col items-center justify-center gap-1.5 min-h-[72px] hover:border-[var(--color-gold)]/40"
              onMouseEnter={() => prefetchCommunity(c.slug, { lang, limit: 20 })}
              onFocus={() => prefetchCommunity(c.slug, { lang, limit: 20 })}
            >
              {c.imageUrl ? (
                <img
                  src={c.imageUrl}
                  alt={localizeCategoryName(c.slug, c.name, lang)}
                  className="h-10 w-full max-w-[7rem] object-contain pointer-events-none"
                  loading="lazy"
                  decoding="async"
                  draggable={false}
                />
              ) : (
                <span className="text-[13px] font-semibold gold-text text-center">
                  {localizeCategoryName(c.slug, c.name, lang)}
                </span>
              )}
            </Link>
          ))}
          {bonusesCategory && (
            <Link
              to="/communities/bonuses"
              draggable={false}
              className="forum-card p-2 flex flex-col items-center justify-center gap-1.5 min-h-[72px] hover:border-[var(--color-gold)]/40"
              onMouseEnter={() => prefetchCommunity('bonuses', { lang, limit: 20 })}
              onFocus={() => prefetchCommunity('bonuses', { lang, limit: 20 })}
            >
              <img
                src={ART.logoBonus}
                alt={t('home.bonusesCommunity')}
                className="h-10 w-full max-w-[7rem] object-contain pointer-events-none"
                loading="lazy"
                decoding="async"
                draggable={false}
              />
            </Link>
          )}
        </DragScrollRow>
      </section>

      <section className="space-y-2" aria-busy={!feedReady && feed.length === 0}>
        <div className="flex items-center justify-between gap-2 px-0.5">
          <div className="section-title">
            {t('home.feedTitle')}
            <span className="ml-2 text-[11px] font-normal prose-muted">
              {tab === 'popular'
                ? t('rail.popular')
                : tab === 'trending'
                  ? t('rail.trending')
                  : tab === 'saved'
                    ? t('rail.saved')
                    : t('rail.latest')}
            </span>
          </div>
          <Link to="/communities" className="text-[11px] gold-text hover:underline">
            {t('home.viewMoreDiscussions')}
          </Link>
        </div>
        {!feedReady && feed.length === 0 && (
          <>
            <span className="sr-only">{t('home.loading')}</span>
            <FeedItemSkeleton />
            <FeedItemSkeleton />
            <FeedItemSkeleton />
            <FeedItemSkeleton />
          </>
        )}
        {feed.map((item) => (
          <FeedItem key={item.id} thread={item} />
        ))}
        {feedReady && feed.length === 0 && (
          <div className="forum-card p-5 text-center prose-muted text-sm">
            {tab === 'saved' ? t('home.bookmarkHint') : t('home.noThreads')}
          </div>
        )}
      </section>

      <section>
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="section-title">{t('home.latestReviews')}</div>
          <div className="flex items-center gap-1.5">
            <div className="relative">
              <Search size={12} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 prose-muted" />
              <input
                value={reviewQuery}
                onChange={(e) => setReviewQuery(e.target.value)}
                placeholder={t('home.search')}
                className="input h-7 w-32 pl-7 text-[12px]"
              />
            </div>
            <Link to="/communities/casino-reviews" className="btn btn-secondary h-7 text-[11px]">{t('home.filter')}</Link>
          </div>
        </div>
        <div className="grid md:grid-cols-3 gap-2">
          {!extrasReady && reviews.length === 0 && (
            <>
              <CardSkeleton />
              <CardSkeleton />
              <CardSkeleton />
            </>
          )}
          {filteredReviews.map((item) => (
            <Link key={item.id} to={`/thread/${item.id}`} className="forum-card overflow-hidden hover:border-[var(--color-gold)]/40">
              <ForumImage url={item.mediaUrl} fallback={REVIEW_ART[item.id]} className="h-24 w-full object-cover" />
              <div className="p-2.5">
                <div className="text-[13px] font-semibold gold-text line-clamp-2">{item.title.replace(/ review.*/i, '')}</div>
                <div className="mt-1"><Stars /></div>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {(item.tags.length ? item.tags : [t('home.communityReview')]).map((tag) => (
                    <span key={tag} className="tag">{tag}</span>
                  ))}
                </div>
                <div className="mt-2 text-[11px] gold-text">{t('home.readReview')}</div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <div className="section-title mb-2">{t('home.guides')}</div>
        <div className="grid md:grid-cols-3 gap-2">
          {!extrasReady && guides.length === 0 && (
            <>
              <CardSkeleton imageH="h-[72px]" />
              <CardSkeleton imageH="h-[72px]" />
              <CardSkeleton imageH="h-[72px]" />
            </>
          )}
          {guides.map((item) => (
            <Link key={item.id} to={`/thread/${item.id}`} className="forum-card overflow-hidden hover:border-[var(--color-gold)]/40">
              <ForumImage url={item.mediaUrl} fallback={GUIDE_ART[item.id]} className="h-[72px] w-full object-cover" />
              <div className="p-2.5">
                <div className="text-[13px] font-semibold gold-text leading-snug">{item.title}</div>
                <div className="text-[11px] prose-muted mt-1">{t('home.reads', { n: item.views })}</div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="grid md:grid-cols-2 gap-2">
        <div className="forum-card p-3">
          <div className="section-title mb-2">{t('home.weekly')}</div>
          <ul className="space-y-2">
            {weekly.map(({ user, replies }, rank) =>
              user ? (
                <li key={user.id} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Link to={`/profile/${user.username}`} className="shrink-0">
                      <Avatar user={user} size={28} />
                    </Link>
                    <div className="min-w-0">
                      <span className="xf-notable-name text-[13px]">
                        <Username user={user} />
                      </span>
                      <div className="text-[10px] prose-muted">
                        {rank === 0 ? t('home.reviewerMonth') : rank === 1 ? t('home.highRoller') : t('home.communityVoice')}
                      </div>
                    </div>
                  </div>
                  <span className="text-[12px] gold-text tabular-nums shrink-0">{replies}</span>
                </li>
              ) : null,
            )}
            {extrasReady && weekly.filter((w) => w.user).length === 0 && (
              <li className="text-[12px] prose-muted">{t('home.weeklyEmpty')}</li>
            )}
            {!extrasReady && weekly.length === 0 && (
              <li className="space-y-2 animate-pulse" aria-hidden="true">
                <div className="h-8 rounded bg-[var(--color-panel-2)]" />
                <div className="h-8 rounded bg-[var(--color-panel-2)]" />
                <div className="h-8 rounded bg-[var(--color-panel-2)]" />
              </li>
            )}
          </ul>
        </div>
        <div className="forum-card p-3">
          <div className="section-title mb-2">{t('home.bigWinShowcases')}</div>
          <ul className="space-y-2">
            {bigWins.slice(0, 3).map((item) => {
              const author = item.author || state.users.find((u) => u.id === item.authorId)
              return (
                <li key={item.id}>
                  <Link to={`/thread/${item.id}`} className="flex items-center justify-between gap-2">
                    <span className="text-[13px] line-clamp-1"><Username user={author} link={false} /></span>
                    <span className="text-[12px] gold-text shrink-0">{item.views}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
          <div className="mt-3">
            <div className="section-title mb-2">{t('home.communityActivity')}</div>
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
            <div className="section-title">{t('home.wins')}</div>
            <Link to="/communities/big-wins" className="text-[11px] gold-text">{t('home.viewAll')}</Link>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {!extrasReady && bigWins.length === 0 && (
              <>
                <CardSkeleton imageH="h-20" />
                <CardSkeleton imageH="h-20" />
              </>
            )}
            {bigWins.slice(0, 4).map((item) => (
              <Link key={item.id} to={`/thread/${item.id}`} className="forum-card overflow-hidden hover:border-[var(--color-gold)]/40">
                <ForumImage url={item.mediaUrl} fallback={WIN_ART[item.id]} className="h-20 w-full object-cover" />
                <div className="p-2 text-[11px] font-medium line-clamp-2">{item.title}</div>
              </Link>
            ))}
          </div>
        </div>
        <div>
          <div className="section-title mb-2">{t('home.providers')}</div>
          <div className="space-y-2">
            {providers.map((p) => (
              <Link key={p.id} to={p.url || '/communities'} className="forum-card p-2 flex items-center gap-3 hover:border-[var(--color-gold)]/40">
                <img src={p.imageUrl} alt="" className="h-10 w-16 object-contain rounded bg-[var(--color-panel-2)] shrink-0" />
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
