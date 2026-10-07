import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { createSeedState } from '../data/seed'
import { uid } from '../lib/utils'
import type {
  Comment,
  ForumState,
  MediaType,
  Notification,
  Role,
  Thread,
  User,
} from '../types'

const STORAGE_KEY = 'mcw-casino-forum-v1'

type RegisterInput = {
  username: string
  email: string
  password: string
  displayName: string
}

type CreateThreadInput = {
  forumId: string
  title: string
  content: string
  mediaUrl?: string | null
  mediaType?: MediaType
}

type ForumContextValue = {
  state: ForumState
  currentUser: User | null
  isMod: boolean
  register: (input: RegisterInput) => { ok: true } | { ok: false; error: string }
  login: (usernameOrEmail: string, password: string) => { ok: true } | { ok: false; error: string }
  logout: () => void
  updateProfile: (patch: Partial<Pick<User, 'displayName' | 'bio' | 'avatar'>>) => void
  createThread: (input: CreateThreadInput) => Thread | { error: string }
  updateThread: (id: string, patch: Partial<Pick<Thread, 'title' | 'content'>>) => void
  deleteThread: (id: string) => void
  addComment: (threadId: string, content: string, parentId?: string | null) => Comment | { error: string }
  deleteComment: (id: string) => void
  toggleLike: (targetType: 'thread' | 'comment', targetId: string) => void
  isLiked: (targetType: 'thread' | 'comment', targetId: string) => boolean
  likeCount: (targetType: 'thread' | 'comment', targetId: string) => number
  toggleFollow: (userId: string) => void
  isFollowing: (userId: string) => boolean
  followerCount: (userId: string) => number
  followingCount: (userId: string) => number
  report: (targetType: 'thread' | 'comment' | 'user', targetId: string, reason: string) => void
  resolveReport: (id: string) => void
  banUser: (userId: string, banned?: boolean) => void
  setRole: (userId: string, role: Role) => void
  markNotificationsRead: () => void
  toggleDarkMode: () => void
  resetDemoData: () => void
  getUser: (id: string) => User | undefined
  getUserByUsername: (username: string) => User | undefined
  unreadCount: number
}

const ForumContext = createContext<ForumContextValue | null>(null)

function loadState(): ForumState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as ForumState
  } catch {
    /* ignore */
  }
  return createSeedState()
}

function recalculateCategories(state: ForumState): ForumState {
  const categories = state.categories.map((c) => {
    const catThreads = state.threads.filter((t) => t.forumId === c.id)
    const postCount =
      catThreads.length +
      state.comments.filter((cm) => catThreads.some((t) => t.id === cm.threadId)).length
    return { ...c, threadCount: catThreads.length, postCount }
  })
  return { ...state, categories }
}

function pushNotif(
  state: ForumState,
  notif: Omit<Notification, 'id' | 'read' | 'createdAt'> & { read?: boolean },
): ForumState {
  if (!notif.userId || notif.userId === state.currentUserId) return state
  return {
    ...state,
    notifications: [
      {
        id: uid('notif'),
        read: notif.read ?? false,
        createdAt: new Date().toISOString(),
        ...notif,
      },
      ...state.notifications,
    ],
  }
}

