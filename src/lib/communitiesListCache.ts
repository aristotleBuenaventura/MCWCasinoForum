import { readSessionCache, writeSessionCache } from './sessionCache'
import type { Thread } from '../types'

const PREFIX = 'mcw-communities-list-v1:'

function key(lang: string) {
  return `${PREFIX}${lang}`
}

export function readCommunitiesListCache(lang: string): Thread[] | null {
  const parsed = readSessionCache<{ threads?: Thread[] }>(key(lang))
  if (!parsed || !Array.isArray(parsed.threads)) return null
  return parsed.threads
}

export function writeCommunitiesListCache(lang: string, threads: Thread[]) {
  writeSessionCache(key(lang), { threads })
}
