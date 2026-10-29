import { Link } from 'react-router-dom'
import { useForum } from '../context/ForumContext'
import { timeAgo } from '../lib/utils'

export function Communities() {
  const { topCategories, childCategories, state, getUser } = useForum()

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Communities</h1>
          <p className="text-sm prose-muted mt-1">Browse topics, then open a community to see its threads.</p>
        </div>
        <Link to="/create" className="btn btn-accent">New thread</Link>
      </div>

      {topCategories.map((parent) => {
        const children = childCategories(parent.id)
        const rows = children.length ? children : [parent]
        return (
          <section key={parent.id} className="forum-card overflow-hidden">
            <div className="px-4 py-3 border-b border-[var(--color-border)] flex items-center justify-between">
              <Link to={`/communities/${parent.slug}`} className="font-semibold gold-text hover:underline">
                {parent.name}
              </Link>
              <span className="text-xs prose-muted">{parent.description}</span>
            </div>
            <div className="hidden md:grid grid-cols-[1fr_90px_90px_220px] gap-3 px-4 py-2 text-[11px] uppercase tracking-wide prose-muted border-b border-[var(--color-border)]">
              <div>Forum</div>
              <div className="text-right">Threads</div>
              <div className="text-right">Posts</div>
              <div>Last post</div>
            </div>
            {rows.map((c) => {
              const latest = [...state.threads]
                .filter((t) => t.forumId === c.id)
                .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))[0]
              const author = latest ? getUser(latest.authorId) : null
              return (
                <div key={c.id} className="table-row grid md:grid-cols-[1fr_90px_90px_220px] gap-2 px-4 py-3 items-center">
                  <div>
                    <Link to={`/communities/${c.slug}`} className="font-medium hover:text-[var(--color-gold)]">
                      {c.name}
                    </Link>
                    <p className="text-xs prose-muted mt-0.5 line-clamp-1">{c.description}</p>
                  </div>
                  <div className="text-sm md:text-right prose-muted">{c.threadCount}</div>
                  <div className="text-sm md:text-right prose-muted">{c.postCount}</div>
                  <div className="text-xs prose-muted min-w-0">
                    {latest ? (
                      <>
                        <Link to={`/thread/${latest.id}`} className="block truncate gold-text hover:underline">
                          {latest.title}
                        </Link>
                        <div>
                          {author?.username} · {timeAgo(latest.createdAt)}
                        </div>
                      </>
                    ) : (
                      'No threads yet'
                    )}
                  </div>
                </div>
              )
            })}
          </section>
        )
      })}
    </div>
  )
}
