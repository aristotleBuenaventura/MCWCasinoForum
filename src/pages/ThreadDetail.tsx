import { Flag, Heart, Share2, Trash2 } from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Avatar } from '../components/Avatar'
import { useToast } from '../components/Toast'
import { useForum } from '../context/ForumContext'
import { timeAgo } from '../lib/utils'
import type { Comment } from '../types'

function CommentItem({
  comment,
  depth = 0,
  childrenMap,
}: {
  comment: Comment
  depth?: number
  childrenMap: Map<string, Comment[]>
}) {
  const {
    getUser,
    currentUser,
    isMod,
    deleteComment,
    toggleLike,
    isLiked,
    likeCount,
    report,
    addComment,
  } = useForum()
  const toast = useToast()
  const author = getUser(comment.authorId)
  const [replyOpen, setReplyOpen] = useState(false)
  const [reply, setReply] = useState('')
  const liked = isLiked('comment', comment.id)
  const likes = likeCount('comment', comment.id)
  const canDelete = currentUser && (currentUser.id === comment.authorId || isMod)

  const submitReply = (e: FormEvent) => {
    e.preventDefault()
    const res = addComment(comment.threadId, reply, comment.id)
    if ('error' in res) {
      toast(res.error)
      return
    }
    setReply('')
    setReplyOpen(false)
    toast('Reply posted')
  }

  return (
    <div className={depth ? 'ml-4 md:ml-8 mt-3 border-l border-[var(--color-border)] dark:border-[#2a3542] pl-3' : 'mt-3'}>
      <div className="forum-card p-3">
        <div className="flex gap-2">
          <Avatar user={author} size={32} />
          <div className="min-w-0 flex-1">
            <div className="text-sm">
              <Link to={`/profile/${author?.username}`} className="font-semibold hover:text-[var(--color-brand)]">
                {author?.displayName}
              </Link>
              <span className="prose-muted"> · {timeAgo(comment.createdAt)}</span>
            </div>
            <p className="mt-1 text-sm whitespace-pre-wrap">{comment.content}</p>
            <div className="mt-2 flex flex-wrap gap-3 text-xs prose-muted">
              <button
                type="button"
                className={`inline-flex items-center gap-1 ${liked ? 'text-[var(--color-danger)]' : ''}`}
                onClick={() => {
                  if (!currentUser) return toast('Log in to like')
                  toggleLike('comment', comment.id)
                }}
              >
                <Heart size={13} fill={liked ? 'currentColor' : 'none'} /> {likes}
              </button>
              <button type="button" onClick={() => setReplyOpen((v) => !v)}>
                Reply
              </button>
              {currentUser && (
                <button
                  type="button"
                  className="inline-flex items-center gap-1"
                  onClick={() => {
                    const reason = window.prompt('Why are you reporting this comment?')
                    if (!reason) return
                    report('comment', comment.id, reason)
                    toast('Report submitted')
                  }}
                >
                  <Flag size={13} /> Report
                </button>
              )}
              {canDelete && (
                <button
                  type="button"
                  className="inline-flex items-center gap-1 text-[var(--color-danger)]"
                  onClick={() => {
                    if (window.confirm('Delete this comment?')) {
                      deleteComment(comment.id)
                      toast('Comment deleted')
                    }
                  }}
                >
                  <Trash2 size={13} /> Delete
                </button>
              )}
            </div>
            {replyOpen && currentUser && (
              <form onSubmit={submitReply} className="mt-2 space-y-2">
                <textarea className="input min-h-20" value={reply} onChange={(e) => setReply(e.target.value)} required />
                <button type="submit" className="btn btn-primary text-sm">
                  Post reply
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
      {(childrenMap.get(comment.id) ?? []).map((child) => (
        <CommentItem key={child.id} comment={child} depth={depth + 1} childrenMap={childrenMap} />
      ))}
    </div>
  )
}

export function ThreadDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const {
    state,
    getUser,
    currentUser,
    isMod,
    addComment,
    deleteThread,
    toggleLike,
    isLiked,
    likeCount,
    report,
    banUser,
  } = useForum()

  const thread = state.threads.find((t) => t.id === id)
  const author = thread ? getUser(thread.authorId) : undefined
  const forum = thread ? state.categories.find((c) => c.id === thread.forumId) : undefined
  const [content, setContent] = useState('')

  const { roots, childrenMap } = useMemo(() => {
    const comments = state.comments.filter((c) => c.threadId === id)
    const map = new Map<string, Comment[]>()
    const roots: Comment[] = []
    for (const c of comments) {
      if (!c.parentId) roots.push(c)
      else {
        const list = map.get(c.parentId) ?? []
        list.push(c)
        map.set(c.parentId, list)
      }
    }
    roots.sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt))
    for (const [, list] of map) list.sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt))
    return { roots, childrenMap: map }
  }, [state.comments, id])

  if (!thread) {
    return (
      <div className="forum-card p-6 text-center">
        <p>Thread not found.</p>
        <Link to="/" className="btn btn-primary mt-3 inline-flex">
          Back home
        </Link>
      </div>
    )
  }

  const liked = isLiked('thread', thread.id)
  const likes = likeCount('thread', thread.id)
  const canDelete = currentUser && (currentUser.id === thread.authorId || isMod)

  const onComment = (e: FormEvent) => {
    e.preventDefault()
    const res = addComment(thread.id, content)
    if ('error' in res) {
      toast(res.error)
      return
    }
    setContent('')
    toast('Comment posted')
  }

  const share = async () => {
    const url = window.location.href
    try {
      await navigator.clipboard.writeText(url)
      toast('Link copied')
    } catch {
      toast(url)
    }
  }

  return (
    <div className="space-y-4">
      <div className="text-sm prose-muted">
        <Link to="/forums" className="text-[var(--color-brand)] hover:underline">
          Forums
        </Link>
        {forum && <> / {forum.name}</>}
      </div>

      <article className="forum-card p-5">
        <div className="flex gap-3">
          <Avatar user={author} size={48} />
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold">{thread.title}</h1>
            <div className="text-sm prose-muted mt-1">
              <Link to={`/profile/${author?.username}`} className="text-[var(--color-brand)] hover:underline">
                {author?.displayName}
              </Link>
              {' · '}
              {timeAgo(thread.createdAt)}
            </div>
            <p className="mt-4 whitespace-pre-wrap">{thread.content}</p>
            {thread.mediaUrl && thread.mediaType === 'image' && (
              <img src={thread.mediaUrl} alt="" className="mt-4 max-h-96 rounded border border-[var(--color-border)]" />
            )}
            {thread.mediaUrl && thread.mediaType === 'video' && (
              <video src={thread.mediaUrl} controls className="mt-4 w-full max-h-96 rounded border border-[var(--color-border)]" />
            )}
            <div className="mt-4 flex flex-wrap gap-3 text-sm">
              <button
                type="button"
                className={`btn btn-secondary ${liked ? 'text-[var(--color-danger)]' : ''}`}
                onClick={() => {
                  if (!currentUser) return toast('Log in to like')
                  toggleLike('thread', thread.id)
                }}
              >
                <Heart size={16} fill={liked ? 'currentColor' : 'none'} /> {likes}
              </button>
              <button type="button" className="btn btn-secondary" onClick={share}>
                <Share2 size={16} /> Share
              </button>
              {currentUser && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    const reason = window.prompt('Why are you reporting this thread?')
                    if (!reason) return
                    report('thread', thread.id, reason)
                    toast('Report submitted')
                  }}
                >
                  <Flag size={16} /> Report
                </button>
              )}
              {canDelete && (
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={() => {
                    if (!window.confirm('Delete this thread?')) return
                    deleteThread(thread.id)
                    toast('Thread deleted')
                    navigate('/')
                  }}
                >
                  <Trash2 size={16} /> Delete
                </button>
              )}
              {isMod && author && author.role === 'user' && (
                <button
                  type="button"
                  className="btn btn-danger"
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
        </div>
      </article>

      <section>
        <h2 className="font-semibold text-lg mb-2">{roots.length} comments</h2>
        {currentUser ? (
          <form onSubmit={onComment} className="forum-card p-4 space-y-2 mb-3">
            <textarea
              className="input min-h-24"
              placeholder="Write a comment..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              required
            />
            <button type="submit" className="btn btn-primary">
              Post comment
            </button>
          </form>
        ) : (
          <div className="forum-card p-4 mb-3 text-sm prose-muted">
            <Link to="/login" className="text-[var(--color-brand)] hover:underline">
              Log in
            </Link>{' '}
            to comment.
          </div>
        )}
        {roots.map((c) => (
          <CommentItem key={c.id} comment={c} childrenMap={childrenMap} />
        ))}
      </section>
    </div>
  )
}
