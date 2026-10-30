import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { DocumentTitle } from '../components/DocumentTitle'
import { useToast } from '../components/Toast'
import { useForum } from '../context/ForumContext'
import { api } from '../lib/api'

export function ResetPassword() {
  const [params] = useSearchParams()
  const token = params.get('token') || ''
  const toast = useToast()
  const navigate = useNavigate()
  const { retry } = useForum()
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const res = await api('/api/auth/reset', { method: 'POST', body: JSON.stringify({ token, password }) })
    if (!res.ok) {
      setError(res.error)
      return
    }
    await retry()
    toast('Password updated')
    navigate('/', { replace: true })
  }

  return (
    <div className="max-w-md mx-auto forum-card p-5 space-y-3">
      <DocumentTitle title="Reset password — MCW Forum" />
      <h1 className="page-title gold-text">Reset password</h1>
      {!token ? (
        <p className="text-sm prose-muted">This reset link is missing. Request a new one from the login overlay.</p>
      ) : (
        <form onSubmit={onSubmit} className="space-y-3">
          <label className="block text-sm">
            New password
            <input
              className="input mt-1"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              required
            />
          </label>
          <p className="text-[11px] prose-muted">At least 8 characters, including a letter and a number.</p>
          {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}
          <button type="submit" className="btn btn-primary">Save password</button>
        </form>
      )}
      <Link to="/" className="text-sm gold-text hover:underline">Back to home</Link>
    </div>
  )
}
