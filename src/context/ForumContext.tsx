import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { api } from '../lib/api'
import { firstImageUrl, isBodyEmpty, persistBodyImages, textFromBody } from '../lib/postBody'
import type {
  Ad,
  AdSlot,
  CmsItem,
  Comment,
  ForumCategory,
  ForumState,
  GameProvider,
  PostBody,
  Role,
  Thread,
  User,
} from '../types'

type RegisterInput = {
  username: string
  email: string
  password: string
  displayName?: string
  dateOfBirth: string
  turnstileToken: string
}

type CreateThreadInput = {
  forumId: string
  title: string
  body: PostBody
}

type CategoryInput = {
  id?: string
  slug: string
  name: string
  description: string
  parentId: string | null
  featured: boolean
  order: number
}

type ForumContextValue = {
  state: ForumState
  ready: boolean
  bootError: string
  retry: () => void
  currentUser: User | null
  isMod: boolean
  isAdmin: boolean
  register: (input: RegisterInput) => Promise<{ ok: true } | { ok: false; error: string }>
  login: (
    usernameOrEmail: string,
    password: string,
    stayLoggedIn?: boolean,
  ) => Promise<{ ok: true } | { ok: false; error: string }>
  logout: () => void
  loginOpen: boolean
  openLogin: () => void
  closeLogin: () => void
  updateProfile: (patch: Partial<Pick<User, 'displayName' | 'bio' | 'avatar'>>) => void
  createThread: (input: CreateThreadInput) => Promise<Thread | { error: string }>
  updateThread: (id: string, patch: Partial<Pick<Thread, 'title' | 'content' | 'body' | 'mediaUrl' | 'mediaType'>>) => void
  deleteThread: (id: string) => void
  togglePin: (id: string) => void
  bumpViews: (id: string) => void
  addComment: (threadId: string, body: PostBody, parentId?: string | null) => Promise<Comment | { error: string }>
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
  resetDemoData: () => void
  getUser: (id: string) => User | undefined
  getUserByUsername: (username: string) => User | undefined
  getCategoryBySlug: (slug: string) => ForumCategory | undefined
  childCategories: (parentId: string) => ForumCategory[]
  leafCategories: ForumCategory[]
  topCategories: ForumCategory[]
  saveCategory: (input: CategoryInput) => Promise<{ ok: true } | { ok: false; error: string }>
  deleteCategory: (id: string) => Promise<{ ok: true } | { ok: false; error: string }>
  toggleFeatured: (id: string) => void
  saveAd: (ad: Omit<Ad, 'id'> & { id?: string }) => void
  deleteAd: (id: string) => void
  adsForSlot: (slot: AdSlot) => Ad[]
  setAdRotateSec: (sec: number) => void
  saveTrendingGame: (item: Omit<CmsItem, 'id'> & { id?: string }) => void
  deleteTrendingGame: (id: string) => void
  saveProvider: (item: Omit<GameProvider, 'id'> & { id?: string }) => void
  deleteProvider: (id: string) => void
  unreadCount: number
}

const emptyState: ForumState = {
  users: [],
  categories: [],
  threads: [],
  comments: [],
  likes: [],
  follows: [],
  notifications: [],
  reports: [],
  ads: [],
  adRotateSec: 5,
  trendingGames: [],
  providers: [],
  currentUserId: null,
}

const ForumContext = createContext<ForumContextValue | null>(null)

