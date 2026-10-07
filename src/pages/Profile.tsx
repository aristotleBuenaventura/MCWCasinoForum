import { useMemo, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Avatar } from '../components/Avatar'
import { ThreadCard } from '../components/ThreadCard'
import { useToast } from '../components/Toast'
import { useForum } from '../context/ForumContext'
import { fileToDataUrl, timeAgo } from '../lib/utils'

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
  const [tab, setTab] = useState<'posts' | 'followers' | 'following'>('posts')

  const threads = useMemo(
    () =>
      user
        ? [...state.threads]
            .filter((t) => t.authorId === user.id)
            .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
        : [],
    [state.threads, user],
  )

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

  const startEdit = () => {
    setDisplayName(user.displayName)
    setBio(user.bio)
    setEditing(true)
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
    <div className="space-y-4">
      <section className="forum-card p-5">
        <div className="flex flex-col sm:flex-row gap-4 sm:items-start">
          <div className="flex flex-col items-center gap-2">
            <Avatar user={user} size={88} />
            {isSelf && (
              <label className="btn btn-secondary text-xs cursor-pointer">
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
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h1 className="text-2xl font-bold">{user.displayName}</h1>
                <div className="prose-muted">@{user.username}</div>
                {user.role !== 'user' && (
                  <span className="inline-block mt-1 text-xs px-2 py-0.5 rounded bg-[var(--color-brand-soft)] text-[var(--color-brand)] font-semibold uppercase">
                    {user.role}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {isSelf ? (
                  <button type="button" className="btn btn-secondary" onClick={startEdit}>
                    Edit profile
                  </button>
                ) : (
                  currentUser && (
                    <button
                      type="button"
                      className={`btn ${isFollowing(user.id) ? 'btn-secondary' : 'btn-primary'}`}
                      onClick={() => {
                        const wasFollowing = isFollowing(user.id)
                        toggleFollow(user.id)
                        toast(wasFollowing ? 'Unfollowed' : 'Following')
                      }}
                    >
                      {isFollowing(user.id) ? 'Following' : 'Follow'}
                    </button>
                  )
                )}
                {currentUser && !isSelf && (
                  <button
                    type="button"
                    className="btn btn-secondary"
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
                    className="btn btn-danger"
                    onClick={() => {
                      if (!window.confirm(`Remove @${user.username}?`)) return
                      banUser(user.id, true)
                      toast('User removed')
                    }}
                  >
                    Remove user
                  </button>
                )}
              </div>
            </div>
            <p className="mt-3 text-sm whitespace-pre-wrap">{user.bio || 'No bio yet.'}</p>
            <div className="mt-3 flex flex-wrap gap-4 text-sm">
              <button type="button" onClick={() => setTab('posts')} className="hover:text-[var(--color-brand)]">
                <strong>{threads.length}</strong> posts
              </button>
              <button type="button" onClick={() => setTab('followers')} className="hover:text-[var(--color-brand)]">
                <strong>{followerCount(user.id)}</strong> followers
              </button>
              <button type="button" onClick={() => setTab('following')} className="hover:text-[var(--color-brand)]">
                <strong>{followingCount(user.id)}</strong> following
              </button>
              <span className="prose-muted">Joined {timeAgo(user.createdAt)}</span>
            </div>
          </div>
        </div>

        {editing && (
          <form onSubmit={saveProfile} className="mt-4 border-t border-[var(--color-border)] pt-4 space-y-3">
            <div>
              <label className="text-sm font-medium">Display name</label>
              <input className="input mt-1" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium">Bio</label>
              <textarea className="input mt-1 min-h-24" value={bio} onChange={(e) => setBio(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <button type="submit" className="btn btn-primary">
                Save
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setEditing(false)}>
                Cancel
              </button>
            </div>
          </form>
        )}
      </section>

      {tab === 'posts' && (
        <div className="space-y-3">
          {threads.map((t) => (
            <ThreadCard key={t.id} thread={t} />
          ))}
          {threads.length === 0 && <div className="forum-card p-5 prose-muted text-center">No posts yet.</div>}
        </div>
      )}

      {tab === 'followers' && (
        <UserList users={followers as NonNullable<(typeof followers)[number]>[]} empty="No followers yet." />
      )}
      {tab === 'following' && (
        <UserList users={following as NonNullable<(typeof following)[number]>[]} empty="Not following anyone yet." />
      )}
    </div>
  )
}

function UserList({
  users,
  empty,
}: {
  users: { id: string; username: string; displayName: string; avatar: string; bio: string }[]
  empty: string
}) {
  if (users.length === 0) return <div className="forum-card p-5 prose-muted text-center">{empty}</div>
  return (
    <div className="forum-card divide-y divide-[var(--color-border)] dark:divide-[#2a3542]">
      {users.map((u) => (
        <Link key={u.id} to={`/profile/${u.username}`} className="flex gap-3 p-3 hover:bg-[var(--color-brand-soft)]/40 dark:hover:bg-[#243040]">
          <Avatar user={u} />
          <div>
            <div className="font-semibold">{u.displayName}</div>
            <div className="text-sm prose-muted">@{u.username}</div>
          </div>
        </Link>
      ))}
    </div>
  )
}
