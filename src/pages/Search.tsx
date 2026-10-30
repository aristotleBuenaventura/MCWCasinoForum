import { useEffect, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Avatar } from '../components/Avatar'
import { DocumentTitle } from '../components/DocumentTitle'
import { ThreadCard } from '../components/ThreadCard'
import { api } from '../lib/api'
import type { Comment, Thread, User } from '../types'

export function Search() {
  const [params, setParams] = useSearchParams()
  const initial = params.get('q') || ''
  const [q, setQ] = useState(initial)
  const query = (params.get('q') || '').trim()
  const [threads, setThreads] = useState<Thread[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [comments, setComments] = useState<Comment[]>([])

  useEffect(() => {
    if (!query) {
      setThreads([])
      setUsers([])
      setComments([])
      return
    }
    void api<{ threads: Thread[]; users: User[]; comments: Comment[] }>(
      `/api/search?q=${encodeURIComponent(query)}`,
    ).then((res) => {
      if (!res.ok) return
      setThreads(res.threads)
      setUsers(res.users)
      setComments(res.comments)
    })
  }, [query])

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    setParams(q.trim() ? { q: q.trim() } : {})
  }

  return (
    <div className="space-y-4">
      <DocumentTitle title={query ? `Search: ${query} — MCW Forum` : 'Search — MCW Forum'} />
      <h1 className="page-title gold-text">Advanced Search</h1>
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
            <h2 className="section-title">Threads ({threads.length})</h2>
            {threads.map((t) => (
              <ThreadCard key={t.id} thread={t} />
            ))}
            {threads.length === 0 && <p className="text-sm prose-muted">No threads matched.</p>}
          </section>

          <section className="space-y-2">
            <h2 className="section-title">Members ({users.length})</h2>
            <div className="forum-card divide-y divide-[var(--color-border)]">
              {users.map((u) => (
                <Link key={u.id} to={`/profile/${u.username}`} className="list-row flex gap-3 p-3">
                  <Avatar user={u} />
                  <div>
                    <div className="font-semibold gold-text">{u.displayName}</div>
                    <div className="text-sm prose-muted">@{u.username}</div>
                  </div>
                </Link>
              ))}
              {users.length === 0 && <div className="p-4 text-sm prose-muted">No members matched.</div>}
            </div>
          </section>

          <section className="space-y-2">
            <h2 className="section-title">Comments ({comments.length})</h2>
            <div className="forum-card divide-y divide-[var(--color-border)]">
              {comments.map((c) => (
                <Link key={c.id} to={`/thread/${c.threadId}`} className="list-row block p-3">
                  <p className="text-sm line-clamp-2">{c.content}</p>
                </Link>
              ))}
              {comments.length === 0 && <div className="p-4 text-sm prose-muted">No comments matched.</div>}
            </div>
          </section>
        </>
      )}
    </div>
  )
}
