import { Link } from 'react-router-dom'
import { useForum } from '../context/ForumContext'
import { timeAgo } from '../lib/utils'

export function Forums() {
  const { state, getUser } = useForum()

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Forum Listing</h1>
      <div className="forum-card overflow-hidden divide-y divide-[var(--color-border)] dark:divide-[#2a3542]">
        {state.categories.map((c) => {
          const latest = [...state.threads]
            .filter((t) => t.forumId === c.id)
            .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))[0]
          const author = latest ? getUser(latest.authorId) : null
          return (
            <section key={c.id} id={c.id} className="p-4 scroll-mt-20">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                <div>
                  <h2 className="font-semibold text-lg text-[var(--color-gold)]">{c.name}</h2>
                  <p className="text-sm prose-muted mt-1">{c.description}</p>
                  <div className="text-xs prose-muted mt-2">
                    {c.threadCount} threads · {c.postCount} messages
                  </div>
                </div>
                <div className="text-sm md:text-right min-w-[200px]">
                  {latest ? (
                    <>
                      <Link to={`/thread/${latest.id}`} className="text-[var(--color-gold)] hover:underline font-medium">
                        {latest.title}
                      </Link>
                      <div className="prose-muted text-xs mt-1">
                        by {author?.username} · {timeAgo(latest.createdAt)}
                      </div>
                    </>
                  ) : (
                    <span className="prose-muted">No threads yet</span>
                  )}
                </div>
              </div>
              <div className="mt-3">
                <Link to={`/create?forum=${c.id}`} className="btn btn-secondary text-sm">
                  Post in {c.name}
                </Link>
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}
