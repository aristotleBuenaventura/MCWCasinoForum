import { Pin } from 'lucide-react'
import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Avatar } from '../components/Avatar'
import { useForum } from '../context/ForumContext'
import { timeAgo } from '../lib/utils'

export function CommunityDetail() {
  const { slug } = useParams()
  const { getCategoryBySlug, childCategories, state, getUser, currentUser } = useForum()
  const category = getCategoryBySlug(slug || '')
  const children = category ? childCategories(category.id) : []

  const threads = useMemo(() => {
    if (!category) return []
    return [...state.threads]
      .filter((t) => t.forumId === category.id)
      .sort((a, b) => Number(b.pinned) - Number(a.pinned) || +new Date(b.updatedAt) - +new Date(a.updatedAt))
  }, [state.threads, category])

  if (!category) {
    return (
      <div className="forum-card p-6 text-center">
        <p>Community not found.</p>
        <Link to="/communities" className="btn btn-primary mt-3 inline-flex">Back to communities</Link>
      </div>
    )
  }

  const parent = category.parentId ? state.categories.find((c) => c.id === category.parentId) : null

  return (
    <div className="space-y-4">
      <div className="text-xs prose-muted">
        <Link to="/communities" className="gold-text hover:underline">Communities</Link>
        {parent && (
          <>
            {' / '}
            <Link to={`/communities/${parent.slug}`} className="gold-text hover:underline">{parent.name}</Link>
          </>
        )}
        {' / '}
        {category.name}
      </div>

      <section className="forum-card p-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{category.name}</h1>
          <p className="text-sm prose-muted mt-1">{category.description}</p>
        </div>
        {currentUser ? (
          <Link to={`/create?forum=${category.id}`} className="btn btn-accent">Post thread</Link>
        ) : (
          <Link to="/login" className="btn btn-secondary">Log in to post</Link>
        )}
      </section>

      {children.length > 0 && (
        <section className="forum-card overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--color-border)] font-semibold">Sub-communities</div>
          {children.map((c) => {
            const latest = [...state.threads]
              .filter((t) => t.forumId === c.id)
              .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))[0]
            return (
              <Link key={c.id} to={`/communities/${c.slug}`} className="table-row flex items-center justify-between gap-3 px-4 py-3">
                <div>
                  <div className="font-medium">{c.name}</div>
                  <div className="text-xs prose-muted">{c.description}</div>
                </div>
                <div className="text-xs prose-muted text-right">
                  <div>{c.threadCount} threads</div>
                  {latest && <div>{timeAgo(latest.createdAt)}</div>}
                </div>
              </Link>
            )
          })}
        </section>
      )}

      {children.length === 0 && (
        <section className="forum-card overflow-hidden">
          <div className="hidden md:grid grid-cols-[1fr_80px_80px_200px] gap-3 px-4 py-2 text-[11px] uppercase tracking-wide prose-muted border-b border-[var(--color-border)]">
            <div>Thread</div>
            <div className="text-right">Replies</div>
            <div className="text-right">Views</div>
            <div>Last activity</div>
          </div>
          {threads.map((t) => {
            const author = getUser(t.authorId)
            const replies = state.comments.filter((c) => c.threadId === t.id)
            const last = replies.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))[0]
            const lastUser = last ? getUser(last.authorId) : author
            const lastAt = last?.createdAt || t.createdAt
            return (
              <Link key={t.id} to={`/thread/${t.id}`} className="table-row grid md:grid-cols-[1fr_80px_80px_200px] gap-2 px-4 py-3 items-center">
                <div className="flex items-start gap-3 min-w-0">
                  <Avatar user={author} size={32} />
                  <div className="min-w-0">
                    <div className="font-medium flex items-center gap-2">
                      {t.pinned && <Pin size={12} className="text-[var(--color-gold)] shrink-0" />}
                      <span className="line-clamp-1">{t.title}</span>
                    </div>
                    <div className="text-xs prose-muted">
                      {author?.username} · {timeAgo(t.createdAt)}
                    </div>
                  </div>
                </div>
                <div className="text-sm md:text-right prose-muted">{replies.length}</div>
                <div className="text-sm md:text-right prose-muted">{t.views}</div>
                <div className="text-xs prose-muted">
                  {lastUser?.username}
                  <div>{timeAgo(lastAt)}</div>
                </div>
              </Link>
            )
          })}
          {threads.length === 0 && <div className="p-6 text-center prose-muted">No threads in this community yet.</div>}
        </section>
      )}
    </div>
  )
}
