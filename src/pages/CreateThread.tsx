import { useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { LoginLink } from '../components/LoginModal'
import { PostComposer } from '../components/PostComposer'
import { useToast } from '../components/Toast'
import { useForum } from '../context/ForumContext'
import { emptyBody } from '../lib/postBody'

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
  const [body, setBody] = useState(emptyBody)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  const requestedCat = state.categories.find((c) => c.id === requested)

  if (!currentUser) {
    return (
      <div className="max-w-[1100px] mx-auto">
        <div className="text-[12px] prose-muted mb-2">
          <Link to="/communities" className="gold-text hover:underline">Forum list</Link>
          {' / '}
          Post thread
        </div>
        <div className="xf-gate mx-auto">
          <p className="prose-muted">You need an account to create a thread.</p>
          <div className="mt-3 flex justify-center gap-2">
            <LoginLink className="btn-post">Log in</LoginLink>
            <Link to="/register" className="btn btn-secondary" style={{ borderRadius: 3, height: 28, fontSize: 12 }}>Sign up</Link>
          </div>
        </div>
      </div>
    )
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (uploading) return
    const res = await createThread({ forumId, title, body })
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
    <div className="max-w-[1100px] mx-auto xf-form-page">
      <div className="text-[12px] prose-muted mb-2">
        <Link to="/communities" className="gold-text hover:underline">Forum list</Link>
        {requestedCat && (
          <>
            {' / '}
            <Link to={`/communities/${requestedCat.slug}`} className="gold-text hover:underline">{requestedCat.name}</Link>
          </>
        )}
        {' / '}
        Post thread
      </div>
      <h1 className="page-title gold-text mb-2">Post thread</h1>
      <form onSubmit={onSubmit} className="xf-form">
        <div className="xf-form-row">
          <label htmlFor="thread-forum">Forum</label>
          <div>
            <select id="thread-forum" className="input" value={forumId} onChange={(e) => setForumId(e.target.value)}>
              {leafCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {labelFor(c.id)}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="xf-form-row">
          <label htmlFor="thread-title">Title</label>
          <div>
            <input
              id="thread-title"
              className="input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={140}
              required
            />
          </div>
        </div>
        <PostComposer
          value={body}
          onChange={setBody}
          onBusyChange={setUploading}
          placeholder="Write your message..."
        />
        {error && <p className="text-[12px] text-[var(--color-danger)] px-3 py-2">{error}</p>}
        <div className="xf-form-actions">
          <button type="submit" className="btn-post" disabled={uploading}>
            {uploading ? 'Uploading…' : 'Post thread'}
          </button>
        </div>
      </form>
    </div>
  )
}
