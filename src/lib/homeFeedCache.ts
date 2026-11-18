import type { Thread } from '../types'

const PREFIX = 'mcw-home-feed-v2:'

function key(tab: string, lang: string) {
  return `${PREFIX}${lang}:${tab}`
}

export function readHomeFeedCache(tab: string, lang: string): Thread[] | null {
  try {
    const raw = sessionStorage.getItem(key(tab, lang))
    if (!raw) return null
    const parsed = JSON.parse(raw) as { threads?: Thread[]; at?: number }
    if (!Array.isArray(parsed.threads) || !parsed.threads.length) return null
    // Drop after 10 minutes
    if (parsed.at && Date.now() - parsed.at > 10 * 60 * 1000) return null
    return parsed.threads
  } catch {
    return null
  }
}

export function writeHomeFeedCache(tab: string, lang: string, threads: Thread[]) {
  try {
    sessionStorage.setItem(key(tab, lang), JSON.stringify({ threads, at: Date.now() }))
  } catch {
    /* ignore quota */
  }
}
