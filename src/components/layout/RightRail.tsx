import { Shield } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useForum } from '../../context/ForumContext'
import { localizeCategoryName } from '../../i18n/messages'
import { useLocale } from '../../i18n/locale'
import { AdRotator } from '../AdRotator'
import { Avatar } from '../Avatar'
import { Username } from '../Username'

const ONLINE_SHOW = 8

export function RightRail() {
  const { state, onlineUsers, onlineCount } = useForum()
  const { t, lang } = useLocale()

  const members = state.users.filter((u) => !u.banned).length
  const messagesCount = state.threads.length + state.comments.length
  const featured = state.categories.filter((c) => c.featured).slice(0, 4)
  const deepCount = (id: string) => {
    const ids = [id, ...state.categories.filter((c) => c.parentId === id).map((c) => c.id)]
    return state.threads.filter((t) => ids.includes(t.forumId)).length
  }
  const games = [...state.trendingGames].sort((a, b) => a.order - b.order)
  const shownOnline = onlineUsers.slice(0, ONLINE_SHOW)
  const moreOnline = Math.max(0, onlineCount - shownOnline.length)

  return (
    <aside className="space-y-3">
      <section className="forum-card overflow-hidden">
        <div className="px-3 py-2 flex items-center justify-between">
          <div className="section-title">{t('railRight.trendingGames')}</div>
          <Link to="/communities/slot-games" className="text-[11px] gold-text hover:underline">{t('railRight.viewMore')}</Link>
        </div>
        <ul>
          {games.map((g) => (
            <li key={g.id}>
              <Link to={g.url || '/communities'} className="list-row flex items-center gap-2.5 px-3 py-2">
                <img src={g.imageUrl} alt="" className="w-9 h-9 rounded object-cover shrink-0" />
                <div className="min-w-0">
                  <div className="text-[13px] font-medium gold-text truncate">{g.title}</div>
                  <div className="text-[11px] prose-muted truncate">{g.subtitle}</div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="forum-card overflow-hidden">
        <div className="px-3 py-2 flex items-center justify-between gap-2">
          <div className="section-title">{t('railRight.online')}</div>
          <span className="text-[11px] tabular-nums prose-muted">{onlineCount}</span>
        </div>
        <ul>
          {shownOnline.map((user) => (
            <li key={user.id} className="px-3 py-1.5 flex items-center gap-2 text-[13px] min-w-0">
              <span className="relative shrink-0">
                <Avatar user={user} size={22} />
                <span
                  className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-400 ring-2 ring-[var(--color-panel)]"
                  aria-hidden="true"
                />
              </span>
              <span className="xf-notable-name min-w-0">
                <Username user={user} />
              </span>
            </li>
          ))}
          {shownOnline.length === 0 && (
            <li className="px-3 py-2.5 text-[12px] prose-muted">{t('railRight.onlineEmpty')}</li>
          )}
        </ul>
        {moreOnline > 0 && (
          <Link
            to="/members"
            className="block px-3 py-2 text-[11px] gold-text hover:underline border-t border-[var(--color-border)]"
          >
            {t('railRight.onlineMore', { n: moreOnline })}
          </Link>
        )}
      </section>

      <section className="forum-card p-3">
        <div className="section-title mb-2">{t('railRight.responsible')}</div>
        <p className="text-[12px] prose-muted leading-relaxed">
          {t('railRight.responsibleBody')}
        </p>
        <Link to="/communities/responsible-gambling" className="mt-2 inline-flex items-center gap-1 text-[12px] gold-text hover:underline">
          <Shield size={12} /> {t('railRight.readTools')}
        </Link>
      </section>

      <section className="forum-card overflow-hidden">
        <div className="px-3 py-2 section-title">{t('railRight.stats')}</div>
        <dl className="px-3 pb-3 grid grid-cols-2 gap-y-1.5 text-[13px]">
          <dt className="prose-muted">{t('common.threads')}</dt>
          <dd className="text-right font-semibold">{state.threads.length}</dd>
          <dt className="prose-muted">{t('common.messages')}</dt>
          <dd className="text-right font-semibold">{messagesCount}</dd>
          <dt className="prose-muted">{t('common.members')}</dt>
          <dd className="text-right font-semibold">{members}</dd>
          <dt className="prose-muted">{t('railRight.activeUsers')}</dt>
          <dd className="text-right font-semibold">{onlineCount}</dd>
        </dl>
      </section>

      <AdRotator slot="right-1" heightClass="aspect-[9/16] h-auto" />

      <section className="forum-card p-3">
        <div className="section-title mb-2">{t('railRight.weeklyAwards')}</div>
        {[...state.providers].sort((a, b) => b.rating - a.rating).slice(0, 3).map((p, i) => (
          <div key={p.id} className="flex items-center justify-between text-[12px] py-1">
            <span className="prose-muted">{i + 1}. {p.name}</span>
            <span className="gold-text">{p.rating.toFixed(1)}</span>
          </div>
        ))}
      </section>

      <section className="forum-card overflow-hidden">
        <div className="px-3 py-2 section-title">{t('railRight.featured')}</div>
        <ul>
          {featured.map((c) => (
            <li key={c.id}>
              <Link to={`/communities/${c.slug}`} className="list-row block px-3 py-2">
                <div className="text-[13px] font-medium gold-text">{localizeCategoryName(c.slug, c.name, lang)}</div>
                <div className="text-[11px] prose-muted">{t('railRight.nThreads', { n: deepCount(c.id) })}</div>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </aside>
  )
}
