import { api } from './api'
import { writeHomeExtrasCache, type HomeExtras } from './homeExtrasCache'
import type { Thread, User } from '../types'

type ExtrasPayload = {
  reviews?: Thread[]
  guides?: Thread[]
  wins?: Thread[]
  weekly?: { user: User | null; replies: number }[]
}

const pending = new Map<string, Promise<HomeExtras>>()

function key(lang: string) {
  return lang
}

export function prefetchHomeExtras(lang: string): Promise<HomeExtras> {
  const k = key(lang)
  const existing = pending.get(k)
  if (existing) return existing

  const p = api<ExtrasPayload>(`/api/home?tab=latest&sections=extras`)
    .then((res) => {
      const extras: HomeExtras = {
        reviews: res.ok ? (res.reviews ?? []) : [],
        guides: res.ok ? (res.guides ?? []) : [],
        wins: res.ok ? (res.wins ?? []) : [],
        weekly: res.ok ? (res.weekly ?? []) : [],
      }
      if (extras.reviews.length || extras.guides.length || extras.wins.length || extras.weekly.length) {
        writeHomeExtrasCache(lang, extras)
      }
      return extras
    })
    .finally(() => {
      window.setTimeout(() => pending.delete(k), 8000)
    })

  pending.set(k, p)
  return p
}

export function takePrefetchedHomeExtras(lang: string): Promise<HomeExtras> | null {
  const k = key(lang)
  const p = pending.get(k)
  if (!p) return null
  pending.delete(k)
  return p
}
