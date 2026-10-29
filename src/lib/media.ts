import { useEffect, useState } from 'react'
import { fileToDataUrl } from './utils'
import type { MediaType } from '../types'

const DB_NAME = 'mcw-forum-media'
const STORE = 'files'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function putMedia(id: string, dataUrl: string) {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(dataUrl, id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function getMedia(id: string): Promise<string | null> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).get(id)
    req.onsuccess = () => resolve((req.result as string | undefined) ?? null)
    req.onerror = () => reject(req.error)
  })
}

export function mediaIdFromUrl(url: string | null | undefined) {
  if (!url?.startsWith('idb:')) return null
  return url.slice(4)
}

export function inferMediaKind(url?: string | null, type?: MediaType | null): 'image' | 'video' | null {
  if (type === 'video' || type === 'image') return type
  if (!url) return null
  if (url.startsWith('data:video') || /\.(mp4|webm|mov|ogg)(\?|$)/i.test(url)) return 'video'
  return 'image'
}

export async function compressImageFile(file: File): Promise<string> {
  if (file.type === 'image/gif') return fileToDataUrl(file, 2_000_000)
  try {
    const bitmap = await createImageBitmap(file)
    const maxEdge = 1400
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height))
    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      bitmap.close()
      return fileToDataUrl(file, 1_800_000)
    }
    ctx.drawImage(bitmap, 0, 0, width, height)
    bitmap.close()
    const quality = file.size > 1_200_000 ? 0.72 : 0.84
    return canvas.toDataURL('image/jpeg', quality)
  } catch {
    return fileToDataUrl(file, 1_800_000)
  }
}

export function useMediaSrc(url?: string | null) {
  const [src, setSrc] = useState<string | null>(() => (url && !url.startsWith('idb:') ? url : null))

  useEffect(() => {
    if (!url) {
      setSrc(null)
      return
    }
    if (!url.startsWith('idb:')) {
      setSrc(url)
      return
    }
    let alive = true
    getMedia(url.slice(4))
      .then((value) => {
        if (alive) setSrc(value)
      })
      .catch(() => {
        if (alive) setSrc(null)
      })
    return () => {
      alive = false
    }
  }, [url])

  return src
}
