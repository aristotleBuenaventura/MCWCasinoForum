import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { MediaUpload } from '../components/MediaUpload'
import { useToast } from '../components/Toast'
import { useForum } from '../context/ForumContext'
import type { MediaType } from '../types'

export function CreateThread() {
  const { currentUser, state, createThread } = useForum()
  const [params] = useSearchParams()
  const toast = useToast()
  const navigate = useNavigate()
  const [forumId, setForumId] = useState(params.get('forum') || state.categories[0]?.id || '')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [mediaUrl, setMediaUrl] = useState<string | null>(null)
  const [mediaType, setMediaType] = useState<MediaType>(null)
  const [error, setError] = useState('')

  if (!currentUser) {
    return (
      <div className="forum-card p-6 text-center">
        <p className="prose-muted">You need an account to create a thread.</p>
        <div className="mt-3 flex justify-center gap-2">
          <Link to="/login" className="btn btn-secondary">
            Log in
          </Link>
          <Link to="/register" className="btn btn-primary">
            Sign up
          </Link>
        </div>
      </div>
    )
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    const res = createThread({ forumId, title, content, mediaUrl, mediaType })
    if ('error' in res) {
      setError(res.error)
      return
    }
    toast('Thread created')
    navigate(`/thread/${res.id}`)
  }

  return (
    <div className="forum-card p-6 max-w-2xl">
      <h1 className="text-2xl font-bold">Create thread</h1>
      <form onSubmit={onSubmit} className="mt-4 space-y-3">
        <div>
          <label className="text-sm font-medium">Forum</label>
          <select className="input mt-1" value={forumId} onChange={(e) => setForumId(e.target.value)}>
            {state.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium">Title</label>
          <input className="input mt-1" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={140} required />
        </div>
        <div>
          <label className="text-sm font-medium">Content</label>
          <textarea
            className="input mt-1 min-h-36"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            required
          />
        </div>
        <MediaUpload
          mediaUrl={mediaUrl}
          mediaType={mediaType}
          onChange={(url, type) => {
            setMediaUrl(url)
            setMediaType(type)
          }}
        />
        {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}
        <button type="submit" className="btn btn-primary">
          Post thread
        </button>
      </form>
    </div>
  )
}
