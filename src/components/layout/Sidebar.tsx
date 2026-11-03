import { Link } from 'react-router-dom'
import { useForum } from '../../context/ForumContext'
import { localizeCategoryName } from '../../i18n/messages'
import { useLocale } from '../../i18n/locale'

export function Sidebar() {
  const { state, getUser } = useForum()
  const { t, lang } = useLocale()

  const replyCounts = new Map<string, number>()
  for (const c of state.comments) {
    replyCounts.set(c.authorId, (replyCounts.get(c.authorId) ?? 0) + 1)
  }
  const topContributors = [...replyCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([userId, replies]) => ({ user: getUser(userId), replies }))
    .filter((x) => x.user && !x.user.banned)

  const totalThreads = state.threads.length
  const totalMessages = state.threads.length + state.comments.length
  const members = state.users.filter((u) => !u.banned).length
  const latest = [...state.users]
    .filter((u) => !u.banned)
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))[0]

  return (
    <aside className="space-y-4">
      <section className="forum-card overflow-hidden">
        <div className="forum-list-head">
          {t('sidebar.topForums')}
        </div>
        <ul className="divide-y divide-[var(--color-border)]">
          {state.categories.slice(0, 5).map((c) => (
            <li key={c.id}>
              <Link to={`/forums#${c.id}`} className="list-row block px-3 py-2.5">
                <div className="font-medium text-sm text-[var(--color-gold)]">{localizeCategoryName(c.slug, c.name, lang)}</div>
                <div className="text-xs prose-muted">
                  {t('sidebar.nThreadsPosts', { threads: c.threadCount, posts: c.postCount })}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="forum-card overflow-hidden">
        <div className="forum-list-head">
          {t('sidebar.topContributors')}
        </div>
        <ul className="divide-y divide-[var(--color-border)]">
          {topContributors.map(({ user, replies }) => (
            <li key={user!.id} className="px-3 py-2.5 flex items-center justify-between gap-2 text-sm">
              <Link to={`/profile/${user!.username}`} className="text-[var(--color-gold)] font-medium hover:underline">
                {user!.displayName}
              </Link>
              <span className="prose-muted text-xs">{t('sidebar.nReplies', { n: replies })}</span>
            </li>
          ))}
          {topContributors.length === 0 && (
            <li className="px-3 py-3 text-sm prose-muted">{t('sidebar.noReplies')}</li>
          )}
        </ul>
      </section>

      <section className="forum-card overflow-hidden">
        <div className="forum-list-head">
          {t('sidebar.stats')}
        </div>
        <dl className="px-3 py-3 grid grid-cols-2 gap-y-2 text-sm">
          <dt className="prose-muted">{t('common.threads')}</dt>
          <dd className="text-right font-semibold">{totalThreads.toLocaleString()}</dd>
          <dt className="prose-muted">{t('common.messages')}</dt>
          <dd className="text-right font-semibold">{totalMessages.toLocaleString()}</dd>
          <dt className="prose-muted">{t('common.members')}</dt>
          <dd className="text-right font-semibold">{members.toLocaleString()}</dd>
          <dt className="prose-muted">{t('sidebar.latestMember')}</dt>
          <dd className="text-right font-semibold">
            {latest ? (
              <Link to={`/profile/${latest.username}`} className="text-[var(--color-gold)] hover:underline">
                {latest.username}
              </Link>
            ) : (
              '—'
            )}
          </dd>
        </dl>
      </section>
    </aside>
  )
}
