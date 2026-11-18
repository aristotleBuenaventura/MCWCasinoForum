import { useEffect, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Avatar } from '../components/Avatar'
import { Username } from '../components/Username'
import { rankDisplayKey } from '../lib/nameplate'
import { DocumentTitle } from '../components/DocumentTitle'
import { useLocale } from '../i18n/locale'
import { api } from '../lib/api'
import { readMembersCache, writeMembersCache, type MemberRow } from '../lib/membersCache'
import { forumTime } from '../lib/utils'
import type { User } from '../types'
import type { MessageKey } from '../i18n/messages'

type BoardKey = 'messages' | 'reactions' | 'media'

export function Members() {
  const { t, lang } = useLocale()
  const [params, setParams] = useSearchParams()
  const [q, setQ] = useState(params.get('username') || '')
  const listKey = (params.get('key') as BoardKey | null) || null
  const query = (params.get('username') || '').trim().toLowerCase()
  const [rows, setRows] = useState<MemberRow[]>([])

  const boards: { key: BoardKey; titleKey: MessageKey }[] = [
    { key: 'messages', titleKey: 'members.mostMessages' },
    { key: 'reactions', titleKey: 'members.highestReactions' },
    { key: 'media', titleKey: 'members.mostMedia' },
  ]

  useEffect(() => {
    const key = listKey || 'messages'
    const cached = readMembersCache(key, query)
    if (cached) {
      setRows(cached)
      return
    }
    const qs = new URLSearchParams({ key })
    if (query) qs.set('username', query)
    void api<{ members: MemberRow[] }>(`/api/members?${qs}`).then((res) => {
      if (!res.ok) return
      const next = (res.members || []).map((row) => ({
        ...row,
        messages: Number(row.messages ?? 0),
        reactions: Number(row.reactions ?? 0),
        media: Number(row.media ?? 0),
      }))
      setRows(next)
      writeMembersCache(key, query, next)
    })
  }, [listKey, query])

  const score = (row: MemberRow, key: BoardKey) => Number(row[key] ?? 0)

  const ranked = (key: BoardKey) =>
    [...rows].sort(
      (a, b) => score(b, key) - score(a, key) || a.user.username.localeCompare(b.user.username),
    )

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

  const board = boards.find((b) => b.key === listKey)

  return (
    <div className="max-w-[1100px] mx-auto space-y-3">
      <DocumentTitle title={`${t('members.title')} — MCW Forum`} description="Top members by messages, reactions, and media." />
      <div className="text-[12px] prose-muted">
        <Link to="/" className="gold-text hover:underline">{t('nav.home')}</Link>
        {' > '}
        {board ? (
          <>
            <Link to="/members" className="gold-text hover:underline">{t('members.notable')}</Link>
            {' > '}
            {t(board.titleKey)}
          </>
        ) : (
          t('members.notable')
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="page-title">{board ? t(board.titleKey) : t('members.notable')}</h1>
        <form onSubmit={onFind} className="flex items-center gap-1.5">
          <input
            className="input h-7 w-44 text-[13px]"
            placeholder={t('common.username')}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label={t('members.findMember')}
          />
          <button type="submit" className="btn btn-primary">{t('common.find')}</button>
        </form>
      </div>

      {query && (
        <section className="forum-list">
          <div className="forum-list-head">{t('members.searchResults')}</div>
          {matches.length === 0 && <div className="p-5 text-sm prose-muted">{t('members.noMatch')}</div>}
          {matches.map((row) => (
            <MemberResultRow key={row.user.id} row={row} />
          ))}
        </section>
      )}

      {!query && !board && (
        <div className="xf-notable">
          {boards.map((item) => {
            const list = ranked(item.key).slice(0, 5)
            return (
              <section key={item.key} className="xf-notable-col">
                <h2>{t(item.titleKey)}</h2>
                {list.length === 0 && <div className="py-3 text-[12px] prose-muted">{t('members.noMembers')}</div>}
                <ol className="m-0 p-0 list-none">
                  {list.map((row) => (
                    <li key={row.user.id} className="xf-notable-row">
                      <Avatar user={row.user} size={28} />
                      <span className="xf-notable-name">
                        <Username user={row.user} />
                      </span>
                      <span className="xf-notable-count">{score(row, item.key).toLocaleString()}</span>
                    </li>
                  ))}
                </ol>
                <Link to={`/members?key=${item.key}`} className="xf-see-more">{t('common.seeMore')}</Link>
              </section>
            )
          })}
        </div>
      )}

      {!query && board && (
        <section className="forum-list">
          <div className="xf-member-list-head">
            <span>{t('common.username')}</span>
            <span className="hidden sm:block">{t('common.title')}</span>
            <span className="text-right">{t('common.messages')}</span>
            <span className="text-right hidden md:block">{t('community.reactionScore')}</span>
            <span className="text-right hidden lg:block">{t('members.joined')}</span>
          </div>
          {ranked(listKey || 'messages').map((row) => (
            <div key={row.user.id} className="xf-member-list-row">
              <div className="flex items-center gap-2 min-w-0">
                <Link to={`/profile/${row.user.username}`} className="shrink-0">
                  <Avatar user={row.user} size={26} />
                </Link>
                <span className="xf-notable-name">
                  <Username user={row.user} label="username" />
                </span>
              </div>
              <span className="prose-muted hidden sm:block truncate">{t(rankDisplayKey(row.user))}</span>
              <span className="text-right tabular-nums">{row.messages.toLocaleString()}</span>
              <span className="text-right tabular-nums hidden md:block">{row.reactions.toLocaleString()}</span>
              <span className="text-right prose-muted hidden lg:block">{forumTime(row.user.createdAt, lang)}</span>
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
    <div className="list-row flex items-center gap-3 px-3 py-2">
      <Link to={`/profile/${row.user.username}`} className="shrink-0">
        <Avatar user={row.user} size={32} />
      </Link>
      <div className="min-w-0 flex-1">
        <span className="xf-notable-name">
          <Username user={row.user} label="username" />
        </span>
        <div className="text-[11px] prose-muted">{row.messages} · {row.reactions}</div>
      </div>
    </div>
  )
}
