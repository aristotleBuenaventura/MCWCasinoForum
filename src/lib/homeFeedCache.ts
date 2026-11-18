import { readSessionCache, writeSessionCache } from './sessionCache'
import type { Thread } from '../types'

const PREFIX = 'mcw-home-feed-v2:'

function key(tab: string, lang: string) {
  return `${PREFIX}${lang}:${tab}`
}

export function readHomeFeedCache(tab: string, lang: string): Thread[] | null {
  const parsed = readSessionCache<{ threads?: Thread[] }>(key(tab, lang))
  if (!parsed || !Array.isArray(parsed.threads) || !parsed.threads.length) return null
  return parsed.threads
}

export function writeHomeFeedCache(tab: string, lang: string, threads: Thread[]) {
  writeSessionCache(key(tab, lang), { threads })
}
