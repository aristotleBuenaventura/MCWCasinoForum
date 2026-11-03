import { ChevronDown, Pin, ThumbsUp } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { Avatar } from '../components/Avatar'
import { Username } from '../components/Username'
import { DocumentTitle } from '../components/DocumentTitle'
import { LoginLink } from '../components/LoginModal'
import { useForum } from '../context/ForumContext'
import { localizeCategoryDesc, localizeCategoryName } from '../i18n/messages'
import { useLocale } from '../i18n/locale'
import { api } from '../lib/api'
import { compactNumber, forumTime } from '../lib/utils'
import type { Thread } from '../types'

type SortKey = 'latest' | 'popular' | 'pinned'

export function CommunityDetail() {
  const { slug } = useParams()
  const [params, setParams] = useSearchParams()
  const [filtersOpen, setFiltersOpen] = useState(false)
  const sort = ((params.get('sort') as SortKey) || 'latest')
  const { getCategoryBySlug, childCategories, state, currentUser, cacheThreads } = useForum()
  const { t, lang } = useLocale()
  const category = getCategoryBySlug(slug || '')
  const children = category ? childCategories(category.id) : []
  const [threads, setThreads] = useState<Thread[]>([])

  useEffect(() => {
    if (!slug) return
    const sortKey = sort === 'pinned' ? 'latest' : sort
    void api<{ threads: Thread[] }>(`/api/threads?forum=${encodeURIComponent(slug)}&sort=${sortKey}&limit=40`).then((res) => {
      if (!res.ok) return
      const list = sort === 'pinned' ? res.threads.filter((t) => t.pinned) : res.threads
      setThreads(list)
      cacheThreads(list)
    })
  }, [slug, sort, lang, cacheThreads])

  if (!category) {
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
              <Link to={`/communities/${c.slug}`} className="gold-text hover:underline">
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

        {threads.length === 0 && (
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
          <Link to={`/thread/${thread.id}`} className="text-[13px] font-semibold gold-text hover:underline line-clamp-2">
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
