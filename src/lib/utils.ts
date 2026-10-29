import { format, formatDistanceToNow, isToday, isYesterday } from 'date-fns'

export function uid(prefix = 'id') {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`
}

export function timeAgo(date: string) {
  try {
    return formatDistanceToNow(new Date(date), { addSuffix: true })
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

export function forumTime(date: string) {
  const d = new Date(date)
  if (Number.isNaN(+d)) return date
  if (Date.now() - +d < 60 * 60 * 1000) return formatDistanceToNow(d, { addSuffix: true })
  if (isToday(d)) return `Today at ${format(d, 'h:mm a')}`
  if (isYesterday(d)) return `Yesterday at ${format(d, 'h:mm a')}`
  return format(d, 'MMM d, yyyy')
}

export function avatarColor(seed: string) {
  const colors = ['#1769a5', '#2f8f46', '#c0392b', '#8e44ad', '#d35400', '#16a085']
  let hash = 0
  for (let i = 0; i < seed.length; i++) hash = seed.charCodeAt(i) + ((hash << 5) - hash)
  return colors[Math.abs(hash) % colors.length]
}
