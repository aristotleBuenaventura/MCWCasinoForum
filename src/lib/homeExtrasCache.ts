import type { Thread, User } from '../types'

export type HomeExtras = {
  reviews: Thread[]
  guides: Thread[]
  wins: Thread[]
  weekly: { user: User | null; replies: number }[]
}

const PREFIX = 'mcw-home-extras-v1:'

function key(lang: string) {
  return `${PREFIX}${lang}`
}

export function readHomeExtrasCache(lang: string): HomeExtras | null {
  try {
    const raw = sessionStorage.getItem(key(lang))
    if (!raw) return null
    const parsed = JSON.parse(raw) as HomeExtras & { at?: number }
    if (!parsed || !Array.isArray(parsed.reviews)) return null
    if (parsed.at && Date.now() - parsed.at > 10 * 60 * 1000) return null
    return {
      reviews: parsed.reviews ?? [],
      guides: parsed.guides ?? [],
      wins: parsed.wins ?? [],
      weekly: parsed.weekly ?? [],
    }
  } catch {
    return null
  }
}

export function writeHomeExtrasCache(lang: string, extras: HomeExtras) {
  try {
    sessionStorage.setItem(key(lang), JSON.stringify({ ...extras, at: Date.now() }))
  } catch {
    /* ignore quota */
  }
}
