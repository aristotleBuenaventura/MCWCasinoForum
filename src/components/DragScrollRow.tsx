import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type MouseEvent, type PointerEvent, type ReactNode } from 'react'

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

/** Ignore tiny pointer jitter so card Links still receive clicks. */
const DRAG_THRESHOLD_PX = 12

/** Horizontal pager: ~4 cards visible, drag + smooth page snap, no scrollbar. */
export function DragScrollRow({ children, className = '' }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const drag = useRef<{
    active: boolean
    startX: number
    scrollLeft: number
    moved: boolean
    pointerId: number | null
  }>({
    active: false,
    startX: 0,
    scrollLeft: 0,
    moved: false,
    pointerId: null,
  })
  const [grabbing, setGrabbing] = useState(false)
  const [canPrev, setCanPrev] = useState(false)
  const [canNext, setCanNext] = useState(false)

  const updateArrows = useCallback(() => {
    const el = ref.current
    if (!el) return
    const max = Math.max(0, el.scrollWidth - el.clientWidth)
    setCanPrev(el.scrollLeft > 4)
    setCanNext(el.scrollLeft < max - 4)
  }, [])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    updateArrows()
    const onScroll = () => updateArrows()
    el.addEventListener('scroll', onScroll, { passive: true })
    const ro = new ResizeObserver(() => updateArrows())
    ro.observe(el)
    return () => {
      el.removeEventListener('scroll', onScroll)
      ro.disconnect()
    }
  }, [updateArrows, children])

  const snapToPage = useCallback((preferredDir = 0) => {
    const el = ref.current
    if (!el) return
    const pw = el.clientWidth
    if (pw <= 0) return
    const maxScroll = Math.max(0, el.scrollWidth - pw)
    const maxPage = Math.max(0, Math.round(maxScroll / pw))
    let page = Math.round(el.scrollLeft / pw)
    // Swipe threshold → commit to next/prev page
    if (preferredDir < -40) page = Math.ceil((drag.current.scrollLeft + 1) / pw)
    else if (preferredDir > 40) page = Math.floor((drag.current.scrollLeft - 1) / pw)
    page = clamp(page, 0, maxPage)
    el.scrollTo({ left: page * pw, behavior: 'smooth' })
  }, [])

  const goPage = (dir: -1 | 1) => {
    const el = ref.current
    if (!el) return
    const pw = el.clientWidth
    if (pw <= 0) return
    const page = Math.round(el.scrollLeft / pw) + dir
    const maxScroll = Math.max(0, el.scrollWidth - pw)
    const maxPage = Math.max(0, Math.round(maxScroll / pw))
    el.scrollTo({ left: clamp(page, 0, maxPage) * pw, behavior: 'smooth' })
  }

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    const el = ref.current
    if (!el || e.button !== 0) return
    drag.current = {
      active: true,
      startX: e.clientX,
      scrollLeft: el.scrollLeft,
      moved: false,
      pointerId: e.pointerId,
    }
  }

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const el = ref.current
    if (!el || !drag.current.active) return
    const dx = e.clientX - drag.current.startX
    if (!drag.current.moved) {
      if (Math.abs(dx) < DRAG_THRESHOLD_PX) return
      drag.current.moved = true
      setGrabbing(true)
      try {
        el.setPointerCapture(e.pointerId)
      } catch {
        /* ignore */
      }
    }
    el.scrollLeft = drag.current.scrollLeft - dx
  }

  const endDrag = (e: PointerEvent<HTMLDivElement>) => {
    const el = ref.current
    if (!el || !drag.current.active) return
    const dx = e.clientX - drag.current.startX
    const didMove = drag.current.moved
    drag.current.active = false
    setGrabbing(false)
    try {
      if (drag.current.pointerId != null) el.releasePointerCapture(drag.current.pointerId)
    } catch {
      /* ignore */
    }
    drag.current.pointerId = null
    if (didMove) {
      // Negative dx = finger moved left = scroll forward
      snapToPage(dx)
    }
  }

  const onClickCapture = (e: MouseEvent<HTMLDivElement>) => {
    if (drag.current.moved) {
      e.preventDefault()
      e.stopPropagation()
      drag.current.moved = false
    }
  }

  return (
    <div className={`drag-scroll-wrap relative ${className}`}>
      <button
        type="button"
        aria-label="Previous"
        className={`drag-scroll-arrow drag-scroll-arrow-prev ${canPrev ? '' : 'opacity-0 pointer-events-none'}`}
        onClick={() => goPage(-1)}
      >
        <ChevronLeft size={18} />
      </button>
      <div
        ref={ref}
        className={`drag-scroll-row flex gap-2 overflow-x-auto ${grabbing ? 'cursor-grabbing' : 'cursor-grab'}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onClickCapture={onClickCapture}
      >
        {children}
      </div>
      <button
        type="button"
        aria-label="Next"
        className={`drag-scroll-arrow drag-scroll-arrow-next ${canNext ? '' : 'opacity-0 pointer-events-none'}`}
        onClick={() => goPage(1)}
      >
        <ChevronRight size={18} />
      </button>
    </div>
  )
}
