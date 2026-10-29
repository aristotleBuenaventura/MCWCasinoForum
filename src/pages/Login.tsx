import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForum } from '../context/ForumContext'
import { useToast } from '../components/Toast'

export function Login() {
  const { login } = useForum()
  const toast = useToast()
  const navigate = useNavigate()
  const [usernameOrEmail, setUsernameOrEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    const res = login(usernameOrEmail, password)
    if (!res.ok) {
      setError(res.error)
      return
    }
    toast('Welcome back!')
    navigate('/')
  }

  return (
    <div className="max-w-md mx-auto forum-card p-6">
      <h1 className="text-2xl font-bold">Log in</h1>
      <p className="text-sm prose-muted mt-1">
        Demo accounts: <code>alicewins</code> / <code>password123</code> or{' '}
        <code>moderator</code> / <code>moderator123</code>
      </p>
      <form onSubmit={onSubmit} className="mt-4 space-y-3">
        <div>
          <label className="text-sm font-medium">Username or email</label>
          <input className="input mt-1" value={usernameOrEmail} onChange={(e) => setUsernameOrEmail(e.target.value)} required />
        </div>
        <div>
          <label className="text-sm font-medium">Password</label>
          <input
            type="password"
            className="input mt-1"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}
        <button type="submit" className="btn btn-primary w-full">
          Log in
        </button>
      </form>
      <p className="text-sm mt-4 prose-muted">
        No account? <Link to="/register" className="text-[var(--color-gold)] hover:underline">Sign up</Link>
      </p>
    </div>
  )
}