export function ForumProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ForumState>(() => loadState())

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }, [state])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', state.darkMode)
  }, [state.darkMode])

  const currentUser = useMemo(
    () => state.users.find((u) => u.id === state.currentUserId && !u.banned) ?? null,
    [state.users, state.currentUserId],
  )

  const isMod = !!currentUser && (currentUser.role === 'moderator' || currentUser.role === 'admin')

  const unreadCount = useMemo(
    () =>
      currentUser
        ? state.notifications.filter((n) => n.userId === currentUser.id && !n.read).length
        : 0,
    [state.notifications, currentUser],
  )

  const getUser = useCallback((id: string) => state.users.find((u) => u.id === id), [state.users])

  const getUserByUsername = useCallback(
    (username: string) => state.users.find((u) => u.username.toLowerCase() === username.toLowerCase()),
    [state.users],
  )

  const register: ForumContextValue['register'] = (input) => {
    const username = input.username.trim().toLowerCase()
    const email = input.email.trim().toLowerCase()
    if (!/^[a-z0-9_]{3,20}$/.test(username)) {
      return { ok: false, error: 'Username must be 3–20 chars (letters, numbers, underscore).' }
    }
    if (!email.includes('@')) return { ok: false, error: 'Enter a valid email.' }
    if (input.password.length < 6) return { ok: false, error: 'Password must be at least 6 characters.' }
    if (state.users.some((u) => u.username === username)) {
      return { ok: false, error: 'Username already taken.' }
    }
    if (state.users.some((u) => u.email === email)) {
      return { ok: false, error: 'Email already registered.' }
    }

    const user: User = {
      id: uid('user'),
      username,
      email,
      password: input.password,
      displayName: input.displayName.trim() || username,
      bio: '',
      avatar: '',
      role: 'user',
      banned: false,
      createdAt: new Date().toISOString(),
    }

    setState((s) => ({ ...s, users: [...s.users, user], currentUserId: user.id }))
    return { ok: true }
  }

  const login: ForumContextValue['login'] = (usernameOrEmail, password) => {
    const key = usernameOrEmail.trim().toLowerCase()
    const user = state.users.find(
      (u) => u.username === key || u.email === key,
    )
    if (!user || user.password !== password) {
      return { ok: false, error: 'Invalid username/email or password.' }
    }
    if (user.banned) return { ok: false, error: 'This account has been removed by a moderator.' }
    setState((s) => ({ ...s, currentUserId: user.id }))
    return { ok: true }
  }

  const logout = () => setState((s) => ({ ...s, currentUserId: null }))

  const updateProfile: ForumContextValue['updateProfile'] = (patch) => {
    if (!currentUser) return
    setState((s) => ({
      ...s,
      users: s.users.map((u) => (u.id === currentUser.id ? { ...u, ...patch } : u)),
    }))
  }

  const createThread: ForumContextValue['createThread'] = (input) => {
    if (!currentUser) return { error: 'Please log in to create a thread.' }
    if (!input.title.trim() || !input.content.trim()) return { error: 'Title and content are required.' }

    const thread: Thread = {
      id: uid('thread'),
      forumId: input.forumId,
      authorId: currentUser.id,
      title: input.title.trim(),
      content: input.content.trim(),
      mediaUrl: input.mediaUrl ?? null,
      mediaType: input.mediaType ?? null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      views: 0,
    }

    setState((s) => recalculateCategories({ ...s, threads: [thread, ...s.threads] }))
    return thread
  }

  const updateThread: ForumContextValue['updateThread'] = (id, patch) => {
    setState((s) => ({
      ...s,
      threads: s.threads.map((t) =>
        t.id === id ? { ...t, ...patch, updatedAt: new Date().toISOString() } : t,
      ),
    }))
  }

  const deleteThread: ForumContextValue['deleteThread'] = (id) => {
    setState((s) => {
      let next = {
        ...s,
        threads: s.threads.filter((t) => t.id !== id),
        comments: s.comments.filter((c) => c.threadId !== id),
        likes: s.likes.filter((l) => !(l.targetType === 'thread' && l.targetId === id)),
        reports: s.reports.map((r) =>
          r.targetType === 'thread' && r.targetId === id ? { ...r, status: 'resolved' as const } : r,
        ),
      }
      const thread = s.threads.find((t) => t.id === id)
      if (thread && currentUser) {
        next = pushNotif(next, {
          userId: thread.authorId,
          type: 'mod',
          message: `Your thread "${thread.title}" was removed by a moderator.`,
          link: '/',
        })
      }
      return recalculateCategories(next)
    })
  }

  const addComment: ForumContextValue['addComment'] = (threadId, content, parentId = null) => {
    if (!currentUser) return { error: 'Please log in to comment.' }
    if (!content.trim()) return { error: 'Comment cannot be empty.' }

    const comment: Comment = {
      id: uid('comment'),
      threadId,
      authorId: currentUser.id,
      parentId,
      content: content.trim(),
      createdAt: new Date().toISOString(),
    }

    setState((s) => {
      let next = { ...s, comments: [...s.comments, comment] }
      const thread = s.threads.find((t) => t.id === threadId)
      if (thread) {
        next = pushNotif(next, {
          userId: thread.authorId,
          type: 'reply',
          message: `${currentUser.username} replied to your thread`,
          link: `/thread/${threadId}`,
        })
      }
      if (parentId) {
        const parent = s.comments.find((c) => c.id === parentId)
        if (parent) {
          next = pushNotif(next, {
            userId: parent.authorId,
            type: 'reply',
            message: `${currentUser.username} replied to your comment`,
            link: `/thread/${threadId}`,
          })
        }
      }
      return recalculateCategories(next)
    })

    return comment
  }

  const deleteComment: ForumContextValue['deleteComment'] = (id) => {
    setState((s) =>
      recalculateCategories({
        ...s,
        comments: s.comments.filter((c) => c.id !== id && c.parentId !== id),
        likes: s.likes.filter((l) => !(l.targetType === 'comment' && l.targetId === id)),
        reports: s.reports.map((r) =>
          r.targetType === 'comment' && r.targetId === id ? { ...r, status: 'resolved' as const } : r,
        ),
      }),
    )
  }

  const toggleLike: ForumContextValue['toggleLike'] = (targetType, targetId) => {
    if (!currentUser) return
    setState((s) => {
      const existing = s.likes.find(
        (l) => l.userId === currentUser.id && l.targetType === targetType && l.targetId === targetId,
      )
      if (existing) {
        return { ...s, likes: s.likes.filter((l) => l.id !== existing.id) }
      }

      let next: ForumState = {
        ...s,
        likes: [
          ...s.likes,
          { id: uid('like'), userId: currentUser.id, targetType, targetId },
        ],
      }

      if (targetType === 'thread') {
        const thread = s.threads.find((t) => t.id === targetId)
        if (thread) {
          next = pushNotif(next, {
            userId: thread.authorId,
            type: 'like',
            message: `${currentUser.username} liked your thread`,
            link: `/thread/${targetId}`,
          })
        }
      } else {
        const comment = s.comments.find((c) => c.id === targetId)
        if (comment) {
          next = pushNotif(next, {
            userId: comment.authorId,
            type: 'like',
            message: `${currentUser.username} liked your comment`,
            link: `/thread/${comment.threadId}`,
          })
        }
      }
      return next
    })
  }

  const isLiked = (targetType: 'thread' | 'comment', targetId: string) =>
    !!currentUser &&
    state.likes.some(
      (l) => l.userId === currentUser.id && l.targetType === targetType && l.targetId === targetId,
    )

  const likeCount = (targetType: 'thread' | 'comment', targetId: string) =>
    state.likes.filter((l) => l.targetType === targetType && l.targetId === targetId).length

  const toggleFollow: ForumContextValue['toggleFollow'] = (userId) => {
    if (!currentUser || currentUser.id === userId) return
    setState((s) => {
      const existing = s.follows.find(
        (f) => f.followerId === currentUser.id && f.followingId === userId,
      )
      if (existing) {
        return { ...s, follows: s.follows.filter((f) => f.id !== existing.id) }
      }
      let next: ForumState = {
        ...s,
        follows: [
          ...s.follows,
          { id: uid('follow'), followerId: currentUser.id, followingId: userId },
        ],
      }
      next = pushNotif(next, {
        userId,
        type: 'follow',
        message: `${currentUser.username} started following you`,
        link: `/profile/${currentUser.username}`,
      })
      return next
    })
  }

  const isFollowing = (userId: string) =>
    !!currentUser &&
    state.follows.some((f) => f.followerId === currentUser.id && f.followingId === userId)

  const followerCount = (userId: string) =>
    state.follows.filter((f) => f.followingId === userId).length

  const followingCount = (userId: string) =>
    state.follows.filter((f) => f.followerId === userId).length

  const report: ForumContextValue['report'] = (targetType, targetId, reason) => {
    if (!currentUser) return
    setState((s) => ({
      ...s,
      reports: [
        {
          id: uid('report'),
          reporterId: currentUser.id,
          targetType,
          targetId,
          reason: reason.trim() || 'No reason provided',
          status: 'open',
          createdAt: new Date().toISOString(),
        },
        ...s.reports,
      ],
    }))
  }

  const resolveReport: ForumContextValue['resolveReport'] = (id) => {
    if (!isMod) return
    setState((s) => ({
      ...s,
      reports: s.reports.map((r) => (r.id === id ? { ...r, status: 'resolved' } : r)),
    }))
  }

  const banUser: ForumContextValue['banUser'] = (userId, banned = true) => {
    if (!isMod) return
    setState((s) => ({
      ...s,
      users: s.users.map((u) => (u.id === userId && u.role === 'user' ? { ...u, banned } : u)),
      currentUserId: banned && s.currentUserId === userId ? null : s.currentUserId,
    }))
  }

  const setRole: ForumContextValue['setRole'] = (userId, role) => {
    if (!currentUser || currentUser.role !== 'admin') return
    setState((s) => ({
      ...s,
      users: s.users.map((u) => (u.id === userId ? { ...u, role } : u)),
    }))
  }

  const markNotificationsRead = () => {
    if (!currentUser) return
    setState((s) => ({
      ...s,
      notifications: s.notifications.map((n) =>
        n.userId === currentUser.id ? { ...n, read: true } : n,
      ),
    }))
  }

  const toggleDarkMode = () => setState((s) => ({ ...s, darkMode: !s.darkMode }))

  const resetDemoData = () => setState(createSeedState())

  const value: ForumContextValue = {
    state,
    currentUser,
    isMod,
    register,
    login,
    logout,
    updateProfile,
    createThread,
    updateThread,
    deleteThread,
    addComment,
    deleteComment,
    toggleLike,
    isLiked,
    likeCount,
    toggleFollow,
    isFollowing,
    followerCount,
    followingCount,
    report,
    resolveReport,
    banUser,
    setRole,
    markNotificationsRead,
    toggleDarkMode,
    resetDemoData,
    getUser,
    getUserByUsername,
    unreadCount,
  }

  return <ForumContext.Provider value={value}>{children}</ForumContext.Provider>
}

export function useForum() {
  const ctx = useContext(ForumContext)
  if (!ctx) throw new Error('useForum must be used within ForumProvider')
  return ctx
}