export function ForumProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ForumState>(emptyState)
  const [ready, setReady] = useState(false)
  const [bootError, setBootError] = useState('')
  const [loginOpen, setLoginOpen] = useState(false)
  const openLogin = useCallback(() => setLoginOpen(true), [])
  const closeLogin = useCallback(() => setLoginOpen(false), [])

  const refresh = useCallback(async () => {
    const res = await api<{ state: ForumState }>('/api/state')
    if (!res.ok) throw new Error(res.error)
    setState(res.state)
    setBootError('')
  }, [])

  const retry = useCallback(() => {
    setReady(false)
    void refresh()
      .then(() => setReady(true))
      .catch((err: Error) => {
        setBootError(err.message)
        setReady(true)
      })
  }, [refresh])

  useEffect(() => {
    document.documentElement.classList.add('dark')
    try {
      localStorage.removeItem('mcw-casino-forum-v4')
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    retry()
  }, [retry])

  const currentUser = useMemo(
    () => state.users.find((u) => u.id === state.currentUserId && !u.banned) ?? null,
    [state.users, state.currentUserId],
  )

  const isMod = !!currentUser && (currentUser.role === 'moderator' || currentUser.role === 'admin')
  const isAdmin = !!currentUser && currentUser.role === 'admin'

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

  const getCategoryBySlug = useCallback(
    (slug: string) => state.categories.find((c) => c.slug === slug),
    [state.categories],
  )

  const childCategories = useCallback(
    (parentId: string) =>
      [...state.categories].filter((c) => c.parentId === parentId).sort((a, b) => a.order - b.order),
    [state.categories],
  )

  const topCategories = useMemo(
    () => [...state.categories].filter((c) => !c.parentId).sort((a, b) => a.order - b.order),
    [state.categories],
  )

  const leafCategories = useMemo(
    () =>
      state.categories
        .filter((c) => !state.categories.some((x) => x.parentId === c.id))
        .sort((a, b) => a.order - b.order),
    [state.categories],
  )

  const register: ForumContextValue['register'] = async (input) => {
    const res = await api('/api/auth/register', { method: 'POST', body: JSON.stringify(input) })
    if (!res.ok) return { ok: false, error: res.error }
    await refresh()
    setLoginOpen(false)
    return { ok: true }
  }

  const login: ForumContextValue['login'] = async (usernameOrEmail, password, stayLoggedIn = true) => {
    const res = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ usernameOrEmail, password, stayLoggedIn }),
    })
    if (!res.ok) return { ok: false, error: res.error }
    await refresh()
    setLoginOpen(false)
    return { ok: true }
  }

  const logout = () => {
    void api('/api/auth/logout', { method: 'POST' }).then(() => refresh())
  }

  const updateProfile: ForumContextValue['updateProfile'] = (patch) => {
    if (!currentUser) return
    void api('/api/me', { method: 'PATCH', body: JSON.stringify(patch) }).then(() => refresh())
  }

  const createThread: ForumContextValue['createThread'] = async (input) => {
    if (!currentUser) return { error: 'Please log in to create a thread.' }
    if (!input.title.trim()) return { error: 'Title is required.' }
    if (isBodyEmpty(input.body)) return { error: 'Write something or insert an image.' }
    const body = await persistBodyImages(`thread_${Date.now()}`, input.body)
    const res = await api<{ thread?: Thread; state?: ForumState }>('/api/threads', {
      method: 'POST',
      body: JSON.stringify({ forumId: input.forumId, title: input.title.trim(), body }),
    })
    if (!res.ok) return { error: res.error }
    if (res.state) setState(res.state)
    else await refresh()
    return res.thread ?? { error: 'Thread created.' }
  }

  const updateThread: ForumContextValue['updateThread'] = (id, patch) => {
    const next = { ...patch }
    if (patch.body) {
      next.content = textFromBody(patch.body)
      next.mediaUrl = firstImageUrl(patch.body)
      next.mediaType = next.mediaUrl ? 'image' : null
    }
    void api(`/api/threads/${id}`, { method: 'PATCH', body: JSON.stringify(next) }).then(() => refresh())
  }

  const deleteThread: ForumContextValue['deleteThread'] = (id) => {
    void api(`/api/threads/${id}`, { method: 'DELETE' }).then(() => refresh())
  }

  const togglePin = (id: string) => {
    if (!isMod) return
    void api(`/api/threads/${id}/pin`, { method: 'POST' }).then(() => refresh())
  }

  const bumpViews = (id: string) => {
    setState((s) => ({
      ...s,
      threads: s.threads.map((t) => (t.id === id ? { ...t, views: t.views + 1 } : t)),
    }))
    void api(`/api/threads/${id}/view`, { method: 'POST' })
  }

  const addComment: ForumContextValue['addComment'] = async (threadId, bodyInput, parentId = null) => {
    if (!currentUser) return { error: 'Please log in to comment.' }
    if (isBodyEmpty(bodyInput)) return { error: 'Write something or insert an image.' }
    const body = await persistBodyImages(`comment_${Date.now()}`, bodyInput)
    const res = await api<{ comment?: Comment; state?: ForumState }>('/api/comments', {
      method: 'POST',
      body: JSON.stringify({ threadId, parentId, body }),
    })
    if (!res.ok) return { error: res.error }
    if (res.state) setState(res.state)
    else await refresh()
    return res.comment ?? { error: 'Comment added.' }
  }

  const deleteComment: ForumContextValue['deleteComment'] = (id) => {
    void api(`/api/comments/${id}`, { method: 'DELETE' }).then(() => refresh())
  }

  const toggleLike: ForumContextValue['toggleLike'] = (targetType, targetId) => {
    if (!currentUser) return
    void api('/api/likes', {
      method: 'POST',
      body: JSON.stringify({ targetType, targetId }),
    }).then(() => refresh())
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
    void api('/api/follows', { method: 'POST', body: JSON.stringify({ userId }) }).then(() => refresh())
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
    void api('/api/reports', {
      method: 'POST',
      body: JSON.stringify({ targetType, targetId, reason }),
    }).then(() => refresh())
  }

  const resolveReport: ForumContextValue['resolveReport'] = (id) => {
    if (!isMod) return
    void api(`/api/mod/reports/${id}/resolve`, { method: 'POST' }).then(() => refresh())
  }

  const banUser: ForumContextValue['banUser'] = (userId, banned = true) => {
    if (!isMod) return
    void api(`/api/mod/users/${userId}/ban`, {
      method: 'POST',
      body: JSON.stringify({ banned }),
    }).then(() => refresh())
  }

  const setRole: ForumContextValue['setRole'] = (userId, role) => {
    if (!isAdmin) return
    void api(`/api/admin/users/${userId}/role`, {
      method: 'POST',
      body: JSON.stringify({ role }),
    }).then(() => refresh())
  }

  const markNotificationsRead = () => {
    if (!currentUser) return
    void api('/api/notifications/read', { method: 'POST' }).then(() => refresh())
  }

  const resetDemoData = () => {
    if (!isAdmin) return
    void api('/api/admin/reset', { method: 'POST' }).then(() => refresh())
  }

  const saveCategory: ForumContextValue['saveCategory'] = async (input) => {
    if (!isAdmin) return { ok: false, error: 'Admin access required.' }
    const res = await api('/api/admin/categories', { method: 'POST', body: JSON.stringify(input) })
    if (!res.ok) return { ok: false, error: res.error }
    await refresh()
    return { ok: true }
  }

  const deleteCategory: ForumContextValue['deleteCategory'] = async (id) => {
    if (!isAdmin) return { ok: false, error: 'Admin access required.' }
    const res = await api(`/api/admin/categories/${id}`, { method: 'DELETE' })
    if (!res.ok) return { ok: false, error: res.error }
    await refresh()
    return { ok: true }
  }

  const toggleFeatured = (id: string) => {
    if (!isAdmin) return
    void api(`/api/admin/categories/${id}/featured`, { method: 'POST' }).then(() => refresh())
  }

  const saveAd: ForumContextValue['saveAd'] = (ad) => {
    if (!isAdmin) return
    void api('/api/admin/ads', { method: 'POST', body: JSON.stringify(ad) }).then(() => refresh())
  }

  const deleteAd = (id: string) => {
    if (!isAdmin) return
    void api(`/api/admin/ads/${id}`, { method: 'DELETE' }).then(() => refresh())
  }

  const adsForSlot = (slot: AdSlot) =>
    [...state.ads].filter((a) => a.slot === slot).sort((a, b) => a.order - b.order)

  const setAdRotateSec = (sec: number) => {
    if (!isAdmin) return
    void api('/api/admin/settings/ads-rotate', {
      method: 'POST',
      body: JSON.stringify({ sec }),
    }).then(() => refresh())
  }

  const saveTrendingGame: ForumContextValue['saveTrendingGame'] = (item) => {
    if (!isAdmin) return
    void api('/api/admin/games', { method: 'POST', body: JSON.stringify(item) }).then(() => refresh())
  }

  const deleteTrendingGame = (id: string) => {
    if (!isAdmin) return
    void api(`/api/admin/games/${id}`, { method: 'DELETE' }).then(() => refresh())
  }

  const saveProvider: ForumContextValue['saveProvider'] = (item) => {
    if (!isAdmin) return
    void api('/api/admin/providers', { method: 'POST', body: JSON.stringify(item) }).then(() => refresh())
  }

  const deleteProvider = (id: string) => {
    if (!isAdmin) return
    void api(`/api/admin/providers/${id}`, { method: 'DELETE' }).then(() => refresh())
  }

  const value: ForumContextValue = {
    state,
    ready,
    bootError,
    retry,
    currentUser,
    isMod,
    isAdmin,
    register,
    login,
    logout,
    loginOpen,
    openLogin,
    closeLogin,
    updateProfile,
    createThread,
    updateThread,
    deleteThread,
    togglePin,
    bumpViews,
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
    resetDemoData,
    getUser,
    getUserByUsername,
    getCategoryBySlug,
    childCategories,
    leafCategories,
    topCategories,
    saveCategory,
    deleteCategory,
    toggleFeatured,
    saveAd,
    deleteAd,
    adsForSlot,
    setAdRotateSec,
    saveTrendingGame,
    deleteTrendingGame,
    saveProvider,
    deleteProvider,
    unreadCount,
  }

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm prose-muted">
        Loading forum…
      </div>
    )
  }

  if (bootError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="forum-card p-6 max-w-md text-center space-y-3">
          <p className="font-semibold">Forum API is offline</p>
          <p className="text-sm prose-muted">{bootError}</p>
          <p className="text-xs prose-muted">
            Start local MySQL, then <code>npm run db:migrate</code> and <code>npm run dev</code>
          </p>
          <button type="button" className="btn btn-primary" onClick={retry}>
            Retry
          </button>
        </div>
      </div>
    )
  }

  return <ForumContext.Provider value={value}>{children}</ForumContext.Provider>
}

export function useForum() {
  const ctx = useContext(ForumContext)
  if (!ctx) throw new Error('useForum must be used within ForumProvider')
  return ctx
}
