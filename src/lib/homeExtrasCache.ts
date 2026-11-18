import { readSessionCache, writeSessionCache } from './sessionCache'
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
  const parsed = readSessionCache<HomeExtras & { at?: number }>(key(lang))
  if (!parsed || !Array.isArray(parsed.reviews)) return null
  return {
    reviews: parsed.reviews ?? [],
    guides: parsed.guides ?? [],
    wins: parsed.wins ?? [],
    weekly: parsed.weekly ?? [],
  }
}

export function writeHomeExtrasCache(lang: string, extras: HomeExtras) {
  writeSessionCache(key(lang), { ...extras })
}
