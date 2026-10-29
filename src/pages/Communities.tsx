import { ChevronDown, MessageCircle, Zap } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Avatar } from '../components/Avatar'
import { useForum } from '../context/ForumContext'
import { compactNumber, forumTime } from '../lib/utils'
import type { Thread } from '../types'

export function Communities() {
  const { topCategories, childCategories, state, getUser } = useForum()
  const [params, setParams] = useSearchParams()
  const newOnly = params.get('new') === '1'
  const [openSubs, setOpenSubs] = useState<Record<string, boolean>>({})

  const rows = useMemo(() => {
    return topCategories.map((category) => {
      const children = childCategories(category.id)
      const ids = [category.id, ...children.map((c) => c.id)]
      const catThreads = state.threads.filter((t) => ids.includes(t.forumId))
      const latest = [...catThreads].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))[0] as Thread | undefined
      const messages = catThreads.length + state.comments.filter((c) => catThreads.some((t) => t.id === c.threadId)).length
      return { category, children, threads: catThreads.length, messages, latest }
    })
  }, [topCategories, childCategories, state.threads, state.comments])

  const visible = newOnly
    ? rows.filter((r) => r.latest && Date.now() - +new Date(r.latest.createdAt) < 48 * 3600 * 1000)
    : rows

  return (
    <div className="max-w-[1100px] mx-auto">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-[15px] font-semibold">Forum list</h1>
        <button
          type="button"
          className={`btn h-8 text-[12px] ${newOnly ? 'btn-primary' : 'btn-accent'}`}
          onClick={() => setParams(newOnly ? {} : { new: '1' })}
        >
          <Zap size={13} /> New posts
        </button>
      </div>

      <section className="forum-list">
        <div className="forum-list-head">
          <div className="text-[13px] gold-text font-semibold">MCW Forum</div>
          <ChevronDown size={14} className="text-[var(--color-gold)]" />
        </div>

        {visible.map(({ category, children, threads, messages, latest }) => {
          const author = latest ? getUser(latest.authorId) : null
          const expanded = !!openSubs[category.id]
          return (
            <div key={category.id}>
              <article className="forum-row">
                <MessageCircle size={18} className="text-[#c45c4a] shrink-0" />
                <div className="min-w-0">
                  <Link to={`/communities/${category.slug}`} className="text-[14px] font-semibold gold-text hover:underline">
                    {category.name}
                  </Link>
                  <p className="text-[12px] prose-muted mt-0.5 leading-snug">{category.description}</p>
                  {children.length > 0 && (
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                      {children.slice(0, 2).map((child) => (
                        <Link key={child.id} to={`/communities/${child.slug}`} className="text-[12px] gold-text hover:underline">
                          {child.name}
                        </Link>
                      ))}
                      {children.length > 2 && (
                        <button
                          type="button"
                          className="text-[12px] gold-text hover:underline inline-flex items-center gap-1"
                          onClick={() => setOpenSubs((s) => ({ ...s, [category.id]: !s[category.id] }))}
                        >
                          Sub-forums <ChevronDown size={12} className={expanded ? 'rotate-180' : ''} />
                        </button>
                      )}
                    </div>
                  )}
                </div>
                <div className="stat-col text-[12px] prose-muted">
                  <div>Threads</div>
                  <div className="text-[var(--color-ink)] font-medium">{compactNumber(threads)}</div>
                </div>
                <div className="stat-col text-[12px] prose-muted">
                  <div>Messages</div>
                  <div className="text-[var(--color-ink)] font-medium">{compactNumber(messages)}</div>
                </div>
                <div className="last-col min-w-0 flex items-start gap-2">
                  {latest ? (
                    <>
                      <Avatar user={author} size={28} />
                      <div className="min-w-0">
                        <Link to={`/thread/${latest.id}`} className="block text-[12px] gold-text truncate hover:underline">
                          {latest.title}
                        </Link>
                        <div className="text-[11px] prose-muted truncate">
                          {forumTime(latest.createdAt)} · {author?.username}
                        </div>
                      </div>
                    </>
                  ) : (
                    <span className="text-[12px] prose-muted">No threads yet</span>
                  )}
                </div>
              </article>
              {expanded && children.length > 2 && (
                <div className="px-12 pb-3 flex flex-wrap gap-x-4 gap-y-1">
                  {children.slice(2).map((child) => (
                    <Link key={child.id} to={`/communities/${child.slug}`} className="text-[12px] gold-text hover:underline">
                      {child.name}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )
        })}
        {visible.length === 0 && (
          <div className="p-6 text-center text-sm prose-muted">No new posts in the last 48 hours.</div>
        )}
      </section>
    </div>
  )
}
