import { api } from './api'
import type { Thread } from '../types'

const inflight = new Map<string, Promise<Thread[] | null>>()

function key(slug: string, sort: string, lang: string) {
  return `${lang}:${slug}:${sort}`
}

/** Warm the CommunityDetail JS chunk so navigation doesn't wait on download. */
export function prefetchCommunityChunk() {
  void import('../pages/CommunityDetail')
}

/** Warm forum thread list on hover / intent. */
export function prefetchCommunity(
  slug: string,
  opts?: { sort?: string; limit?: number; lang?: string },
) {
  const sort = opts?.sort ?? 'latest'
  const limit = opts?.limit ?? 20
  const lang =
    opts?.lang ??
    (typeof window !== 'undefined' && window.location.pathname.startsWith('/bn') ? 'bn' : 'en')
  prefetchCommunityChunk()
  const k = key(slug, sort, lang)
  if (inflight.has(k)) return inflight.get(k)!

  const sortKey = sort === 'pinned' ? 'latest' : sort
  const p = api<{ threads: Thread[] }>(
    `/api/threads?forum=${encodeURIComponent(slug)}&sort=${encodeURIComponent(sortKey)}&limit=${limit}`,
  ).then((res) => {
    if (!res.ok) {
      inflight.delete(k)
      return null
    }
    const list = sort === 'pinned' ? res.threads.filter((t) => t.pinned) : res.threads
    return list
  })

  inflight.set(k, p)
  return p
}

export function takePrefetchedCommunity(slug: string, sort = 'latest', lang?: string) {
  const resolvedLang =
    lang ?? (typeof window !== 'undefined' && window.location.pathname.startsWith('/bn') ? 'bn' : 'en')
  return inflight.get(key(slug, sort, resolvedLang)) ?? null
}
