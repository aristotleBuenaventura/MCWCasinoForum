import { useEffect } from 'react'

export function DocumentTitle({
  title,
  description,
}: {
  title: string
  description?: string
}) {
  useEffect(() => {
    const prev = document.title
    document.title = title
    let meta = document.querySelector('meta[name="description"]')
    if (!meta) {
      meta = document.createElement('meta')
      meta.setAttribute('name', 'description')
      document.head.appendChild(meta)
    }
    const prevDesc = meta.getAttribute('content')
    if (description) meta.setAttribute('content', description)
    let canonical = document.querySelector('link[rel="canonical"]')
    if (!canonical) {
      canonical = document.createElement('link')
      canonical.setAttribute('rel', 'canonical')
      document.head.appendChild(canonical)
    }
    canonical.setAttribute('href', window.location.origin + window.location.pathname)
    let og = document.querySelector('meta[property="og:title"]')
    if (!og) {
      og = document.createElement('meta')
      og.setAttribute('property', 'og:title')
      document.head.appendChild(og)
    }
    og.setAttribute('content', title)
    return () => {
      document.title = prev
      if (prevDesc) meta?.setAttribute('content', prevDesc)
    }
  }, [title, description])
  return null
}
