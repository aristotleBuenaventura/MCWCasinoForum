import { useMemo, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Avatar } from '../components/Avatar'
import { useForum } from '../context/ForumContext'
import { imageCount } from '../lib/postBody'
import { forumTime } from '../lib/utils'
import type { User } from '../types'

type BoardKey = 'messages' | 'reactions' | 'media'

const BOARDS: { key: BoardKey; title: string }[] = [
  { key: 'messages', title: 'Most messages' },
  { key: 'reactions', title: 'Highest reaction score' },
  { key: 'media', title: 'Most media items' },
]

function usernameBanner(user: User) {
  if (user.role === 'admin') return { background: '#1d9e75', color: '#fff' }
  if (user.role === 'moderator') return { background: '#c0392b', color: '#fff' }
  const palettes = [
    { background: '#f3f3f3', color: '#111' },
    { background: '#1769a5', color: '#fff' },
    { background: '#c0392b', color: '#fff' },
    { background: '#c9a046', color: '#1a1408' },
    { background: '#16a085', color: '#fff' },
    { background: '#2c3e50', color: '#f0cf79' },
    { background: '#8e44ad', color: '#fff' },
  ]
  let hash = 0
  for (let i = 0; i < user.username.length; i++) hash = user.username.charCodeAt(i) + ((hash << 5) - hash)
  return palettes[Math.abs(hash) % palettes.length]
}

function memberTitle(user: User) {
  if (user.role === 'admin') return 'Owner'
  if (user.role === 'moderator') return 'Moderator'
  return 'Registered member'
}

export function Members() {
  const { state } = useForum()
  const [params, setParams] = useSearchParams()
  const [q, setQ] = useState(params.get('username') || '')
  const listKey = (params.get('key') as BoardKey | null) || null
  const query = (params.get('username') || '').trim().toLowerCase()

  const rows = useMemo(() => {
    const active = state.users.filter((u) => !u.banned)
    return active.map((user) => {
      const threads = state.threads.filter((t) => t.authorId === user.id)
      const comments = state.comments.filter((c) => c.authorId === user.id)
      const threadIds = new Set(threads.map((t) => t.id))
      const commentIds = new Set(comments.map((c) => c.id))
      const reactions = state.likes.filter((l) =>
        l.targetType === 'thread' ? threadIds.has(l.targetId) : commentIds.has(l.targetId),
      ).length
      const media =
        threads.reduce((n, t) => n + imageCount(t.body) + (t.mediaUrl && imageCount(t.body) === 0 ? 1 : 0), 0) +
        comments.reduce((n, c) => n + imageCount(c.body), 0)
      const lastAt = [...threads.map((t) => t.createdAt), ...comments.map((c) => c.createdAt)]
        .sort((a, b) => +new Date(b) - +new Date(a))[0] || user.createdAt
      return {
        user,
        messages: threads.length + comments.length,
        reactions,
        media,
        lastAt,
      }
    })
  }, [state.comments, state.likes, state.threads, state.users])

  const ranked = (key: BoardKey) =>
    [...rows].sort((a, b) => b[key] - a[key] || a.user.username.localeCompare(b.user.username))

  const onFind = (e: FormEvent) => {
    e.preventDefault()
    const username = q.trim()
    setParams(username ? { username } : {})
  }

  const matches = query
    ? rows.filter(
        (r) =>
          r.user.username.toLowerCase().includes(query) ||
          r.user.displayName.toLowerCase().includes(query),
      )
    : []

  const board = BOARDS.find((b) => b.key === listKey)

  return (
    <div className="max-w-[1100px] mx-auto space-y-3">
      <div className="text-[12px] prose-muted">
        <Link to="/" className="gold-text hover:underline">Home</Link>
        {' > '}
        {board ? (
          <>
            <Link to="/members" className="gold-text hover:underline">Notable members</Link>
            {' > '}
            {board.title}
          </>
        ) : (
          'Notable members'
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="page-title">{board ? board.title : 'Notable members'}</h1>
        <form onSubmit={onFind} className="flex items-center gap-1.5">
          <input
            className="input h-7 w-44 text-[13px]"
            placeholder="Username"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Find member"
          />
          <button type="submit" className="btn btn-primary">Find</button>
        </form>
      </div>

      {query && (
        <section className="forum-list">
          <div className="forum-list-head">Member search results</div>
          {matches.length === 0 && <div className="p-5 text-sm prose-muted">No members matched that name.</div>}
          {matches.map((row) => (
            <MemberResultRow key={row.user.id} row={row} />
          ))}
        </section>
      )}

      {!query && !board && (
        <div className="xf-notable">
          {BOARDS.map((item) => {
            const list = ranked(item.key).slice(0, 5)
            return (
              <section key={item.key} className="xf-notable-col">
                <h2>{item.title}</h2>
                {list.length === 0 && <div className="py-3 text-[12px] prose-muted">No members yet.</div>}
                <ol className="m-0 p-0 list-none">
                  {list.map((row) => (
                    <li key={row.user.id} className="xf-notable-row">
                      <Avatar user={row.user} size={28} />
                      <Link to={`/profile/${row.user.username}`} className="min-w-0">
                        <span className="xf-name-pill" style={usernameBanner(row.user)}>
                          {row.user.displayName}
                        </span>
                      </Link>
                      <span className="xf-notable-count">{row[item.key].toLocaleString()}</span>
                    </li>
                  ))}
                </ol>
                <Link to={`/members?key=${item.key}`} className="xf-see-more">See more...</Link>
              </section>
            )
          })}
        </div>
      )}

      {!query && board && (
        <section className="forum-list">
          <div className="xf-member-list-head">
            <span>Username</span>
            <span className="hidden sm:block">Title</span>
            <span className="text-right">Messages</span>
            <span className="text-right hidden md:block">Reaction score</span>
            <span className="text-right hidden lg:block">Joined</span>
          </div>
          {ranked(listKey).map((row) => (
            <div key={row.user.id} className="xf-member-list-row">
              <Link to={`/profile/${row.user.username}`} className="flex items-center gap-2 min-w-0">
                <Avatar user={row.user} size={26} />
                <span className="gold-text font-semibold truncate hover:underline">{row.user.username}</span>
              </Link>
              <span className="prose-muted hidden sm:block truncate">{memberTitle(row.user)}</span>
              <span className="text-right tabular-nums">{row.messages.toLocaleString()}</span>
              <span className="text-right tabular-nums hidden md:block">{row.reactions.toLocaleString()}</span>
              <span className="text-right prose-muted hidden lg:block">{forumTime(row.user.createdAt)}</span>
            </div>
          ))}
        </section>
      )}
    </div>
  )
}

function MemberResultRow({
  row,
}: {
  row: { user: User; messages: number; reactions: number }
}) {
  return (
    <Link to={`/profile/${row.user.username}`} className="list-row flex items-center gap-3 px-3 py-2">
      <Avatar user={row.user} size={32} />
      <div className="min-w-0 flex-1">
        <div className="gold-text font-semibold">{row.user.username}</div>
        <div className="text-[12px] prose-muted">
          {memberTitle(row.user)} · {row.messages.toLocaleString()} messages · {row.reactions.toLocaleString()} reactions
        </div>
      </div>
    </Link>
  )
}
