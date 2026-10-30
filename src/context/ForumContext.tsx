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
import { ensureCommentBody, ensureThreadBody, firstImageUrl, isBodyEmpty, persistBodyImages, textFromBody } from '../lib/postBody'
import { uid } from '../lib/utils'
import type {
  Ad,
  AdSlot,
  CmsItem,
  Comment,
  ForumCategory,
  ForumState,
  GameProvider,
  Notification,
  PostBody,
  Role,
  Thread,
  User,
} from '../types'

const STORAGE_KEY = 'mcw-casino-forum-v4'

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
  currentUser: User | null
  isMod: boolean
  register: (input: RegisterInput) => { ok: true } | { ok: false; error: string }
  login: (usernameOrEmail: string, password: string) => { ok: true } | { ok: false; error: string }
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
  saveCategory: (input: CategoryInput) => { ok: true } | { ok: false; error: string }
  deleteCategory: (id: string) => { ok: true } | { ok: false; error: string }
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

const ForumContext = createContext<ForumContextValue | null>(null)

function loadState(): ForumState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as ForumState
      if (parsed?.categories && parsed?.ads && parsed?.trendingGames) {
        return {
          ...parsed,
          threads: parsed.threads.map(ensureThreadBody),
          comments: parsed.comments.map(ensureCommentBody),
        }
      }
    }
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

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function ageFromDob(iso: string) {
  const dob = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(dob.getTime())) return 0
  const now = new Date()
  let age = now.getFullYear() - dob.getFullYear()
  const monthDelta = now.getMonth() - dob.getMonth()
  if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < dob.getDate())) age -= 1
  return age
}

