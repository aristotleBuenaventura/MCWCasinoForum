import { useEffect, useState } from 'react'
import { SLOT_ART } from '../data/artwork'
import { useForum } from '../context/ForumContext'
import type { AdSlot } from '../types'

export function AdRotator({
  slot,
  className = '',
  heightClass = 'h-52',
  variant = 'card',
}: {
  slot: AdSlot
  className?: string
  heightClass?: string
  variant?: 'card' | 'inline'
}) {
  const { adsForSlot, state } = useForum()
  const ads = adsForSlot(slot)
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (ads.length <= 1) return
    const ms = Math.max(2, state.adRotateSec) * 1000
    const timer = window.setInterval(() => setIndex((i) => (i + 1) % ads.length), ms)
    return () => window.clearInterval(timer)
  }, [ads.length, state.adRotateSec])

  const ad = ads[index % Math.max(ads.length, 1)]
  const src = ad?.imageUrl || SLOT_ART[slot]
  const href = ad?.url
  const title = ad?.title || 'Promotion'
  const wrap = variant === 'inline' ? 'overflow-hidden block' : 'forum-card overflow-hidden block'

  const inner = (
    <img src={src} alt={title} className={`w-full ${heightClass} object-cover`} />
  )

  if (href) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className={`${wrap} ${className}`}>
        {inner}
      </a>
    )
  }
  return <div className={`${wrap} ${className}`}>{inner}</div>
}
