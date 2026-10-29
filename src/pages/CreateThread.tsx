import { useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { MediaUpload } from '../components/MediaUpload'
import { useToast } from '../components/Toast'
import { useForum } from '../context/ForumContext'
import type { MediaType } from '../types'

export function CreateThread() {
  const { currentUser, state, createThread, leafCategories } = useForum()
  const [params] = useSearchParams()
  const toast = useToast()
  const navigate = useNavigate()

  const requested = params.get('forum') || ''
  const defaultForum = useMemo(() => {
    if (leafCategories.some((c) => c.id === requested)) return requested
    const children = state.categories.filter((c) => c.parentId === requested)
    if (children[0]) return children[0].id
    return leafCategories[0]?.id || ''
  }, [requested, leafCategories, state.categories])

  const [forumId, setForumId] = useState(defaultForum)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [mediaUrl, setMediaUrl] = useState<string | null>(null)
  const [mediaType, setMediaType] = useState<MediaType>(null)
  const [error, setError] = useState('')

  if (!currentUser) {
    return (
      <div className="forum-card p-6 text-center max-w-lg mx-auto">
        <p className="prose-muted">You need an account to create a thread.</p>
        <div className="mt-3 flex justify-center gap-2">
          <Link to="/login" className="btn btn-secondary">Log in</Link>
          <Link to="/register" className="btn btn-primary">Sign up</Link>
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

  const labelFor = (id: string) => {
    const c = state.categories.find((x) => x.id === id)
    if (!c) return id
    const parent = c.parentId ? state.categories.find((x) => x.id === c.parentId) : null
    return parent ? `${parent.name} / ${c.name}` : c.name
  }

  return (
    <div className="forum-card p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold">Create thread</h1>
      <form onSubmit={onSubmit} className="mt-4 space-y-3">
        <div>
          <label className="text-sm font-medium">Community</label>
          <select className="input mt-1" value={forumId} onChange={(e) => setForumId(e.target.value)}>
            {leafCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {labelFor(c.id)}
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
          <textarea className="input mt-1 min-h-36" value={content} onChange={(e) => setContent(e.target.value)} required />
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
        <button type="submit" className="btn btn-primary">Post thread</button>
      </form>
    </div>
  )
}
