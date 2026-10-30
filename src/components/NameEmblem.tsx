import type { ReactNode } from 'react'
import type { NameEmblem } from '../lib/nameplate'

const ICONS: Record<Exclude<NameEmblem, 'none'>, ReactNode> = {
  crown: (
    <path d="M2 12.5h12L12.2 6.2 8 9.2 3.8 6.2 2 12.5Zm1.2 1.2h9.6V15H3.2v-1.3Z" />
  ),
  wings: (
    <path d="M8 3.2c.4 1.8.4 3.4 0 5.2C6.2 8 4.4 6.7 3 5.2 4.8 5.6 6.5 5 8 3.2Zm0 0c-.4 1.8-.4 3.4 0 5.2C9.8 8 11.6 6.7 13 5.2 11.2 5.6 9.5 5 8 3.2ZM3.2 9.2C5 10 6.6 11 8 12.6 9.4 11 11 10 12.8 9.2 10.8 11.4 9.2 13.4 8 15.2 6.8 13.4 5.2 11.4 3.2 9.2Z" />
  ),
  shield: (
    <path d="M8 1.8 13.4 4v4.2c0 3.1-2.2 5.4-5.4 6.4-3.2-1-5.4-3.3-5.4-6.4V4L8 1.8Zm0 2.1-3.6 1.5v2.8c0 2 1.4 3.6 3.6 4.4 2.2-.8 3.6-2.4 3.6-4.4V5.4L8 3.9Z" />
  ),
  star: (
    <path d="m8 1.8 1.5 3.4 3.7.4-2.7 2.5.8 3.6L8 9.8 4.7 11.7l.8-3.6-2.7-2.5 3.7-.4L8 1.8Z" />
  ),
  diamond: (
    <path d="M8 1.6 14.2 7.2 8 14.4 1.8 7.2 8 1.6Zm0 2.5L4 7.2l4 5 4-5-4-3.1Z" />
  ),
  flame: (
    <path d="M8 1.6c1.6 2 2.4 3.4 2.4 5.1 0 .7-.2 1.3-.5 1.8 1.2-.2 2.3-1.4 2.6-2.7.8 1.3 1.2 2.6 1.2 3.9 0 3-2.4 5.1-5.7 5.1S2.3 12.7 2.3 9.7c0-2.2 1.2-4.2 3.1-5.8.2 1.4.8 2.4 1.7 3.1C7 5.4 7.4 3.6 8 1.6Z" />
  ),
  lightning: (
    <path d="M9.6 1.6 4.2 8.6h3.1L5.8 14.4 12.4 7H9.2L9.6 1.6Z" />
  ),
  royal: (
    <path d="M8 1.5 9.4 4.6 12.8 5l-2.6 2.3.8 3.4L8 9.1 5 10.7l.8-3.4L3.2 5l3.4-.4L8 1.5ZM3.4 12.4h9.2V14H3.4v-1.6Z" />
  ),
  moderator: (
    <path d="M3.2 3.2h9.6v2.1H9.4V12.8H6.6V5.3H3.2V3.2Z" />
  ),
  administrator: (
    <path d="M8 1.7 13.5 4.4v3.3c0 3.3-2.3 5.6-5.5 6.6-3.2-1-5.5-3.3-5.5-6.6V4.4L8 1.7Zm0 2.3-3.7 1.8v2c0 2.1 1.4 3.7 3.7 4.5 2.3-.8 3.7-2.4 3.7-4.5v-2L8 4Z" />
  ),
}

export function NameEmblem({ id }: { id?: NameEmblem | null }) {
  if (!id || id === 'none') return null
  return (
    <svg className="uname-emblem" viewBox="0 0 16 16" aria-hidden="true" focusable="false" fill="currentColor">
      {ICONS[id]}
    </svg>
  )
}
