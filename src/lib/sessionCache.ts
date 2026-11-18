/** Shared sessionStorage helpers for short-TTL page caches. */
export const SESSION_CACHE_TTL_MS = 10 * 60 * 1000

export function isCacheFresh(at: number | undefined, ttlMs = SESSION_CACHE_TTL_MS): boolean {
  if (!at) return false
  return Date.now() - at <= ttlMs
}

export function readSessionCache<T>(key: string, ttlMs = SESSION_CACHE_TTL_MS): T | null {
  try {
    const raw = sessionStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as T & { at?: number }
    if (!parsed || !isCacheFresh(parsed.at, ttlMs)) return null
    return parsed
  } catch {
    return null
  }
}

export function writeSessionCache(key: string, data: Record<string, unknown>) {
  try {
    sessionStorage.setItem(key, JSON.stringify({ ...data, at: Date.now() }))
  } catch {
    /* ignore quota */
  }
}
