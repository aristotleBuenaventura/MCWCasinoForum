import { api } from './api'
import { writeHomeFeedCache } from './homeFeedCache'
import type { Thread } from '../types'

type FeedPayload = { feed?: { threads?: Thread[] } }

const pending = new Map<string, Promise<Thread[]>>()

function key(tab: string, lang: string) {
  return `${lang}:${tab}`
}

export function prefetchHomeFeed(tab: string, lang: string): Promise<Thread[]> {
  const k = key(tab, lang)
  const existing = pending.get(k)
  if (existing) return existing

  const p = api<FeedPayload>(`/api/home?tab=${encodeURIComponent(tab)}&sections=feed`)
    .then((res) => {
      const threads = res.ok ? (res.feed?.threads ?? []) : []
      if (threads.length) writeHomeFeedCache(tab, lang, threads)
      return threads
    })
    .finally(() => {
      // Keep briefly so Home can take it; then drop.
      window.setTimeout(() => pending.delete(k), 5000)
    })

  pending.set(k, p)
  return p
}

export function takePrefetchedHomeFeed(tab: string, lang: string): Promise<Thread[]> | null {
  const k = key(tab, lang)
  const p = pending.get(k)
  if (!p) return null
  pending.delete(k)
  return p
}
