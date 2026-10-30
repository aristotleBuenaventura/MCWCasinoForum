import { ChevronDown, Pin, ThumbsUp } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { Avatar } from '../components/Avatar'
import { LoginLink } from '../components/LoginModal'
import { useForum } from '../context/ForumContext'
import { compactNumber, forumTime } from '../lib/utils'
import type { Thread } from '../types'

type SortKey = 'latest' | 'popular' | 'pinned'

export function CommunityDetail() {
  const { slug } = useParams()
  const [params, setParams] = useSearchParams()
  const [filtersOpen, setFiltersOpen] = useState(false)
  const sort = ((params.get('sort') as SortKey) || 'latest')
  const { getCategoryBySlug, childCategories, state, currentUser, likeCount } = useForum()
  const category = getCategoryBySlug(slug || '')
  const children = category ? childCategories(category.id) : []

  const threads = useMemo(() => {
    if (!category) return []
    const ids = [category.id, ...children.map((c) => c.id)]
    const list = state.threads.filter((t) => ids.includes(t.forumId))
    if (sort === 'popular') {
      return [...list].sort((a, b) => likeCount('thread', b.id) - likeCount('thread', a.id) || +new Date(b.createdAt) - +new Date(a.createdAt))
    }
    if (sort === 'pinned') {
      return [...list].sort((a, b) => Number(b.pinned) - Number(a.pinned) || +new Date(b.createdAt) - +new Date(a.createdAt))
    }
    return [...list].sort((a, b) => Number(b.pinned) - Number(a.pinned) || +new Date(b.updatedAt) - +new Date(a.updatedAt))
  }, [state.threads, category, children, sort, likeCount])

  if (!category) {
    return (
      <div className="forum-card p-6 text-center max-w-[1100px] mx-auto">
        <p>Community not found.</p>
        <Link to="/communities" className="btn btn-primary mt-3 inline-flex">Back to communities</Link>
      </div>
    )
  }

  const parent = category.parentId ? state.categories.find((c) => c.id === category.parentId) : null
  const sticky = threads.filter((t) => t.pinned)
  const regular = threads.filter((t) => !t.pinned)

  const setSort = (value: SortKey) => {
    setParams(value === 'latest' ? {} : { sort: value })
    setFiltersOpen(false)
  }

  return (
    <div className="max-w-[1100px] mx-auto space-y-2">
      <div className="text-[12px] prose-muted">
        <Link to="/communities" className="gold-text hover:underline">Forum list</Link>
        {parent && (
          <>
            {' / '}
            <Link to={`/communities/${parent.slug}`} className="gold-text hover:underline">{parent.name}</Link>
          </>
        )}
        {' / '}
        {category.name}
      </div>

      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="page-title gold-text">{category.name}</h1>
          <p className="text-[12px] prose-muted">{category.description}</p>
        </div>
        <div className="flex items-center gap-2">
          {currentUser ? (
            <Link to={`/create?forum=${category.id}`} className="btn btn-primary">Post thread</Link>
          ) : (
            <LoginLink className="btn btn-secondary">Log in to post</LoginLink>
          )}
          <div className="relative">
            <button type="button" className="btn btn-secondary" onClick={() => setFiltersOpen((v) => !v)}>
              Filters <ChevronDown size={12} />
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
                    {key[0].toUpperCase() + key.slice(1)}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {children.length > 0 && (
        <div className="text-[12px] prose-muted">
          Sub-forums:{' '}
          {children.map((c, i) => (
            <span key={c.id}>
              {i > 0 && ' · '}
              <Link to={`/communities/${c.slug}`} className="gold-text hover:underline">{c.name}</Link>
            </span>
          ))}
        </div>
      )}

      <section className="forum-list">
        {sticky.map((t) => (
          <ThreadRow key={t.id} thread={t} pleaseRead />
        ))}

        {regular.map((t) => (
          <ThreadRow key={t.id} thread={t} />
        ))}

        {threads.length === 0 && (
          <div className="p-6 text-center text-sm prose-muted">No threads in this community yet.</div>
        )}
      </section>
    </div>
  )
}

function ThreadRow({ thread, pleaseRead = false }: { thread: Thread; pleaseRead?: boolean }) {
  const { getUser, state, likeCount } = useForum()
  const author = getUser(thread.authorId)
  const replies = state.comments.filter((c) => c.threadId === thread.id)
  const last = [...replies].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))[0]
  const lastUser = last ? getUser(last.authorId) : author
  const lastAt = last?.createdAt || thread.updatedAt
  const likes = likeCount('thread', thread.id)
  const forum = state.categories.find((c) => c.id === thread.forumId)
  const pages = Math.max(1, Math.ceil((replies.length + 1) / 10))
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
            {pleaseRead && <span>Please Read: </span>}
            {thread.title}
          </Link>
          {pageNumbers.map((n) => (
            <Link key={n} to={`/thread/${thread.id}${n > 1 ? `?page=${n}` : ''}`} className="page-pill">
              {n}
            </Link>
          ))}
        </div>
        <div className="text-[11px] prose-muted mt-0.5">
          {author?.displayName} · {forumTime(thread.createdAt)}
          {forum && (
            <>
              {' · '}
              <Link to={`/communities/${forum.slug}`} className="hover:text-[var(--color-gold)]">{forum.name}</Link>
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
        <div>Replies: <span className="text-[var(--color-ink)]">{compactNumber(replies.length)}</span></div>
        <div className="prose-muted">Views: {compactNumber(thread.views)}</div>
      </div>
      <div className="last-col min-w-0 flex items-center justify-end gap-2 text-right">
        <div className="min-w-0">
          <div className="text-[11px] prose-muted truncate">{forumTime(lastAt)}</div>
          <div className="text-[11px] truncate">{lastUser?.username}</div>
        </div>
        <Avatar user={lastUser} size={26} />
      </div>
    </article>
  )
}
