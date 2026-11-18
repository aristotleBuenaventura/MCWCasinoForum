import { api } from './api'
import { readThreadCache, writeThreadCache, type ThreadBundle } from './threadCache'
import type { Thread } from '../types'

export type { ThreadBundle }

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

  const cached = readThreadCache(id, page, lang)
  if (cached) {
    const hit = Promise.resolve(cached)
    inflight.set(k, hit)
    return hit
  }

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
    const bundle = {
      thread,
      translations,
      comments,
      commentTotal: res.commentTotal ?? comments.length,
    } satisfies ThreadBundle
    writeThreadCache(id, page, lang, bundle)
    return bundle
  })

  inflight.set(k, p)
  return p
}

export function takePrefetchedThread(id: string, page = 1, lang?: string) {
  const resolvedLang =
    lang ?? (typeof window !== 'undefined' && window.location.pathname.startsWith('/bn') ? 'bn' : 'en')
  const k = key(id, page, resolvedLang)
  return inflight.get(k) ?? null
}
