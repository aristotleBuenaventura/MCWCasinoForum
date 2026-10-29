import { useMemo, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Avatar } from '../components/Avatar'
import { ThreadCard } from '../components/ThreadCard'
import { useForum } from '../context/ForumContext'

export function Search() {
  const [params, setParams] = useSearchParams()
  const initial = params.get('q') || ''
  const [q, setQ] = useState(initial)
  const { state, getUser } = useForum()

  const query = (params.get('q') || '').trim().toLowerCase()

  const results = useMemo(() => {
    if (!query) return { threads: [], users: [], comments: [] }
    const threads = state.threads.filter(
      (t) => t.title.toLowerCase().includes(query) || t.content.toLowerCase().includes(query),
    )
    const users = state.users.filter(
      (u) =>
        !u.banned &&
        (u.username.includes(query) ||
          u.displayName.toLowerCase().includes(query) ||
          u.bio.toLowerCase().includes(query)),
    )
    const comments = state.comments.filter((c) => c.content.toLowerCase().includes(query))
    return { threads, users, comments }
  }, [query, state.threads, state.users, state.comments])

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    setParams(q.trim() ? { q: q.trim() } : {})
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Advanced Search</h1>
      <form onSubmit={onSubmit} className="forum-card p-4 flex gap-2">
        <input
          className="input"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search threads, members, comments..."
        />
        <button type="submit" className="btn btn-primary shrink-0">
          Search
        </button>
      </form>

      {!query && <p className="prose-muted text-sm">Enter a keyword to search the forum.</p>}

      {query && (
        <>
          <section className="space-y-3">
            <h2 className="font-semibold">Threads ({results.threads.length})</h2>
            {results.threads.map((t) => (
              <ThreadCard key={t.id} thread={t} />
            ))}
            {results.threads.length === 0 && <p className="text-sm prose-muted">No threads matched.</p>}
          </section>

          <section className="space-y-2">
            <h2 className="font-semibold">Members ({results.users.length})</h2>
            <div className="forum-card divide-y divide-[var(--color-border)] dark:divide-[#2a3542]">
              {results.users.map((u) => (
                <Link key={u.id} to={`/profile/${u.username}`} className="flex gap-3 p-3 hover:bg-[white]/40">
                  <Avatar user={u} />
                  <div>
                    <div className="font-semibold">{u.displayName}</div>
                    <div className="text-sm prose-muted">@{u.username}</div>
                  </div>
                </Link>
              ))}
              {results.users.length === 0 && <div className="p-4 text-sm prose-muted">No members matched.</div>}
            </div>
          </section>

          <section className="space-y-2">
            <h2 className="font-semibold">Comments ({results.comments.length})</h2>
            <div className="space-y-2">
              {results.comments.map((c) => {
                const author = getUser(c.authorId)
                return (
                  <Link key={c.id} to={`/thread/${c.threadId}`} className="forum-card p-3 block hover:bg-[white]/30">
                    <div className="text-sm prose-muted">@{author?.username}</div>
                    <p className="text-sm mt-1 line-clamp-2">{c.content}</p>
                  </Link>
                )
              })}
              {results.comments.length === 0 && <p className="text-sm prose-muted">No comments matched.</p>}
            </div>
          </section>
        </>
      )}
    </div>
  )
}
