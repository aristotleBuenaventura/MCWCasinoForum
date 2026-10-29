import { useEffect, useState } from 'react'
import { useForum } from '../context/ForumContext'
import type { AdSlot } from '../types'
import { MediaOrPlaceholder } from './Placeholder'

export function AdRotator({
  slot,
  className = '',
  heightClass = 'h-44',
}: {
  slot: AdSlot
  className?: string
  heightClass?: string
}) {
  const { adsForSlot, state } = useForum()
  const ads = adsForSlot(slot)
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (ads.length <= 1) return
    const ms = Math.max(2, state.adRotateSec) * 1000
    const timer = window.setInterval(() => {
      setIndex((i) => (i + 1) % ads.length)
    }, ms)
    return () => window.clearInterval(timer)
  }, [ads.length, state.adRotateSec])

  if (ads.length === 0) {
    return <div className={`forum-card overflow-hidden ${className}`}><MediaOrPlaceholder label="Ad slot" className={`w-full ${heightClass}`} /></div>
  }

  const ad = ads[index % ads.length]
  const inner = (
    <MediaOrPlaceholder src={ad.imageUrl} label={ad.title || 'Advertisement'} className={`w-full ${heightClass}`} />
  )

  if (ad.url) {
    return (
      <a href={ad.url} target="_blank" rel="noreferrer" className={`forum-card overflow-hidden block ${className}`}>
        {inner}
      </a>
    )
  }
  return <div className={`forum-card overflow-hidden ${className}`}>{inner}</div>
}
