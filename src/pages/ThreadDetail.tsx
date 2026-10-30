import { Calendar, Flag, Heart, MessageSquare, Pin, Share2, ThumbsUp, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Avatar } from '../components/Avatar'
import { LoginLink } from '../components/LoginModal'
import { PostBodyView } from '../components/PostBodyView'
import { PostComposer } from '../components/PostComposer'
import { useToast } from '../components/Toast'
import { useForum } from '../context/ForumContext'
import { ART } from '../data/artwork'
import { emptyBody, ensureCommentBody, ensureThreadBody } from '../lib/postBody'
import { compactNumber, forumTime } from '../lib/utils'
import type { PostBody, User } from '../types'

const PER_PAGE = 10

function roleLabel(user?: User) {
  if (!user) return null
  if (user.role === 'admin') return { text: 'Owner', className: 'bg-[#2a7a73] text-white' }
  if (user.role === 'moderator') return { text: 'Moderator', className: 'bg-[#b42318] text-white' }
  return { text: 'Member', className: 'bg-[#3a3f4d] text-[#d5d8e0]' }
}

function MemberCard({ user }: { user?: User }) {
  const { state } = useForum()
  const threads = state.threads.filter((t) => t.authorId === user?.id).length
  const comments = state.comments.filter((c) => c.authorId === user?.id).length
  const likes =
    state.likes.filter((l) => {
      if (l.targetType === 'thread') return state.threads.some((t) => t.id === l.targetId && t.authorId === user?.id)
      return state.comments.some((c) => c.id === l.targetId && c.authorId === user?.id)
    }).length
  const role = roleLabel(user)

  return (
    <aside className="xf-member">
      <Link to={`/profile/${user?.username}`} className="inline-block">
        <Avatar user={user} size={72} />
      </Link>
      <Link to={`/profile/${user?.username}`} className="block mt-2 text-[13px] font-semibold gold-text hover:underline">
        {user?.displayName}
      </Link>
      <div className="mt-1">
        {role && <span className={`role-pill ${role.className}`}>{role.text}</span>}
        {user?.role !== 'user' && <span className="role-pill bg-[#1d6f9b] text-white">Staff member</span>}
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
    isLiked,
    likeCount,
    report,
    banUser,
    bumpViews,
    togglePin,
  } = useForum()

  const thread = state.threads.find((t) => t.id === id)
  const author = thread ? getUser(thread.authorId) : undefined
  const forum = thread ? state.categories.find((c) => c.id === thread.forumId) : undefined
  const [replyBody, setReplyBody] = useState<PostBody>(emptyBody)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    if (!id) return
    const key = `mcw_viewed_${id}`
    if (sessionStorage.getItem(key)) return
    sessionStorage.setItem(key, '1')
    bumpViews(id)
  }, [id, bumpViews])

  const posts = useMemo(() => {
    const comments = state.comments
      .filter((c) => c.threadId === id)
      .sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt))
    return [
      {
        kind: 'op' as const,
        createdAt: thread?.createdAt || '',
        authorId: thread?.authorId || '',
        body: thread ? ensureThreadBody(thread).body : emptyBody(),
        id: thread?.id || '',
      },
      ...comments.map((c) => ({
        kind: 'reply' as const,
        createdAt: c.createdAt,
        authorId: c.authorId,
        body: ensureCommentBody(c).body,
        id: c.id,
      })),
    ]
  }, [state.comments, id, thread])

  const pageCount = Math.max(1, Math.ceil(posts.length / PER_PAGE))
  const pageItems = posts.slice((page - 1) * PER_PAGE, page * PER_PAGE)

  if (!thread) {
    return (
      <div className="forum-card p-6 text-center max-w-[1100px] mx-auto">
        <p>Thread not found.</p>
        <Link to="/communities" className="btn btn-primary mt-3 inline-flex">Back to communities</Link>
      </div>
    )
  }

  const liked = isLiked('thread', thread.id)
  const likes = likeCount('thread', thread.id)
  const canDelete = currentUser && (currentUser.id === thread.authorId || isMod)

  const onComment = async (e: FormEvent) => {
    e.preventDefault()
    if (uploading) return
    const res = await addComment(thread.id, replyBody)
    if ('error' in res) {
      toast(res.error)
      return
    }
    setReplyBody(emptyBody())
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

  const goPage = (n: number) => setParams(n <= 1 ? {} : { page: String(n) })

  return (
    <div className="max-w-[1100px] mx-auto space-y-3">
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
        <Link to={`/profile/${author?.username}`} className="gold-text font-semibold hover:underline">
          {author?.displayName}
        </Link>
        <span>{forumTime(thread.createdAt)}</span>
        {thread.tags.map((tag) => <span key={tag} className="tag">{tag}</span>)}
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
        const user = getUser(post.authorId)
        const isOp = post.kind === 'op'
        const likedPost = isOp ? liked : isLiked('comment', post.id)
        const likeN = isOp ? likes : likeCount('comment', post.id)
        return (
          <article key={post.id} className="xf-post">
            <MemberCard user={user} />
            <div className="xf-body">
              <div className="flex items-center justify-between gap-2 text-[12px] prose-muted border-b border-[#2c2618] pb-2 mb-3">
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
                <a href="https://example.com/advertise" target="_blank" rel="noreferrer" className="block mt-4">
                  <img src={ART.bannerExclusive} alt="Advertisement" className="w-full max-h-28 object-cover border border-[#2c2618]" />
                </a>
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
            <PostComposer
              value={replyBody}
              onChange={setReplyBody}
              onBusyChange={setUploading}
              placeholder="Write your reply..."
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
