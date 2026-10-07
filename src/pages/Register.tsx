import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useToast } from '../components/Toast'
import { useForum } from '../context/ForumContext'

export function Register() {
  const { register } = useForum()
  const toast = useToast()
  const navigate = useNavigate()
  const [form, setForm] = useState({
    username: '',
    email: '',
    displayName: '',
    password: '',
  })
  const [error, setError] = useState('')

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    const res = register(form)
    if (!res.ok) {
      setError(res.error)
      return
    }
    toast('Account created — welcome!')
    navigate('/')
  }

  return (
    <div className="max-w-md mx-auto forum-card p-6">
      <h1 className="text-2xl font-bold">Sign up</h1>
      <p className="text-sm prose-muted mt-1">Create an account to post, comment, like, and follow.</p>
      <form onSubmit={onSubmit} className="mt-4 space-y-3">
        <div>
          <label className="text-sm font-medium">Username</label>
          <input
            className="input mt-1"
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
            required
          />
        </div>
        <div>
          <label className="text-sm font-medium">Display name</label>
          <input
            className="input mt-1"
            value={form.displayName}
            onChange={(e) => setForm({ ...form, displayName: e.target.value })}
          />
        </div>
        <div>
          <label className="text-sm font-medium">Email</label>
          <input
            type="email"
            className="input mt-1"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
          />
        </div>
        <div>
          <label className="text-sm font-medium">Password</label>
          <input
            type="password"
            className="input mt-1"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required
          />
        </div>
        {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}
        <button type="submit" className="btn btn-primary w-full">
          Create account
        </button>
      </form>
      <p className="text-sm mt-4 prose-muted">
        Already registered? <Link to="/login" className="text-[var(--color-brand)] hover:underline">Log in</Link>
      </p>
    </div>
  )
}