export function ForumProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ForumState>(() => loadState())
  const [loginOpen, setLoginOpen] = useState(false)
  const openLogin = useCallback(() => setLoginOpen(true), [])
  const closeLogin = useCallback(() => setLoginOpen(false), [])

  useEffect(() => {
    let cancelled = false
    const persist = async () => {
      const copy = JSON.parse(JSON.stringify(state)) as ForumState
      for (const thread of copy.threads) {
        thread.body = await persistBodyImages(thread.id, thread.body || [])
        thread.content = textFromBody(thread.body)
        thread.mediaUrl = firstImageUrl(thread.body)
        thread.mediaType = thread.mediaUrl ? 'image' : null
      }
      for (const comment of copy.comments) {
        comment.body = await persistBodyImages(comment.id, comment.body || [])
        comment.content = textFromBody(comment.body)
      }
      if (cancelled) return
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(copy))
      } catch {
        console.warn('Forum storage is full; latest media may not persist after refresh.')
      }
    }
    void persist()
    return () => {
      cancelled = true
    }
  }, [state])

  useEffect(() => {
    document.documentElement.classList.add('dark')
  }, [])

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

  const register: ForumContextValue['register'] = (input) => {
    const username = input.username.trim().toLowerCase()
    const email = input.email.trim().toLowerCase()
    if (!/^[a-z0-9_]{3,20}$/.test(username)) {
      return { ok: false, error: 'Username must be 3–20 chars (letters, numbers, underscore).' }
    }
    if (!email.includes('@')) return { ok: false, error: 'Enter a valid email.' }
    if (input.password.length < 6) return { ok: false, error: 'Password must be at least 6 characters.' }
    if (!input.turnstileToken) return { ok: false, error: 'Please complete the verification check.' }
    if (!input.dateOfBirth) return { ok: false, error: 'Date of birth is required.' }
    if (ageFromDob(input.dateOfBirth) < 18) return { ok: false, error: 'You must be 18 or older to register.' }
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
      displayName: input.displayName?.trim() || username,
      bio: '',
      avatar: '',
      role: 'user',
      banned: false,
      createdAt: new Date().toISOString(),
      dateOfBirth: input.dateOfBirth,
    }

    setState((s) => ({ ...s, users: [...s.users, user], currentUserId: user.id }))
    setLoginOpen(false)
    return { ok: true }
  }

  const login: ForumContextValue['login'] = (usernameOrEmail, password) => {
    const key = usernameOrEmail.trim().toLowerCase()
    const user = state.users.find((u) => u.username === key || u.email === key)
    if (!user || user.password !== password) {
      return { ok: false, error: 'Invalid username/email or password.' }
    }
    if (user.banned) return { ok: false, error: 'This account has been removed by a moderator.' }
    setState((s) => ({ ...s, currentUserId: user.id }))
    setLoginOpen(false)
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

  const createThread: ForumContextValue['createThread'] = async (input) => {
    if (!currentUser) return { error: 'Please log in to create a thread.' }
    if (!input.title.trim()) return { error: 'Title is required.' }
    if (isBodyEmpty(input.body)) return { error: 'Write something or insert an image.' }

    const id = uid('thread')
    const body = await persistBodyImages(id, input.body)
    const content = textFromBody(body)
    const mediaUrl = firstImageUrl(body)

    const thread: Thread = {
      id,
      forumId: input.forumId,
      authorId: currentUser.id,
      title: input.title.trim(),
      content,
      body,
      mediaUrl,
      mediaType: mediaUrl ? 'image' : null,
      pinned: false,
      solved: false,
      tags: [],
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

  const togglePin = (id: string) => {
    if (!isMod) return
    setState((s) => ({
      ...s,
      threads: s.threads.map((t) => (t.id === id ? { ...t, pinned: !t.pinned } : t)),
    }))
  }

  const bumpViews = (id: string) => {
    setState((s) => ({
      ...s,
      threads: s.threads.map((t) => (t.id === id ? { ...t, views: t.views + 1 } : t)),
    }))
  }

  const addComment: ForumContextValue['addComment'] = async (threadId, bodyInput, parentId = null) => {
    if (!currentUser) return { error: 'Please log in to comment.' }
    if (isBodyEmpty(bodyInput)) return { error: 'Write something or insert an image.' }

    const id = uid('comment')
    const body = await persistBodyImages(id, bodyInput)
    const comment: Comment = {
      id,
      threadId,
      authorId: currentUser.id,
      parentId,
      content: textFromBody(body),
      body,
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
        likes: [...s.likes, { id: uid('like'), userId: currentUser.id, targetType, targetId }],
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
        follows: [...s.follows, { id: uid('follow'), followerId: currentUser.id, followingId: userId }],
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
      users: s.users.map((u) =>
        u.id === userId && (u.role === 'user' || currentUser?.role === 'admin')
          ? { ...u, banned }
          : u,
      ),
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

  const resetDemoData = () => setState(createSeedState())

  const saveCategory: ForumContextValue['saveCategory'] = (input) => {
    if (!isMod) return { ok: false, error: 'Moderator access required.' }
    const slug = slugify(input.slug || input.name)
    if (!slug) return { ok: false, error: 'Slug is required.' }
    if (state.categories.some((c) => c.slug === slug && c.id !== input.id)) {
      return { ok: false, error: 'That slug is already used.' }
    }
    setState((s) => {
      if (input.id) {
        return {
          ...s,
          categories: s.categories.map((c) =>
            c.id === input.id
              ? { ...c, slug, name: input.name, description: input.description, parentId: input.parentId, featured: input.featured, order: input.order }
              : c,
          ),
        }
      }
      const category: ForumCategory = {
        id: uid('cat'),
        slug,
        name: input.name.trim(),
        description: input.description.trim(),
        parentId: input.parentId,
        featured: input.featured,
        order: input.order,
        threadCount: 0,
        postCount: 0,
      }
      return { ...s, categories: [...s.categories, category] }
    })
    return { ok: true }
  }

  const deleteCategory: ForumContextValue['deleteCategory'] = (id) => {
    if (!isMod) return { ok: false, error: 'Moderator access required.' }
    if (state.categories.some((c) => c.parentId === id)) {
      return { ok: false, error: 'Remove nested communities first.' }
    }
    if (state.threads.some((t) => t.forumId === id)) {
      return { ok: false, error: 'This community still has threads.' }
    }
    setState((s) => ({ ...s, categories: s.categories.filter((c) => c.id !== id) }))
    return { ok: true }
  }

  const toggleFeatured = (id: string) => {
    if (!isMod) return
    setState((s) => ({
      ...s,
      categories: s.categories.map((c) => (c.id === id ? { ...c, featured: !c.featured } : c)),
    }))
  }

  const saveAd: ForumContextValue['saveAd'] = (ad) => {
    if (!isMod) return
    setState((s) => {
      if (ad.id) {
        return { ...s, ads: s.ads.map((a) => (a.id === ad.id ? { ...a, ...ad, id: ad.id } : a)) }
      }
      return { ...s, ads: [...s.ads, { ...ad, id: uid('ad') }] }
    })
  }

  const deleteAd = (id: string) => {
    if (!isMod) return
    setState((s) => ({ ...s, ads: s.ads.filter((a) => a.id !== id) }))
  }

  const adsForSlot = (slot: AdSlot) =>
    [...state.ads].filter((a) => a.slot === slot).sort((a, b) => a.order - b.order)

  const setAdRotateSec = (sec: number) => {
    if (!isMod) return
    setState((s) => ({ ...s, adRotateSec: Math.max(2, Math.min(60, Math.round(sec) || 5)) }))
  }

  const saveTrendingGame: ForumContextValue['saveTrendingGame'] = (item) => {
    if (!isMod) return
    setState((s) => {
      if (item.id) {
        return { ...s, trendingGames: s.trendingGames.map((g) => (g.id === item.id ? { ...g, ...item, id: item.id } : g)) }
      }
      return { ...s, trendingGames: [...s.trendingGames, { ...item, id: uid('tg') }] }
    })
  }

  const deleteTrendingGame = (id: string) => {
    if (!isMod) return
    setState((s) => ({ ...s, trendingGames: s.trendingGames.filter((g) => g.id !== id) }))
  }

  const saveProvider: ForumContextValue['saveProvider'] = (item) => {
    if (!isMod) return
    setState((s) => {
      if (item.id) {
        return { ...s, providers: s.providers.map((p) => (p.id === item.id ? { ...p, ...item, id: item.id } : p)) }
      }
      return { ...s, providers: [...s.providers, { ...item, id: uid('prov') }] }
    })
  }

  const deleteProvider = (id: string) => {
    if (!isMod) return
    setState((s) => ({ ...s, providers: s.providers.filter((p) => p.id !== id) }))
  }

  const value: ForumContextValue = {
    state,
    currentUser,
    isMod,
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

  return <ForumContext.Provider value={value}>{children}</ForumContext.Provider>
}

export function useForum() {
  const ctx = useContext(ForumContext)
  if (!ctx) throw new Error('useForum must be used within ForumProvider')
  return ctx
}
