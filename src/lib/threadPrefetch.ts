import { api } from './api'
import type { Comment, Thread, User } from '../types'

export type ThreadBundle = {
  thread: Thread
  translations?: Record<string, string>
  comments: (Comment & { author?: User | null; likeCount?: number; liked?: boolean })[]
  commentTotal: number
}

const inflight = new Map<string, Promise<ThreadBundle | null>>()

function key(id: string, page: number, lang: string) {
  return `${lang}:${id}:${page}`
}

/** Warm the ThreadDetail JS chunk so navigation doesn't wait on download. */
export function prefetchThreadChunk() {
  void import('../pages/ThreadDetail')
}

/** Warm the combined thread+comments endpoint on hover / intent. */
export function prefetchThread(id: string, opts?: { page?: number; limit?: number; lang?: string }) {
  const page = opts?.page ?? 1
  const limit = opts?.limit ?? 20
  const lang = opts?.lang ?? (typeof window !== 'undefined' && window.location.pathname.startsWith('/bn') ? 'bn' : 'en')
  prefetchThreadChunk()
  const k = key(id, page, lang)
  if (inflight.has(k)) return inflight.get(k)!

  const p = api<{
    thread: Thread
    translations?: Record<string, string>
    comments?: ThreadBundle['comments']
    commentTotal?: number
  }>(`/api/threads/${id}?include_comments=1&page=${page}&limit=${limit}`).then((res) => {
    if (!res.ok) {
      inflight.delete(k)
      return null
    }
    const translations = res.thread.translations || res.translations || undefined
    const thread = translations ? { ...res.thread, translations } : res.thread
    const comments = res.comments ?? []
    return {
      thread,
      translations,
      comments,
      commentTotal: res.commentTotal ?? comments.length,
    } satisfies ThreadBundle
  })

  inflight.set(k, p)
  return p
}

export function takePrefetchedThread(id: string, page = 1, lang?: string) {
  const resolvedLang =
    lang ?? (typeof window !== 'undefined' && window.location.pathname.startsWith('/bn') ? 'bn' : 'en')
  const k = key(id, page, resolvedLang)
  const p = inflight.get(k)
  if (!p) return null
  // Keep in cache briefly so StrictMode double-mount can reuse
  return p
}
