import { format, formatDistanceToNow, isToday, isYesterday } from 'date-fns'
import { bn } from 'date-fns/locale'
import { fillMessage, messages, type Lang } from '../i18n/messages'

export function uid(prefix = 'id') {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`
}

export function timeAgo(date: string, lang: Lang = 'en') {
  try {
    return formatDistanceToNow(new Date(date), {
      addSuffix: true,
      locale: lang === 'bn' ? bn : undefined,
    })
  } catch {
    return date
  }
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

export async function fileToDataUrl(file: File, maxBytes = 4_500_000): Promise<string> {
  if (file.size > maxBytes) {
    throw new Error(`File too large. Max ${(maxBytes / 1_000_000).toFixed(1)}MB for local demo storage.`)
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}

export function compactNumber(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1).replace(/\.0$/, '')}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1).replace(/\.0$/, '')}K`
  return String(n)
}

export function forumTime(date: string, lang: Lang = 'en') {
  const d = new Date(date)
  if (Number.isNaN(+d)) return date
  const locale = lang === 'bn' ? bn : undefined
  if (Date.now() - +d < 60 * 60 * 1000) {
    return formatDistanceToNow(d, { addSuffix: true, locale })
  }
  const time = format(d, 'h:mm a', { locale })
  if (isToday(d)) return fillMessage(messages[lang]['time.todayAt'], { time })
  if (isYesterday(d)) return fillMessage(messages[lang]['time.yesterdayAt'], { time })
  return format(d, 'MMM d, yyyy', { locale })
}

export function avatarColor(seed: string) {
  const colors = ['#1769a5', '#2f8f46', '#c0392b', '#8e44ad', '#d35400', '#16a085']
  let hash = 0
  for (let i = 0; i < seed.length; i++) hash = seed.charCodeAt(i) + ((hash << 5) - hash)
  return colors[Math.abs(hash) % colors.length]
}

/** Defense-in-depth: only http(s) or same-origin relative paths for href/src. */
export function safeExternalHref(url: string | null | undefined): string | undefined {
  if (!url) return undefined
  const trimmed = url.trim()
  if (!trimmed) return undefined
  const lower = trimmed.toLowerCase()
  if (
    lower.startsWith('javascript:') ||
    lower.startsWith('data:') ||
    lower.startsWith('vbscript:') ||
    lower.startsWith('file:')
  ) {
    return undefined
  }
  if (trimmed.startsWith('//')) return undefined
  if (trimmed.startsWith('/')) return trimmed
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return undefined
}
