import { Bookmark, Calendar, Flag, Heart, MessageSquare, Pin, Share2, ThumbsUp, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { DocumentTitle } from '../components/DocumentTitle'
import { api } from '../lib/api'
import { Avatar } from '../components/Avatar'
import { Username } from '../components/Username'
import { RankBadges } from '../components/RankBadges'
import { LoginLink } from '../components/LoginModal'
import { PostBodyView } from '../components/PostBodyView'
import { PostComposer } from '../components/PostComposer'
import { useToast } from '../components/Toast'
import { AdRotator } from '../components/AdRotator'
import { useForum } from '../context/ForumContext'
import { setActiveThreadTranslations } from '../i18n/threadTranslations'
import { emptyBody, ensureCommentBody, ensureThreadBody } from '../lib/postBody'
import { compactNumber, forumTime } from '../lib/utils'
import type { Comment, PostBody, Thread, User } from '../types'

const PER_PAGE = 10

type ThreadComment = Comment & { author?: User | null; likeCount?: number; liked?: boolean }

function MemberCard({ user }: { user?: User }) {
  const { state } = useForum()
  const threads = state.threads.filter((t) => t.authorId === user?.id).length
  const comments = state.comments.filter((c) => c.authorId === user?.id).length
  const likes =
    state.likes.filter((l) => {
      if (l.targetType === 'thread') return state.threads.some((t) => t.id === l.targetId && t.authorId === user?.id)
      return state.comments.some((c) => c.id === l.targetId && c.authorId === user?.id)
    }).length

  return (
    <aside className="xf-member">
      <Link to={`/profile/${user?.username}`} className="inline-block">
        <Avatar user={user} size={72} />
      </Link>
      <div className="mt-2 text-[13px]">
        <Username user={user} />
      </div>
      <div className="mt-1">
        <RankBadges user={user} showStaffTag />
      </div>
      <dl className="mt-3 text-[11px] prose-muted space-y-1 text-left">
        <div className="flex items-center gap-1.5"><Calendar size={11} /> {user ? forumTime(user.createdAt) : '—'}</div>
        <div className="flex items-center gap-1.5"><MessageSquare size={11} /> {compactNumber(threads + comments)}</div>
        <div className="flex items-center gap-1.5"><Heart size={11} /> {compactNumber(likes)}</div>
      </dl>
    </aside>
  )
}

export function ThreadDetail() {
  const { id } = useParams()
  const [params, setParams] = useSearchParams()
  const page = Math.max(1, Number(params.get('page') || 1))
  const navigate = useNavigate()
  const toast = useToast()
  const {
    state,
    getUser,
    currentUser,
    isMod,
    addComment,
    deleteThread,
    deleteComment,
    toggleLike,
    report,
    banUser,
    bumpViews,
    togglePin,
    toggleBookmark,
    cacheUsers,
    cacheThreads,
  } = useForum()

  const [thread, setThread] = useState<Thread | null>(state.threads.find((t) => t.id === id) || null)
  const [loading, setLoading] = useState(!state.threads.find((t) => t.id === id))
  const [comments, setComments] = useState<ThreadComment[]>([])
  const [commentTotal, setCommentTotal] = useState(0)
  const authorCached = thread ? getUser(thread.authorId) : undefined
  const author = authorCached ? { ...thread?.author, ...authorCached } : thread?.author
  const forum = thread ? state.categories.find((c) => c.id === thread.forumId) : undefined
  const [replyBody, setReplyBody] = useState<PostBody>(emptyBody)
  const [uploading, setUploading] = useState(false)
  const [saved, setSaved] = useState(!!thread?.bookmarked)
  const [quoteParent, setQuoteParent] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    void api<{ thread: Thread; translations?: Record<string, string> }>(`/api/threads/${id}`).then((res) => {
      if (!res.ok) {
        setThread(null)
        setActiveThreadTranslations(null)
        setLoading(false)
        return
      }
      const translations = res.thread.translations || res.translations || undefined
      const next = translations ? { ...res.thread, translations } : res.thread
      setThread(next)
      setActiveThreadTranslations(translations || null)
      setSaved(!!next.bookmarked)
      cacheThreads([next])
      if (next.author) cacheUsers([next.author])
      // If WPML resolved to a different post id for this language, sync the URL
      if (next.id && next.id !== id) {
        const qs = params.toString()
        navigate(`/thread/${next.id}${qs ? `?${qs}` : ''}`, { replace: true })
      }
      setLoading(false)
    })
    return () => setActiveThreadTranslations(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only refetch when route thread id changes
  }, [id, cacheThreads, cacheUsers, navigate])

  useEffect(() => {
    if (!id) return
    void api<{ comments: ThreadComment[]; total: number }>(
      `/api/threads/${id}/comments?page=${page}&limit=${PER_PAGE}`,
    ).then((res) => {
      if (!res.ok) return
      setComments(res.comments)
      setCommentTotal(res.total)
      cacheUsers(res.comments.map((c) => c.author).filter((u): u is User => Boolean(u)))
    })
  }, [id, page, cacheUsers])

  useEffect(() => {
    if (!id) return
    const key = `mcw_viewed_${id}`
    if (sessionStorage.getItem(key)) return
    sessionStorage.setItem(key, '1')
    bumpViews(id)
  }, [id, bumpViews])

  const posts = useMemo(() => {
    const mapped = comments.map((c) => ({
      kind: 'reply' as const,
      createdAt: c.createdAt,
      authorId: c.authorId,
      body: ensureCommentBody(c).body,
      id: c.id,
      likeCount: c.likeCount || 0,
      liked: !!c.liked,
      author: c.author,
    }))
    if (page > 1 || !thread) return mapped
    return [
      {
        kind: 'op' as const,
        createdAt: thread.createdAt,
        authorId: thread.authorId,
        body: ensureThreadBody(thread).body,
        id: thread.id,
        likeCount: thread.likeCount || 0,
        liked: !!thread.liked,
        author: thread.author,
      },
      ...mapped,
    ]
  }, [comments, thread, page])

  const pageCount = Math.max(1, Math.ceil((commentTotal + 1) / PER_PAGE))
  const pageItems = posts

  if (loading) {
    return <div className="forum-card p-6 text-center max-w-[1100px] mx-auto prose-muted">Loading discussion…</div>
  }

  if (!thread) {
    return (
      <div className="forum-card p-6 text-center max-w-[1100px] mx-auto">
        <p>Thread not found.</p>
        <Link to="/communities" className="btn btn-primary mt-3 inline-flex">Back to communities</Link>
      </div>
    )
  }

  const canDelete = currentUser && (currentUser.id === thread.authorId || isMod)
  const goPage = (n: number) => setParams(n <= 1 ? {} : { page: String(n) })

  const onComment = async (e: FormEvent) => {
    e.preventDefault()
    if (uploading) return
    const res = await addComment(thread.id, replyBody, quoteParent)
    if ('error' in res) {
      toast(res.error)
      return
    }
    const posted: ThreadComment = {
      ...res,
      author: res.author || currentUser,
      likeCount: 0,
      liked: false,
    }
    const nextTotal = commentTotal + 1
    const lastPage = Math.max(1, Math.ceil(nextTotal / PER_PAGE))
    setReplyBody(emptyBody())
    setQuoteParent(null)
    setCommentTotal(nextTotal)
    if (page !== lastPage) {
      goPage(lastPage)
    } else {
      setComments((list) => (list.some((c) => c.id === posted.id) ? list : [...list, posted]))
    }
    toast('Reply posted')
  }

  const share = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      toast('Link copied')
    } catch {
      toast(window.location.href)
    }
  }

  return (
    <div className="max-w-[1100px] mx-auto space-y-3">
      <DocumentTitle title={`${thread.title} — MCW Forum`} description={thread.content.slice(0, 160)} />
      <script type="application/ld+json">
        {JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'DiscussionForumPosting',
          headline: thread.title,
          datePublished: thread.createdAt,
          dateModified: thread.updatedAt,
          author: author ? { '@type': 'Person', name: author.displayName } : undefined,
          url: typeof window !== 'undefined' ? window.location.href : undefined,
        })}
      </script>
      <div className="text-[12px] prose-muted">
        <Link to="/communities" className="gold-text hover:underline">Forum list</Link>
        {forum && (
          <>
            {' / '}
            <Link to={`/communities/${forum.slug}`} className="gold-text hover:underline">{forum.name}</Link>
          </>
        )}
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="page-title gold-text leading-snug max-w-3xl">
          {thread.pinned && <Pin size={16} className="inline mr-1 -mt-0.5" />}
          {thread.title}
        </h1>
        {currentUser ? (
          <Link to={`/create?forum=${thread.forumId}`} className="btn btn-primary">Post thread</Link>
        ) : (
          <LoginLink className="btn btn-secondary">Log in to post</LoginLink>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3 text-[12px] prose-muted">
        <Username user={author} />
        <span>{forumTime(thread.createdAt)}</span>
        {thread.tags.map((tag) => <span key={tag} className="tag">{tag}</span>)}
        {currentUser && (
          <button
            type="button"
            className={`inline-flex items-center gap-1 ${saved ? 'text-[var(--color-gold)]' : ''}`}
            onClick={() => void toggleBookmark(thread.id).then(setSaved)}
          >
            <Bookmark size={12} /> {saved ? 'Saved' : 'Save'}
          </button>
        )}
      </div>

      {pageCount > 1 && (
        <nav className="pager">
          {Array.from({ length: pageCount }, (_, i) => i + 1).map((n) => (
            <button key={n} type="button" className={n === page ? 'is-active' : ''} onClick={() => goPage(n)}>{n}</button>
          ))}
          {page < pageCount && (
            <button type="button" onClick={() => goPage(page + 1)}>Next</button>
          )}
        </nav>
      )}

      {pageItems.map((post, index) => {
        const number = (page - 1) * PER_PAGE + index + 1
        const cached = getUser(post.authorId)
        const user = cached ? { ...post.author, ...cached } : post.author
        const isOp = post.kind === 'op'
        const likedPost = post.liked
        const likeN = post.likeCount
        return (
          <article key={post.id} className="xf-post">
            <MemberCard user={user} />
            <div className="xf-body">
              <div className="flex items-center justify-between gap-2 text-[12px] prose-muted border-b border-[var(--xf-line-soft)] pb-2 mb-3">
                <span>{forumTime(post.createdAt)}</span>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={share} className="hover:text-[var(--color-gold)] inline-flex items-center gap-1">
                    <Share2 size={12} /> Share
                  </button>
                  <span>#{number}</span>
                </div>
              </div>
              <PostBodyView body={post.body} />
              {isOp && number === 1 && (
                <AdRotator
                  slot="thread"
                  variant="inline"
                  className="mt-4 border border-[var(--xf-line-soft)]"
                  heightClass="h-28 max-h-28"
                />
              )}
              <div className="mt-4 flex flex-wrap items-center gap-3 text-[12px] prose-muted">
                <button
                  type="button"
                  className={`inline-flex items-center gap-1 ${likedPost ? 'text-[var(--color-gold)]' : ''}`}
                  onClick={() => {
                    if (!currentUser) return toast('Log in to like')
                    toggleLike(isOp ? 'thread' : 'comment', post.id)
                  }}
                >
                  <ThumbsUp size={13} /> {likeN}
                </button>
                {currentUser && !isOp && (
                  <button
                    type="button"
                    onClick={() => {
                      setQuoteParent(post.id)
                      toast('Replying to this comment')
                    }}
                  >
                    Quote
                  </button>
                )}
                {currentUser && (
                  <button
                    type="button"
                    onClick={() => {
                      const reason = window.prompt('Why are you reporting this?')
                      if (!reason) return
                      report(isOp ? 'thread' : 'comment', post.id, reason)
                      toast('Report submitted')
                    }}
                  >
                    <Flag size={13} className="inline mr-1" /> Report
                  </button>
                )}
                {isOp && isMod && (
                  <button type="button" onClick={() => togglePin(thread.id)}>
                    <Pin size={13} className="inline mr-1" /> {thread.pinned ? 'Unpin' : 'Pin'}
                  </button>
                )}
                {isOp && canDelete && (
                  <button
                    type="button"
                    className="text-[var(--color-danger)]"
                    onClick={() => {
                      if (!window.confirm('Delete this thread?')) return
                      deleteThread(thread.id)
                      toast('Thread deleted')
                      navigate(forum ? `/communities/${forum.slug}` : '/communities')
                    }}
                  >
                    <Trash2 size={13} className="inline mr-1" /> Delete
                  </button>
                )}
                {!isOp && currentUser && (currentUser.id === post.authorId || isMod) && (
                  <button
                    type="button"
                    className="text-[var(--color-danger)]"
                    onClick={() => {
                      if (!window.confirm('Delete this reply?')) return
                      deleteComment(post.id)
                      setComments((list) => list.filter((c) => c.id !== post.id))
                      setCommentTotal((n) => Math.max(0, n - 1))
                      toast('Reply deleted')
                    }}
                  >
                    <Trash2 size={13} className="inline mr-1" /> Delete
                  </button>
                )}
                {isOp && isMod && author && author.role === 'user' && (
                  <button
                    type="button"
                    className="text-[var(--color-danger)]"
                    onClick={() => {
                      if (!window.confirm(`Remove user @${author.username}?`)) return
                      banUser(author.id, true)
                      toast('User removed')
                    }}
                  >
                    Remove user
                  </button>
                )}
              </div>
            </div>
          </article>
        )
      })}

      <section className="xf-form">
        <div className="xf-form-head">Reply to thread</div>
        {currentUser ? (
          <form onSubmit={onComment}>
            {quoteParent && (
              <p className="text-[12px] px-3 pt-2 prose-muted">
                Replying to a comment.{' '}
                <button type="button" className="gold-text" onClick={() => setQuoteParent(null)}>
                  Cancel
                </button>
              </p>
            )}
            <PostComposer
              value={replyBody}
              onChange={setReplyBody}
              onBusyChange={setUploading}
              placeholder={quoteParent ? 'Write your quoted reply...' : 'Write your reply. Use @username to mention someone.'}
            />
            <div className="xf-form-actions">
              <button type="submit" className="btn-post" disabled={uploading}>
                {uploading ? 'Uploading…' : 'Post reply'}
              </button>
            </div>
          </form>
        ) : (
          <p className="text-[12px] prose-muted px-3 py-3">
            <LoginLink className="gold-text hover:underline bg-transparent border-0 p-0 cursor-pointer">Log in</LoginLink> to reply.
          </p>
        )}
      </section>
    </div>
  )
}
