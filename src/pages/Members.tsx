import { useEffect, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Avatar } from '../components/Avatar'
import { Username } from '../components/Username'
import { rankDisplayTitle } from '../lib/nameplate'
import { DocumentTitle } from '../components/DocumentTitle'
import { api } from '../lib/api'
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
  return rankDisplayTitle(user)
}

type MemberRow = { user: User; messages: number; reactions: number; media: number; lastAt?: string }

export function Members() {
  const [params, setParams] = useSearchParams()
  const [q, setQ] = useState(params.get('username') || '')
  const listKey = (params.get('key') as BoardKey | null) || null
  const query = (params.get('username') || '').trim().toLowerCase()
  const [rows, setRows] = useState<MemberRow[]>([])

  useEffect(() => {
    const key = listKey || 'messages'
    const qs = new URLSearchParams({ key })
    if (query) qs.set('username', query)
    void api<{ members: MemberRow[] }>(`/api/members?${qs}`).then((res) => {
      if (res.ok) setRows(res.members)
    })
  }, [listKey, query])

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
      <DocumentTitle title="Leaderboards — MCW Forum" description="Top members by messages, reactions, and media." />
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
                      <span className="xf-name-pill min-w-0" style={usernameBanner(row.user)}>
                        <Username user={row.user} />
                      </span>
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
          {ranked(listKey || 'messages').map((row) => (
            <div key={row.user.id} className="xf-member-list-row">
              <Link to={`/profile/${row.user.username}`} className="flex items-center gap-2 min-w-0">
                <Avatar user={row.user} size={26} />
                <Username user={row.user} label="username" className="truncate" />
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
        <Username user={row.user} label="username" link={false} />
        <div className="text-[12px] prose-muted">
          {memberTitle(row.user)} · {row.messages.toLocaleString()} messages · {row.reactions.toLocaleString()} reactions
        </div>
      </div>
    </Link>
  )
}
