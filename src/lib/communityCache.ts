import { readSessionCache, writeSessionCache } from './sessionCache'
import type { Thread } from '../types'

const PREFIX = 'mcw-community-v1:'

function key(slug: string, sort: string, lang: string) {
  return `${PREFIX}${lang}:${slug}:${sort}`
}

export function readCommunityCache(slug: string, sort: string, lang: string): Thread[] | null {
  const parsed = readSessionCache<{ threads?: Thread[] }>(key(slug, sort, lang))
  if (!parsed || !Array.isArray(parsed.threads)) return null
  return parsed.threads
}

export function writeCommunityCache(slug: string, sort: string, lang: string, threads: Thread[]) {
  writeSessionCache(key(slug, sort, lang), { threads })
}
