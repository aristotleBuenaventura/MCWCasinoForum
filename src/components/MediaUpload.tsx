import { ImagePlus, X } from 'lucide-react'
import { useRef } from 'react'
import { fileToDataUrl } from '../lib/utils'
import type { MediaType } from '../types'
import { useToast } from './Toast'

type Props = {
  mediaUrl: string | null
  mediaType: MediaType
  onChange: (url: string | null, type: MediaType) => void
}

export function MediaUpload({ mediaUrl, mediaType, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const toast = useToast()

  const onFile = async (file: File | undefined) => {
    if (!file) return
    const isImage = file.type.startsWith('image/')
    const isVideo = file.type.startsWith('video/')
    if (!isImage && !isVideo) {
      toast('Please choose an image or video file.')
      return
    }
    try {
      const url = await fileToDataUrl(file, isVideo ? 6_000_000 : 3_500_000)
      onChange(url, isImage ? 'image' : 'video')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Upload failed')
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <button type="button" className="btn btn-secondary" onClick={() => inputRef.current?.click()}>
          <ImagePlus size={16} /> Add image or video
        </button>
        {mediaUrl && (
          <button type="button" className="btn btn-secondary" onClick={() => onChange(null, null)}>
            <X size={16} /> Remove
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,video/*"
        className="hidden"
        onChange={(e) => onFile(e.target.files?.[0])}
      />
      {mediaUrl && mediaType === 'image' && (
        <img src={mediaUrl} alt="Upload preview" className="max-h-56 rounded border border-[var(--color-border)]" />
      )}
      {mediaUrl && mediaType === 'video' && (
        <video src={mediaUrl} controls className="max-h-56 rounded border border-[var(--color-border)] w-full" />
      )}
    </div>
  )
}
