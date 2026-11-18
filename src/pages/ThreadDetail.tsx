import { Bookmark, Calendar, Flag, Heart, MessageSquare, Pin, Share2, ThumbsUp, Trash2 } from 'lucide-react'
import {
  lazy,
  startTransition,
  Suspense,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { DocumentTitle } from '../components/DocumentTitle'
import { Avatar } from '../components/Avatar'
import { Username } from '../components/Username'
import { RankBadges } from '../components/RankBadges'
import { LoginLink } from '../components/LoginModal'
import { PostBodyView } from '../components/PostBodyView'
import { useToast } from '../components/Toast'
import { useForum } from '../context/ForumContext'
import { localizeCategoryName } from '../i18n/messages'
import { useLocale } from '../i18n/locale'
import { setActiveThreadTranslations } from '../i18n/threadTranslations'
import { emptyBody, ensureCommentBody, ensureThreadBody } from '../lib/postBody'
import { readThreadCache } from '../lib/threadCache'
import { prefetchThread, takePrefetchedThread } from '../lib/threadPrefetch'
import { compactNumber, forumTime } from '../lib/utils'
import type { Comment, PostBody, Thread, User } from '../types'

const PER_PAGE = 20

const PostComposer = lazy(() =>
  import('../components/PostComposer').then((m) => ({ default: m.PostComposer })),
)
const AdRotator = lazy(() =>
  import('../components/AdRotator').then((m) => ({ default: m.AdRotator })),
)

type ThreadComment = Comment & { author?: User | null; likeCount?: number; liked?: boolean }

function MemberCard({ user }: { user?: User }) {
  const { state } = useForum()
  const { lang } = useLocale()
  const threads = state.threads.filter((t) => t.authorId === user?.id).length
  const comments = state.comments.filter((c) => c.authorId === user?.id).length
  const likes =
    state.likes.filter((l) => {
      if (l.targetType === 'thread') return state.threads.some((t) => t.id === l.targetId && t.authorId === user?.id)
      return state.comments.some((c) => c.id === l.targetId && c.authorId === user?.id)
    }).length

  return (
    <aside className="xf-member">
      <Link to={`/profile/${user?.username}`} className="inline-block">
        <Avatar user={user} size={72} />
      </Link>
      <div className="mt-2 text-[13px]">
        <Username user={user} />
      </div>
      <div className="mt-1">
        <RankBadges user={user} showStaffTag />
      </div>
      <dl className="mt-3 text-[11px] prose-muted space-y-1 text-left">
        <div className="flex items-center gap-1.5"><Calendar size={11} /> {user ? forumTime(user.createdAt, lang) : '—'}</div>
        <div className="flex items-center gap-1.5"><MessageSquare size={11} /> {compactNumber(threads + comments)}</div>
        <div className="flex items-center gap-1.5"><Heart size={11} /> {compactNumber(likes)}</div>
      </dl>
    </aside>
  )
}

function PostSkeleton() {
  return (
    <article className="xf-post animate-pulse" aria-hidden="true">
      <aside className="xf-member">
        <div className="mx-auto h-[72px] w-[72px] rounded-full bg-[var(--color-panel-2)]" />
        <div className="mt-3 mx-auto h-3 w-20 rounded bg-[var(--color-panel-2)]" />
        <div className="mt-2 mx-auto h-3 w-16 rounded bg-[var(--color-panel-2)]" />
      </aside>
      <div className="xf-body space-y-3">
        <div className="h-3 w-28 rounded bg-[var(--color-panel-2)]" />
        <div className="h-3 w-full rounded bg-[var(--color-panel-2)]" />
        <div className="h-3 w-[92%] rounded bg-[var(--color-panel-2)]" />
        <div className="h-3 w-[70%] rounded bg-[var(--color-panel-2)]" />
      </div>
    </article>
  )
}

function ThreadShellSkeleton({ title }: { title?: string }) {
  const { t } = useLocale()
  return (
    <div className="max-w-[1100px] mx-auto space-y-3">
      <div className="h-3 w-40 rounded bg-[var(--color-panel-2)] animate-pulse" />
      <h1 className="page-title gold-text leading-snug max-w-3xl">
        {title || t('thread.loading')}
      </h1>
      <PostSkeleton />
      <PostSkeleton />
    </div>
  )
}

export function ThreadDetail() {
  const { id } = useParams()
  const [params, setParams] = useSearchParams()
  const page = Math.max(1, Number(params.get('page') || 1))
  const navigate = useNavigate()
  const toast = useToast()
  const { t, lang } = useLocale()
  const {
    state,
    getUser,
    currentUser,
    isMod,
    addComment,
    deleteThread,
    deleteComment,
    toggleLike,
    report,
    banUser,
    bumpViews,
    togglePin,
    toggleBookmark,
    cacheUsers,
    cacheThreads,
  } = useForum()

  const cachedThread = useMemo(
    () => (id ? state.threads.find((item) => item.id === id) || null : null),
    [id, state.threads],
  )

  const [thread, setThread] = useState<Thread | null>(cachedThread)
  const [comments, setComments] = useState<ThreadComment[]>([])
  const [commentsReady, setCommentsReady] = useState(false)
  const [commentTotal, setCommentTotal] = useState(0)
  const [notFound, setNotFound] = useState(false)
  const [replyBody, setReplyBody] = useState<PostBody>(emptyBody)
  const [uploading, setUploading] = useState(false)
  const [saved, setSaved] = useState(!!cachedThread?.bookmarked)
  const [quoteParent, setQuoteParent] = useState<string | null>(null)
  const [composerReady, setComposerReady] = useState(false)
  const [adReady, setAdReady] = useState(false)

  const authorCached = thread ? getUser(thread.authorId) : undefined
  const author = authorCached ? { ...thread?.author, ...authorCached } : thread?.author
  const forum = thread ? state.categories.find((c) => c.id === thread.forumId) : undefined

  // Keep local thread in sync if cache arrives from feed navigation
  useEffect(() => {
    if (cachedThread && (!thread || thread.id !== cachedThread.id)) {
      setThread(cachedThread)
      setSaved(!!cachedThread.bookmarked)
      setNotFound(false)
    }
  }, [cachedThread, thread])

  // Progressive load: session cache → no network; else prefetch/API once.
  useEffect(() => {
    if (!id) return
    let cancelled = false
    setNotFound(false)

    const apply = (bundle: {
      thread: Thread
      translations?: Record<string, string>
      comments: ThreadComment[]
      commentTotal: number
    }) => {
      if (cancelled) return
      const next = bundle.translations ? { ...bundle.thread, translations: bundle.translations } : bundle.thread
      // Urgent: OP / title
      setThread(next)
      setActiveThreadTranslations(bundle.translations || null)
      setSaved(!!next.bookmarked)
      cacheThreads([next])
      if (next.author) cacheUsers([next.author])
      // Non-urgent: comments list (keeps UI responsive).
      // Don't re-check `cancelled` inside startTransition — StrictMode cleanup
      // can flip it true after schedule and leave commentsReady stuck false.
      startTransition(() => {
        setComments(bundle.comments)
        setCommentTotal(bundle.commentTotal)
        cacheUsers(bundle.comments.map((c) => c.author).filter((u): u is User => Boolean(u)))
        setCommentsReady(true)
      })
      if (next.id && next.id !== id) {
        const qs = params.toString()
        navigate(`/thread/${next.id}${qs ? `?${qs}` : ''}`, { replace: true })
      }
    }

    const sessionCached = readThreadCache(id, page, lang)
    if (sessionCached) {
      apply(sessionCached)
      return () => {
        cancelled = true
        setActiveThreadTranslations(null)
      }
    }

    setCommentsReady(false)

    const pending = takePrefetchedThread(id, page, lang) || prefetchThread(id, { page, limit: PER_PAGE, lang })
    void pending.then((bundle) => {
      if (cancelled) return
      if (!bundle) {
        if (!cachedThread) setNotFound(true)
        setComments([])
        setCommentTotal(0)
        setCommentsReady(true)
        setActiveThreadTranslations(null)
        return
      }
      apply(bundle)
    })

    return () => {
      cancelled = true
      setActiveThreadTranslations(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, page, lang, cacheThreads, cacheUsers, navigate])

  // Defer view bump so it never contends with first paint
  useEffect(() => {
    if (!id) return
    const key = `mcw_viewed_${id}`
    if (sessionStorage.getItem(key)) return
    const run = () => {
      sessionStorage.setItem(key, '1')
      bumpViews(id)
    }
    const ric = window.requestIdleCallback?.bind(window)
    if (ric) {
      const idle = ric(run, { timeout: 2500 })
      return () => window.cancelIdleCallback?.(idle)
    }
    const t = window.setTimeout(run, 800)
    return () => window.clearTimeout(t)
  }, [id, bumpViews])

  // Lazy-mount heavy UI (composer + ad) after first paint / idle
  useEffect(() => {
    setComposerReady(false)
    setAdReady(false)
    const ric = window.requestIdleCallback?.bind(window)
    if (ric) {
      const idle = ric(
        () => {
          setComposerReady(true)
          setAdReady(true)
        },
        { timeout: 1200 },
      )
      return () => window.cancelIdleCallback?.(idle)
    }
    const t = window.setTimeout(() => {
      setComposerReady(true)
      setAdReady(true)
    }, 200)
    return () => window.clearTimeout(t)
  }, [id])

  const posts = useMemo(() => {
    const mapped = comments.map((c) => ({
      kind: 'reply' as const,
      createdAt: c.createdAt,
      authorId: c.authorId,
      body: ensureCommentBody(c).body,
      id: c.id,
      likeCount: c.likeCount || 0,
      liked: !!c.liked,
      author: c.author,
    }))
    if (page > 1 || !thread) return mapped
    return [
      {
        kind: 'op' as const,
        createdAt: thread.createdAt,
        authorId: thread.authorId,
        body: ensureThreadBody(thread).body,
        id: thread.id,
        likeCount: thread.likeCount || 0,
        liked: !!thread.liked,
        author: thread.author,
      },
      ...mapped,
    ]
  }, [comments, thread, page])

  const pageCount = Math.max(1, Math.ceil((commentTotal + 1) / PER_PAGE))
  const pageItems = posts

  if (notFound && !thread) {
    return (
      <div className="forum-card p-6 text-center max-w-[1100px] mx-auto">
        <p>{t('thread.notFound')}</p>
        <Link to="/communities" className="btn btn-primary mt-3 inline-flex">{t('community.back')}</Link>
      </div>
    )
  }

  if (!thread) {
    return <ThreadShellSkeleton />
  }

  const skeletonCount = Math.min(3, Math.max(1, thread.replyCount || 2))

  const canDelete = currentUser && (currentUser.id === thread.authorId || isMod)
  const goPage = (n: number) => setParams(n <= 1 ? {} : { page: String(n) })

  const onComment = async (e: FormEvent) => {
    e.preventDefault()
    if (uploading) return
    const res = await addComment(thread.id, replyBody, quoteParent)
    if ('error' in res) {
      toast(res.error)
      return
    }
    const posted: ThreadComment = {
      ...res,
      author: res.author || currentUser,
      likeCount: 0,
      liked: false,
    }
    const nextTotal = commentTotal + 1
    const lastPage = Math.max(1, Math.ceil(nextTotal / PER_PAGE))
    setReplyBody(emptyBody())
    setQuoteParent(null)
    setCommentTotal(nextTotal)
    if (page !== lastPage) {
      goPage(lastPage)
    } else {
      setComments((list) => (list.some((c) => c.id === posted.id) ? list : [...list, posted]))
      setCommentsReady(true)
    }
    toast(t('common.replyPosted'))
  }

  const share = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      toast(t('common.linkCopied'))
    } catch {
      toast(window.location.href)
    }
  }

  return (
    <div className="max-w-[1100px] mx-auto space-y-3">
      <DocumentTitle title={`${thread.title} — MCW Forum`} description={thread.content.slice(0, 160)} />
      <div className="text-[12px] prose-muted">
        <Link to="/communities" className="gold-text hover:underline">{t('communities.forumList')}</Link>
        {forum && (
          <>
            {' / '}
            <Link to={`/communities/${forum.slug}`} className="gold-text hover:underline">
              {localizeCategoryName(forum.slug, forum.name, lang)}
            </Link>
          </>
        )}
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="page-title gold-text leading-snug max-w-3xl">
          {thread.pinned && <Pin size={16} className="inline mr-1 -mt-0.5" />}
          {thread.title}
        </h1>
        {currentUser ? (
          <Link to={`/create?forum=${thread.forumId}`} className="btn btn-primary">{t('community.postThread')}</Link>
        ) : (
          <LoginLink className="btn btn-secondary">{t('thread.loginToPost')}</LoginLink>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3 text-[12px] prose-muted">
        <Username user={author} />
        <span>{forumTime(thread.createdAt, lang)}</span>
        {thread.tags.map((tag) => <span key={tag} className="tag">{tag}</span>)}
        {currentUser && (
          <button
            type="button"
            className={`inline-flex items-center gap-1 ${saved ? 'text-[var(--color-gold)]' : ''}`}
            onClick={() => void toggleBookmark(thread.id).then(setSaved)}
          >
            <Bookmark size={12} /> {saved ? t('thread.saved') : t('thread.save')}
          </button>
        )}
      </div>

      {pageCount > 1 && (
        <nav className="pager">
          {Array.from({ length: pageCount }, (_, i) => i + 1).map((n) => (
            <button key={n} type="button" className={n === page ? 'is-active' : ''} onClick={() => goPage(n)}>{n}</button>
          ))}
          {page < pageCount && (
            <button type="button" onClick={() => goPage(page + 1)}>{t('thread.next')}</button>
          )}
        </nav>
      )}

      {pageItems.map((post, index) => {
        const number = (page - 1) * PER_PAGE + index + 1
        const cached = getUser(post.authorId)
        const user = cached ? { ...post.author, ...cached } : post.author
        const isOp = post.kind === 'op'
        const likedPost = post.liked
        const likeN = post.likeCount
        return (
          <article key={post.id} className="xf-post">
            <MemberCard user={user ?? undefined} />
            <div className="xf-body">
              <div className="flex items-center justify-between gap-2 text-[12px] prose-muted border-b border-[var(--xf-line-soft)] pb-2 mb-3">
                <span>{forumTime(post.createdAt, lang)}</span>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={share} className="hover:text-[var(--color-gold)] inline-flex items-center gap-1">
                    <Share2 size={12} /> {t('common.share')}
                  </button>
                  <span>#{number}</span>
                </div>
              </div>
              <PostBodyView body={post.body} />
              {isOp && number === 1 && adReady && (
                <Suspense fallback={null}>
                  <AdRotator
                    slot="thread"
                    variant="inline"
                    className="mt-4 border border-[var(--xf-line-soft)]"
                    heightClass="h-28 max-h-28"
                  />
                </Suspense>
              )}
              <div className="mt-4 flex flex-wrap items-center gap-3 text-[12px] prose-muted">
                <button
                  type="button"
                  className={`inline-flex items-center gap-1 ${likedPost ? 'text-[var(--color-gold)]' : ''}`}
                  onClick={() => {
                    if (!currentUser) return toast(t('thread.loginToLike'))
                    toggleLike(isOp ? 'thread' : 'comment', post.id)
                  }}
                >
                  <ThumbsUp size={13} /> {likeN}
                </button>
                {currentUser && !isOp && (
                  <button
                    type="button"
                    onClick={() => {
                      setQuoteParent(post.id)
                      toast(t('thread.replying'))
                    }}
                  >
                    {t('thread.quote')}
                  </button>
                )}
                {currentUser && (
                  <button
                    type="button"
                    onClick={() => {
                      const reason = window.prompt('Why are you reporting this?')
                      if (!reason) return
                      report(isOp ? 'thread' : 'comment', post.id, reason)
                      toast(t('common.reported'))
                    }}
                  >
                    <Flag size={13} className="inline mr-1" /> {t('common.report')}
                  </button>
                )}
                {isOp && isMod && (
                  <button type="button" onClick={() => togglePin(thread.id)}>
                    <Pin size={13} className="inline mr-1" /> {thread.pinned ? t('thread.unpin') : t('thread.pin')}
                  </button>
                )}
                {isOp && canDelete && (
                  <button
                    type="button"
                    className="text-[var(--color-danger)]"
                    onClick={() => {
                      if (!window.confirm(t('thread.confirmDelete'))) return
                      deleteThread(thread.id)
                      toast(t('thread.deleted'))
                      navigate(forum ? `/communities/${forum.slug}` : '/communities')
                    }}
                  >
                    <Trash2 size={13} className="inline mr-1" /> {t('thread.delete')}
                  </button>
                )}
                {!isOp && currentUser && (currentUser.id === post.authorId || isMod) && (
                  <button
                    type="button"
                    className="text-[var(--color-danger)]"
                    onClick={() => {
                      if (!window.confirm(t('thread.confirmDeleteReply'))) return
                      deleteComment(post.id)
                      setComments((list) => list.filter((c) => c.id !== post.id))
                      setCommentTotal((n) => Math.max(0, n - 1))
                      toast(t('thread.replyDeleted'))
                    }}
                  >
                    <Trash2 size={13} className="inline mr-1" /> {t('thread.delete')}
                  </button>
                )}
                {isOp && isMod && author && author.role === 'user' && (
                  <button
                    type="button"
                    className="text-[var(--color-danger)]"
                    onClick={() => {
                      if (!window.confirm(`Remove user @${author.username}?`)) return
                      banUser(author.id, true)
                      toast(t('thread.userRemoved'))
                    }}
                  >
                    {t('thread.removeUser')}
                  </button>
                )}
              </div>
            </div>
          </article>
        )
      })}

      {!commentsReady &&
        Array.from({ length: skeletonCount }).map((_, i) => (
          <PostSkeleton key={`sk-${i}`} />
        ))}

      <section className="xf-form">
        <div className="xf-form-head">{t('thread.replyTo')}</div>
        {currentUser ? (
          <form onSubmit={onComment}>
            {quoteParent && (
              <p className="text-[12px] px-3 pt-2 prose-muted">
                {t('thread.replyingToComment')}{' '}
                <button type="button" className="gold-text" onClick={() => setQuoteParent(null)}>
                  {t('thread.cancel')}
                </button>
              </p>
            )}
            {composerReady ? (
              <Suspense
                fallback={<div className="p-4 text-sm prose-muted">{t('common.loading')}</div>}
              >
                <PostComposer
                  value={replyBody}
                  onChange={setReplyBody}
                  onBusyChange={setUploading}
                  placeholder={quoteParent ? t('thread.writeQuotedReply') : t('thread.writeReply')}
                />
              </Suspense>
            ) : (
              <div className="p-4 text-sm prose-muted">{t('common.loading')}</div>
            )}
            <div className="xf-form-actions">
              <button type="submit" className="btn-post" disabled={uploading || !composerReady}>
                {uploading ? t('thread.uploading') : t('thread.postReply')}
              </button>
            </div>
          </form>
        ) : (
          <p className="text-[12px] prose-muted px-3 py-3">
            <LoginLink className="gold-text hover:underline bg-transparent border-0 p-0 cursor-pointer">{t('nav.login')}</LoginLink>{' '}
            {t('thread.loginToReply')}
          </p>
        )}
      </section>
    </div>
  )
}
