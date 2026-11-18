import { ChevronDown, Pin, ThumbsUp } from 'lucide-react'
import { startTransition, useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { Avatar } from '../components/Avatar'
import { Username } from '../components/Username'
import { DocumentTitle } from '../components/DocumentTitle'
import { LoginLink } from '../components/LoginModal'
import { useForum } from '../context/ForumContext'
import { localizeCategoryDesc, localizeCategoryName } from '../i18n/messages'
import { useLocale } from '../i18n/locale'
import { readCommunityCache } from '../lib/communityCache'
import { prefetchCommunity, takePrefetchedCommunity } from '../lib/communityPrefetch'
import { prefetchThread } from '../lib/threadPrefetch'
import { compactNumber, forumTime } from '../lib/utils'
import type { Thread } from '../types'

type SortKey = 'latest' | 'popular' | 'pinned'

const LIST_LIMIT = 20

function ThreadRowSkeleton() {
  return (
    <article className="thread-row animate-pulse" aria-hidden="true">
      <div className="h-8 w-8 rounded-full bg-[var(--color-panel-2)] shrink-0" />
      <div className="min-w-0 flex-1 space-y-2">
        <div className="h-3 w-3/4 max-w-md rounded bg-[var(--color-panel-2)]" />
        <div className="h-2.5 w-40 rounded bg-[var(--color-panel-2)]" />
      </div>
      <div className="stat-col hidden sm:block">
        <div className="h-3 w-10 rounded bg-[var(--color-panel-2)] ml-auto" />
      </div>
      <div className="stat-col hidden sm:block space-y-1">
        <div className="h-2.5 w-14 rounded bg-[var(--color-panel-2)] ml-auto" />
        <div className="h-2.5 w-12 rounded bg-[var(--color-panel-2)] ml-auto" />
      </div>
      <div className="last-col flex items-center justify-end gap-2">
        <div className="space-y-1">
          <div className="h-2.5 w-16 rounded bg-[var(--color-panel-2)] ml-auto" />
          <div className="h-2.5 w-12 rounded bg-[var(--color-panel-2)] ml-auto" />
        </div>
        <div className="h-[26px] w-[26px] rounded-full bg-[var(--color-panel-2)]" />
      </div>
    </article>
  )
}

export function CommunityDetail() {
  const { slug } = useParams()
  const [params, setParams] = useSearchParams()
  const [filtersOpen, setFiltersOpen] = useState(false)
  const sort = ((params.get('sort') as SortKey) || 'latest')
  const { getCategoryBySlug, childCategories, state, currentUser, cacheThreads } = useForum()
  const { t, lang } = useLocale()
  const category = getCategoryBySlug(slug || '')
  const children = category ? childCategories(category.id) : []

  const cachedForForum = useMemo(() => {
    if (!category) return [] as Thread[]
    const childIds = new Set(children.map((c) => c.id))
    const ids = new Set([category.id, ...childIds])
    return state.threads
      .filter((item) => ids.has(item.forumId))
      .slice(0, LIST_LIMIT)
  }, [category, children, state.threads])

  const [threads, setThreads] = useState<Thread[]>(cachedForForum)
  const [listReady, setListReady] = useState(cachedForForum.length > 0)

  // Keep list seeded if feed cache arrives before API
  useEffect(() => {
    if (!listReady && cachedForForum.length > 0) {
      setThreads(cachedForForum)
    }
  }, [cachedForForum, listReady])

  useEffect(() => {
    if (!slug) return
    let cancelled = false

    const sessionCached = readCommunityCache(slug, sort, lang)
    if (sessionCached) {
      setThreads(sessionCached)
      cacheThreads(sessionCached)
      setListReady(true)
      return () => {
        cancelled = true
      }
    }

    setListReady(false)

    const apply = (list: Thread[]) => {
      if (cancelled) return
      // Don't re-check `cancelled` inside startTransition — StrictMode cleanup
      // can flip it true after schedule and leave listReady stuck false.
      startTransition(() => {
        setThreads(list)
        cacheThreads(list)
        setListReady(true)
      })
    }

    const pending =
      takePrefetchedCommunity(slug, sort, lang) ||
      prefetchCommunity(slug, { sort, limit: LIST_LIMIT, lang })

    void pending.then((list) => {
      if (cancelled) return
      if (!list) {
        setListReady(true)
        return
      }
      apply(list)
    })

    return () => {
      cancelled = true
    }
  }, [slug, sort, lang, cacheThreads])

  if (!category) {
    // Categories still booting — show shell instead of "not found" flash
    if (!state.categories.length) {
      return (
        <div className="max-w-[1100px] mx-auto space-y-2">
          <div className="h-3 w-40 rounded bg-[var(--color-panel-2)] animate-pulse" />
          <div className="h-8 w-64 rounded bg-[var(--color-panel-2)] animate-pulse" />
          <div className="h-3 w-80 rounded bg-[var(--color-panel-2)] animate-pulse" />
          <section className="forum-list mt-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <ThreadRowSkeleton key={i} />
            ))}
          </section>
        </div>
      )
    }
    return (
      <div className="forum-card p-6 text-center max-w-[1100px] mx-auto">
        <p>{t('community.notFound')}</p>
        <Link to="/communities" className="btn btn-primary mt-3 inline-flex">{t('community.back')}</Link>
      </div>
    )
  }

  const parent = category.parentId ? state.categories.find((c) => c.id === category.parentId) : null
  const sticky = threads.filter((t) => t.pinned)
  const regular = threads.filter((t) => !t.pinned)
  const catName = localizeCategoryName(category.slug, category.name, lang)
  const catDesc = localizeCategoryDesc(category.slug, category.description, lang)
  const skeletonCount = Math.min(6, Math.max(3, category.threadCount || 4))

  const setSort = (value: SortKey) => {
    setParams(value === 'latest' ? {} : { sort: value })
    setFiltersOpen(false)
  }

  const sortLabel: Record<SortKey, string> = {
    latest: t('common.latest'),
    popular: t('common.popular'),
    pinned: t('common.pinned'),
  }

  return (
    <div className="max-w-[1100px] mx-auto space-y-2">
      <DocumentTitle title={`${catName} — MCW Forum`} description={catDesc} />
      <div className="text-[12px] prose-muted">
        <Link to="/communities" className="gold-text hover:underline">{t('communities.forumList')}</Link>
        {parent && (
          <>
            {' / '}
            <Link to={`/communities/${parent.slug}`} className="gold-text hover:underline">
              {localizeCategoryName(parent.slug, parent.name, lang)}
            </Link>
          </>
        )}
        {' / '}
        {catName}
      </div>

      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="page-title gold-text">{catName}</h1>
          <p className="text-[12px] prose-muted">{catDesc}</p>
        </div>
        <div className="flex items-center gap-2">
          {currentUser ? (
            <Link to={`/create?forum=${category.id}`} className="btn btn-primary">{t('community.postThread')}</Link>
          ) : (
            <LoginLink className="btn btn-secondary">{t('thread.loginToPost')}</LoginLink>
          )}
          <div className="relative">
            <button type="button" className="btn btn-secondary" onClick={() => setFiltersOpen((v) => !v)}>
              {t('common.filters')} <ChevronDown size={12} />
            </button>
            {filtersOpen && (
              <div className="absolute right-0 mt-1 z-20 forum-card p-1 min-w-36">
                {(['latest', 'popular', 'pinned'] as SortKey[]).map((key) => (
                  <button
                    key={key}
                    type="button"
                    className={`block w-full text-left px-3 py-1.5 text-[12px] rounded ${sort === key ? 'gold-text' : 'prose-muted'}`}
                    onClick={() => setSort(key)}
                  >
                    {sortLabel[key]}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {children.length > 0 && (
        <div className="text-[12px] prose-muted">
          {t('communities.subForums')}:{' '}
          {children.map((c, i) => (
            <span key={c.id}>
              {i > 0 && ' · '}
              <Link
                to={`/communities/${c.slug}`}
                className="gold-text hover:underline"
                onMouseEnter={() => prefetchCommunity(c.slug, { lang, limit: LIST_LIMIT })}
                onFocus={() => prefetchCommunity(c.slug, { lang, limit: LIST_LIMIT })}
                onPointerDown={() => prefetchCommunity(c.slug, { lang, limit: LIST_LIMIT })}
              >
                {localizeCategoryName(c.slug, c.name, lang)}
              </Link>
            </span>
          ))}
        </div>
      )}

      <section className="forum-list">
        {sticky.map((item) => (
          <ThreadRow key={item.id} thread={item} pleaseRead />
        ))}

        {regular.map((item) => (
          <ThreadRow key={item.id} thread={item} />
        ))}

        {!listReady && threads.length === 0 &&
          Array.from({ length: skeletonCount }).map((_, i) => (
            <ThreadRowSkeleton key={`sk-${i}`} />
          ))}

        {listReady && threads.length === 0 && (
          <div className="p-6 text-center text-sm prose-muted">{t('community.noThreadsYet')}</div>
        )}
      </section>
    </div>
  )
}

function ThreadRow({ thread, pleaseRead = false }: { thread: Thread; pleaseRead?: boolean }) {
  const { state } = useForum()
  const { t, lang } = useLocale()
  const author = thread.author
  const lastUser = author
  const lastAt = thread.updatedAt
  const likes = thread.likeCount || 0
  const forum = state.categories.find((c) => c.id === thread.forumId)
  const pages = Math.max(1, Math.ceil(((thread.replyCount || 0) + 1) / 10))
  const pageNumbers = pages <= 1 ? [] : pages <= 4
    ? Array.from({ length: pages }, (_, i) => i + 1)
    : [pages - 2, pages - 1, pages]

  return (
    <article className="thread-row">
      <Avatar user={author} size={32} />
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-1">
          <Link
            to={`/thread/${thread.id}`}
            className="text-[13px] font-semibold gold-text hover:underline line-clamp-2"
            onMouseEnter={() => prefetchThread(thread.id, { lang, limit: 20 })}
            onFocus={() => prefetchThread(thread.id, { lang, limit: 20 })}
            onPointerDown={() => prefetchThread(thread.id, { lang, limit: 20 })}
          >
            {pleaseRead && <Pin size={12} className="inline mr-1 -mt-0.5" />}
            {pleaseRead && <span>{t('thread.pleaseRead')}</span>}
            {thread.title}
          </Link>
          {pageNumbers.map((n) => (
            <Link key={n} to={`/thread/${thread.id}${n > 1 ? `?page=${n}` : ''}`} className="page-pill">
              {n}
            </Link>
          ))}
        </div>
        <div className="text-[11px] prose-muted mt-0.5">
          <Username user={author} /> · {forumTime(thread.createdAt, lang)}
          {forum && (
            <>
              {' · '}
              <Link to={`/communities/${forum.slug}`} className="hover:text-[var(--color-gold)]">
                {localizeCategoryName(forum.slug, forum.name, lang)}
              </Link>
            </>
          )}
        </div>
      </div>
      <div className="stat-col text-[12px] prose-muted">
        <div className="inline-flex items-center gap-1 text-[var(--color-ink)]">
          <ThumbsUp size={12} /> <span className="prose-muted">x</span> {likes}
        </div>
      </div>
      <div className="stat-col text-[12px] leading-tight">
        <div>{t('community.repliesLabel')} <span className="text-[var(--color-ink)]">{compactNumber(thread.replyCount || 0)}</span></div>
        <div className="prose-muted">{t('community.viewsLabel')} {compactNumber(thread.views)}</div>
      </div>
      <div className="last-col min-w-0 flex items-center justify-end gap-2 text-right">
        <div className="min-w-0">
          <div className="text-[11px] prose-muted truncate">{forumTime(lastAt, lang)}</div>
          <div className="text-[11px] truncate">{lastUser?.username}</div>
        </div>
        <Avatar user={lastUser} size={26} />
      </div>
    </article>
  )
}
