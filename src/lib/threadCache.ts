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
