import { Heart, MessageCircle, Share2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useForum } from '../context/ForumContext'
import { timeAgo } from '../lib/utils'
import type { Thread } from '../types'
import { Avatar } from './Avatar'
import { useToast } from './Toast'

export function ThreadCard({ thread }: { thread: Thread }) {
  const { getUser, state, likeCount, isLiked, toggleLike, currentUser } = useForum()
  const toast = useToast()
  const author = getUser(thread.authorId)
  const replies = state.comments.filter((c) => c.threadId === thread.id).length
  const likes = likeCount('thread', thread.id)
  const liked = isLiked('thread', thread.id)

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
    <article className="forum-card p-4 flex gap-3">
      <Avatar user={author} size={40} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm">
          <Link to={`/profile/${author?.username}`} className="font-semibold hover:text-[var(--color-gold)]">
            {author?.displayName ?? 'Unknown'}
          </Link>
          <span className="prose-muted">@{author?.username}</span>
          <span className="prose-muted">· {timeAgo(thread.createdAt)}</span>
        </div>
        <Link to={`/thread/${thread.id}`} className="block mt-1">
          <h3 className="font-semibold text-[1.05rem] text-[var(--color-gold)] hover:underline">
            {thread.title}
          </h3>
          <p className="mt-1 text-sm line-clamp-2 prose-muted">{thread.content}</p>
        </Link>
        {thread.mediaUrl && thread.mediaType === 'image' && (
          <Link to={`/thread/${thread.id}`}>
            <img
              src={thread.mediaUrl}
              alt=""
              className="mt-2 max-h-48 rounded border border-[var(--color-border)] object-cover"
            />
          </Link>
        )}
        <div className="mt-3 flex items-center gap-4 text-sm prose-muted">
          <button
            type="button"
            className={`inline-flex items-center gap-1 hover:text-[var(--color-danger)] ${liked ? 'text-[var(--color-danger)]' : ''}`}
            onClick={() => {
              if (!currentUser) {
                toast('Log in to like posts')
                return
              }
              toggleLike('thread', thread.id)
            }}
          >
            <Heart size={15} fill={liked ? 'currentColor' : 'none'} /> {likes}
          </button>
          <Link to={`/thread/${thread.id}`} className="inline-flex items-center gap-1 hover:text-[var(--color-gold)]">
            <MessageCircle size={15} /> {replies}
          </Link>
          <button type="button" className="inline-flex items-center gap-1 hover:text-[var(--color-gold)]" onClick={share}>
            <Share2 size={15} /> Share
          </button>
        </div>
      </div>
    </article>
  )
}
