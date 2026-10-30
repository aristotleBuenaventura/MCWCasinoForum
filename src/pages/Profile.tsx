import { useMemo, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Avatar } from '../components/Avatar'
import { LoginLink } from '../components/LoginModal'
import { useToast } from '../components/Toast'
import { useForum } from '../context/ForumContext'
import { textFromBody } from '../lib/postBody'
import { avatarColor, fileToDataUrl, forumTime } from '../lib/utils'
import type { User } from '../types'

type Tab = 'activity' | 'postings' | 'about'

function memberTitle(user: User) {
  if (user.role === 'admin') return { text: 'Owner', className: 'bg-[#2a7a73] text-white' }
  if (user.role === 'moderator') return { text: 'Moderator', className: 'bg-[#b42318] text-white' }
  return { text: 'Registered Member', className: 'bg-[#3a3f4d] text-[#d5d8e0]' }
}

function snippet(text: string) {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (!clean) return ''
  return clean.length > 160 ? `${clean.slice(0, 157)}…` : clean
}

export function Profile() {
  const { username } = useParams()
  const toast = useToast()
  const {
    getUserByUsername,
    currentUser,
    state,
    toggleFollow,
    isFollowing,
    followerCount,
    followingCount,
    updateProfile,
    banUser,
    isMod,
    report,
  } = useForum()

  const user = getUserByUsername(username || '')
  const isSelf = !!currentUser && !!user && currentUser.id === user.id
  const [editing, setEditing] = useState(false)
  const [bio, setBio] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [tab, setTab] = useState<Tab>('activity')

  const threads = useMemo(
    () =>
      user
        ? [...state.threads]
            .filter((t) => t.authorId === user.id)
            .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
        : [],
    [state.threads, user],
  )

  const comments = useMemo(
    () => (user ? state.comments.filter((c) => c.authorId === user.id) : []),
    [state.comments, user],
  )

  const messages = threads.length + comments.length

  const reactionScore = useMemo(() => {
    if (!user) return 0
    const threadIds = new Set(state.threads.filter((t) => t.authorId === user.id).map((t) => t.id))
    const commentIds = new Set(state.comments.filter((c) => c.authorId === user.id).map((c) => c.id))
    return state.likes.filter((l) =>
      l.targetType === 'thread' ? threadIds.has(l.targetId) : commentIds.has(l.targetId),
    ).length
  }, [state.comments, state.likes, state.threads, user])

  const lastSeen = useMemo(() => {
    if (isSelf) return 'Now'
    const dates = [...threads.map((t) => t.createdAt), ...comments.map((c) => c.createdAt)]
    if (!dates.length) return user ? forumTime(user.createdAt) : '—'
    dates.sort((a, b) => +new Date(b) - +new Date(a))
    return forumTime(dates[0])
  }, [comments, isSelf, threads, user])

  const activity = useMemo(() => {
    if (!user) return []
    const items: {
      id: string
      createdAt: string
      kind: 'thread' | 'reply'
      threadId: string
      title: string
      forumName?: string
      forumSlug?: string
      excerpt: string
    }[] = []

    for (const t of threads) {
      const forum = state.categories.find((c) => c.id === t.forumId)
      items.push({
        id: `thread-${t.id}`,
        createdAt: t.createdAt,
        kind: 'thread',
        threadId: t.id,
        title: t.title,
        forumName: forum?.name,
        forumSlug: forum?.slug,
        excerpt: snippet(t.content || textFromBody(t.body)),
      })
    }

    for (const c of comments) {
      const thread = state.threads.find((t) => t.id === c.threadId)
      if (!thread) continue
      items.push({
        id: `reply-${c.id}`,
        createdAt: c.createdAt,
        kind: 'reply',
        threadId: thread.id,
        title: thread.title,
        excerpt: snippet(c.content || textFromBody(c.body)),
      })
    }

    return items.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
  }, [comments, state.categories, state.threads, threads, user])

  const followers = useMemo(
    () =>
      user
        ? state.follows
            .filter((f) => f.followingId === user.id)
            .map((f) => state.users.find((u) => u.id === f.followerId))
            .filter(Boolean)
        : [],
    [state.follows, state.users, user],
  )

  const following = useMemo(
    () =>
      user
        ? state.follows
            .filter((f) => f.followerId === user.id)
            .map((f) => state.users.find((u) => u.id === f.followingId))
            .filter(Boolean)
        : [],
    [state.follows, state.users, user],
  )

  if (!user || user.banned) {
    return (
      <div className="forum-card p-6 text-center">
        <p>User not found.</p>
        <Link to="/members" className="btn btn-primary mt-3 inline-flex">
          Browse members
        </Link>
      </div>
    )
  }

  const title = memberTitle(user)
  const markColor = avatarColor(user.username)

  const startEdit = () => {
    setDisplayName(user.displayName)
    setBio(user.bio)
    setEditing(true)
    setTab('about')
  }

  const saveProfile = (e: FormEvent) => {
    e.preventDefault()
    updateProfile({ displayName: displayName.trim() || user.username, bio: bio.trim() })
    setEditing(false)
    toast('Profile updated')
  }

  const onAvatar = async (file?: File) => {
    if (!file) return
    try {
      const url = await fileToDataUrl(file, 1_500_000)
      updateProfile({ avatar: url })
      toast('Avatar updated')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Upload failed')
    }
  }

  return (
    <div>
      <nav className="text-[12px] prose-muted mb-2">
        <Link to="/" className="gold-text hover:underline">Home</Link>
        {' > '}
        <Link to="/members" className="gold-text hover:underline">Members</Link>
        {' > '}
        {user.username}
      </nav>

      <section className="xf-profile">
        <div className="xf-profile-head">
          <div className="xf-profile-avatar">
            <Avatar user={user} size={96} />
            {isSelf && (
              <label className="btn btn-secondary text-[11px] h-7 mt-2 cursor-pointer w-full">
                Change photo
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => onAvatar(e.target.files?.[0])}
                />
              </label>
            )}
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="text-[22px] font-semibold leading-tight">{user.username}</h1>
                <span className={`role-pill mt-1 ${title.className}`}>{title.text}</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {isSelf ? (
                  <button type="button" className="btn-post" onClick={startEdit}>Edit profile</button>
                ) : currentUser ? (
                  <button
                    type="button"
                    className="btn-post"
                    onClick={() => {
                      const wasFollowing = isFollowing(user.id)
                      toggleFollow(user.id)
                      toast(wasFollowing ? 'Unfollowed' : 'Following')
                    }}
                  >
                    {isFollowing(user.id) ? 'Unfollow' : 'Follow'}
                  </button>
                ) : (
                  <LoginLink className="btn-post">Follow</LoginLink>
                )}
                {currentUser && !isSelf && (
                  <button
                    type="button"
                    className="xf-tool"
                    onClick={() => {
                      const reason = window.prompt('Why are you reporting this user?')
                      if (!reason) return
                      report('user', user.id, reason)
                      toast('Report submitted')
                    }}
                  >
                    Report
                  </button>
                )}
                {isMod && !isSelf && user.role === 'user' && (
                  <button
                    type="button"
                    className="xf-tool"
                    onClick={() => {
                      if (!window.confirm(`Remove @${user.username}?`)) return
                      banUser(user.id, true)
                      toast('User removed')
                    }}
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>

            <dl className="xf-profile-stats">
              <div>
                <dt>Joined</dt>
                <dd>{forumTime(user.createdAt)}</dd>
              </div>
              <div>
                <dt>Messages</dt>
                <dd>{messages}</dd>
              </div>
              <div>
                <dt>Last seen</dt>
                <dd>{lastSeen}</dd>
              </div>
              <div>
                <dt>Reaction score</dt>
                <dd>{reactionScore}</dd>
              </div>
            </dl>
          </div>
        </div>

        <div className="xf-tabs" role="tablist">
          {([
            ['activity', 'Recent activity'],
            ['postings', 'Postings'],
            ['about', 'About'],
          ] as const).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              className={`xf-tab ${tab === id ? 'is-active' : ''}`}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === 'activity' && (
          <div>
            {activity.length === 0 && (
              <div className="px-4 py-6 text-center text-sm prose-muted">No recent activity.</div>
            )}
            {activity.map((item) => (
              <article key={item.id} className="xf-activity">
                <div className="xf-activity-mark" style={{ background: markColor }}>
                  {user.username.slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] leading-snug">
                    <span className="gold-text font-semibold">{user.username}</span>
                    {item.kind === 'thread' ? ' posted the thread ' : ' replied to the thread '}
                    <Link to={`/thread/${item.threadId}`} className="gold-text hover:underline">
                      {item.title}
                    </Link>
                    {item.kind === 'thread' && item.forumSlug && (
                      <>
                        {' in '}
                        <Link to={`/communities/${item.forumSlug}`} className="gold-text hover:underline">
                          {item.forumName}
                        </Link>
                      </>
                    )}
                    .
                  </p>
                  {item.excerpt && <p className="xf-activity-excerpt">{item.excerpt}</p>}
                </div>
                <time className="xf-activity-time">{forumTime(item.createdAt)}</time>
              </article>
            ))}
          </div>
        )}

        {tab === 'postings' && (
          <div>
            {threads.map((t) => {
              const forum = state.categories.find((c) => c.id === t.forumId)
              const replies = state.comments.filter((c) => c.threadId === t.id).length
              return (
                <article key={t.id} className="xf-activity">
                  <div className="xf-activity-mark" style={{ background: markColor }}>
                    {user.username.slice(0, 1).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <Link to={`/thread/${t.id}`} className="text-[13px] font-semibold gold-text hover:underline">
                      {t.title}
                    </Link>
                    <div className="text-[11px] prose-muted mt-0.5">
                      {forum && (
                        <>
                          <Link to={`/communities/${forum.slug}`} className="hover:text-[var(--color-gold)]">
                            {forum.name}
                          </Link>
                          {' · '}
                        </>
                      )}
                      Replies: {replies} · Views: {t.views}
                    </div>
                  </div>
                  <time className="xf-activity-time">{forumTime(t.createdAt)}</time>
                </article>
              )
            })}
            {threads.length === 0 && (
              <div className="px-4 py-6 text-center text-sm prose-muted">No threads yet.</div>
            )}
          </div>
        )}

        {tab === 'about' && (
          <div className="xf-about">
            {editing ? (
              <form onSubmit={saveProfile} className="space-y-3">
                <div>
                  <label className="text-sm font-medium">Display name</label>
                  <input className="input mt-1" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
                </div>
                <div>
                  <label className="text-sm font-medium">About</label>
                  <textarea className="input mt-1 min-h-24" value={bio} onChange={(e) => setBio(e.target.value)} />
                </div>
                <div className="flex gap-2">
                  <button type="submit" className="btn-post">Save</button>
                  <button type="button" className="xf-tool" onClick={() => setEditing(false)}>Cancel</button>
                </div>
              </form>
            ) : (
              <>
                <dl className="xf-about-list">
                  <div>
                    <dt>Username</dt>
                    <dd>{user.username}</dd>
                  </div>
                  <div>
                    <dt>Display name</dt>
                    <dd>{user.displayName}</dd>
                  </div>
                  <div>
                    <dt>Location</dt>
                    <dd className="prose-muted">Not set</dd>
                  </div>
                  <div>
                    <dt>Followers</dt>
                    <dd>{followerCount(user.id)}</dd>
                  </div>
                  <div>
                    <dt>Following</dt>
                    <dd>{followingCount(user.id)}</dd>
                  </div>
                </dl>
                <div className="mt-4">
                  <div className="text-[12px] prose-muted mb-1">About</div>
                  <p className="text-[13px] whitespace-pre-wrap">{user.bio || 'No information to display.'}</p>
                </div>
                {(followers.length > 0 || following.length > 0) && (
                  <div className="mt-5 grid sm:grid-cols-2 gap-4">
                    <UserList title="Followers" users={followers as User[]} empty="No followers yet." />
                    <UserList title="Following" users={following as User[]} empty="Not following anyone yet." />
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </section>
    </div>
  )
}

function UserList({
  title,
  users,
  empty,
}: {
  title: string
  users: User[]
  empty: string
}) {
  return (
    <div>
      <div className="text-[12px] prose-muted mb-2">{title}</div>
      {users.length === 0 ? (
        <p className="text-[12px] prose-muted">{empty}</p>
      ) : (
        <ul className="space-y-2">
          {users.map((u) => (
            <li key={u.id}>
              <Link to={`/profile/${u.username}`} className="flex items-center gap-2 hover:text-[var(--color-gold)]">
                <Avatar user={u} size={24} />
                <span className="text-[13px]">{u.username}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
