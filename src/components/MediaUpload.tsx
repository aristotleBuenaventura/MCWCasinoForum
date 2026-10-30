import { ImagePlus, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { uploadImage } from '../lib/uploads'
import type { MediaType } from '../types'
import { ForumMedia } from './ForumMedia'
import { useToast } from './Toast'

type Props = {
  mediaUrl: string | null
  mediaType: MediaType
  onChange: (url: string | null, type: MediaType) => void
  onBusyChange?: (busy: boolean) => void
  enablePaste?: boolean
}

export function MediaUpload({ mediaUrl, mediaType, onChange, onBusyChange, enablePaste = false }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const toast = useToast()
  const [busy, setBusy] = useState(false)

  const setBusyState = (value: boolean) => {
    setBusy(value)
    onBusyChange?.(value)
  }

  const onFile = async (file: File | undefined) => {
    if (!file) return
    const isImage = file.type.startsWith('image/')
    if (!isImage) {
      toast('Please choose a JPEG, PNG, GIF, or WebP image.')
      return
    }
    setBusyState(true)
    try {
      const url = await uploadImage(file)
      onChange(url, 'image')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setBusyState(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  useEffect(() => {
    if (!enablePaste) return
    const onPaste = (e: ClipboardEvent) => {
      const file = [...(e.clipboardData?.files ?? [])].find((item) => item.type.startsWith('image/'))
      if (!file) return
      e.preventDefault()
      void onFile(file)
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [enablePaste])

  return (
    <div
      className="space-y-2"
      onDragOver={(e) => {
        e.preventDefault()
      }}
      onDrop={(e) => {
        e.preventDefault()
        void onFile(e.dataTransfer.files?.[0])
      }}
    >
      <div className="flex gap-2">
        <button type="button" className="btn btn-secondary" onClick={() => inputRef.current?.click()} disabled={busy}>
          <ImagePlus size={16} /> {busy ? 'Uploading…' : 'Add image or video'}
        </button>
        {mediaUrl && (
          <button type="button" className="btn btn-secondary" onClick={() => onChange(null, null)} disabled={busy}>
            <X size={16} /> Remove
          </button>
        )}
      </div>
      <p className="text-[11px] prose-muted">PNG, JPG, GIF, or MP4. You can also paste or drop a file here.</p>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,video/*"
        className="hidden"
        onChange={(e) => onFile(e.target.files?.[0])}
      />
      <ForumMedia
        url={mediaUrl}
        type={mediaType}
        className="max-h-56 max-w-full rounded border border-[var(--color-border)]"
      />
    </div>
  )
}
