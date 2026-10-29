import { X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { inferMediaKind, useMediaSrc } from '../lib/media'
import type { MediaType } from '../types'

function ImageLightbox({ src, onClose }: { src: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  return createPortal(
    <div
      className="fixed inset-0 z-[80] bg-black/90 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Image preview"
      onClick={onClose}
    >
      <button
        type="button"
        className="absolute top-4 right-4 z-[81] h-10 w-10 rounded-full bg-black/70 text-white border border-white/20 inline-flex items-center justify-center hover:bg-black"
        onClick={onClose}
        aria-label="Close"
      >
        <X size={22} />
      </button>
      <img
        src={src}
        alt=""
        className="max-w-[96vw] max-h-[92vh] object-contain select-none"
        onClick={(e) => e.stopPropagation()}
      />
    </div>,
    document.body,
  )
}

export function ForumMedia({
  url,
  type,
  className,
  lightbox = false,
}: {
  url?: string | null
  type?: MediaType | null
  className?: string
  lightbox?: boolean
}) {
  const src = useMediaSrc(url)
  const [open, setOpen] = useState(false)
  if (!url || !src) return null
  const kind = inferMediaKind(url, type)
  if (kind === 'video') return <video src={src} controls className={className} />
  if (!lightbox) return <img src={src} alt="" className={className} />
  return (
    <>
      <button type="button" className="block p-0 bg-transparent border-0 cursor-zoom-in max-w-full" onClick={() => setOpen(true)} aria-label="View image">
        <img src={src} alt="" className={className} />
      </button>
      {open && <ImageLightbox src={src} onClose={() => setOpen(false)} />}
    </>
  )
}

export function ForumImage({
  url,
  fallback,
  className,
}: {
  url?: string | null
  fallback?: string
  className?: string
}) {
  const src = useMediaSrc(url)
  const finalSrc = src || fallback
  if (!finalSrc) return null
  return <img src={finalSrc} alt="" className={className} />
}
