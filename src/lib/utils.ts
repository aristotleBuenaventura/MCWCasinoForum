import { formatDistanceToNow } from 'date-fns'

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

export function avatarColor(seed: string) {
  const colors = ['#1769a5', '#2f8f46', '#c0392b', '#8e44ad', '#d35400', '#16a085']
  let hash = 0
  for (let i = 0; i < seed.length; i++) hash = seed.charCodeAt(i) + ((hash << 5) - hash)
  return colors[Math.abs(hash) % colors.length]
}
