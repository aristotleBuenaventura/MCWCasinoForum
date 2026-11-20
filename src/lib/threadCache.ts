import { readSessionCache, writeSessionCache } from './sessionCache'
import type { Comment, Thread, User } from '../types'

export type ThreadBundle = {
  thread: Thread
  translations?: Record<string, string>
  comments: (Comment & { author?: User | null; likeCount?: number; liked?: boolean })[]
  commentTotal: number
}

const PREFIX = 'mcw-thread-v1:'

function key(id: string, page: number, lang: string) {
  return `${PREFIX}${lang}:${id}:${page}`
}

export function readThreadCache(id: string, page: number, lang: string): ThreadBundle | null {
  const parsed = readSessionCache<{
    thread?: ThreadBundle['thread']
    translations?: ThreadBundle['translations']
    comments?: ThreadBundle['comments']
    commentTotal?: number
  }>(key(id, page, lang))
  if (!parsed?.thread || !Array.isArray(parsed.comments)) return null
  return {
    thread: parsed.thread,
    translations: parsed.translations,
    comments: parsed.comments,
    commentTotal: parsed.commentTotal ?? parsed.comments.length,
  }
}

export function writeThreadCache(id: string, page: number, lang: string, bundle: ThreadBundle) {
  writeSessionCache(key(id, page, lang), {
    thread: bundle.thread,
    translations: bundle.translations,
    comments: bundle.comments,
    commentTotal: bundle.commentTotal,
  })
}

/** Drop all cached pages for a thread (both langs). Call after posting a reply. */
export function clearThreadCaches(threadId: string, extraIds: string[] = []) {
  const ids = new Set([threadId, ...extraIds].filter(Boolean))
  try {
    const remove: string[] = []
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i)
      if (!k || !k.startsWith(PREFIX)) continue
      // key = mcw-thread-v1:{lang}:{id}:{page}
      const rest = k.slice(PREFIX.length)
      const parts = rest.split(':')
      if (parts.length >= 2 && ids.has(parts[1])) remove.push(k)
    }
    for (const k of remove) sessionStorage.removeItem(k)
  } catch {
    /* ignore */
  }
}
