import { Eye, EyeOff, Lock, X } from 'lucide-react'
import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useForum } from '../context/ForumContext'
import { useToast } from './Toast'

export function LoginLink({ children, className }: { children: ReactNode; className?: string }) {
  const { openLogin } = useForum()
  return (
    <button type="button" className={className} onClick={openLogin}>
      {children}
    </button>
  )
}

export function LoginModal() {
  const { login, loginOpen, closeLogin } = useForum()
  const toast = useToast()
  const [usernameOrEmail, setUsernameOrEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [stayLoggedIn, setStayLoggedIn] = useState(true)
  const [forgot, setForgot] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!loginOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeLogin()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [loginOpen, closeLogin])

  useEffect(() => {
    if (!loginOpen) {
      setPassword('')
      setError('')
      setForgot(false)
      setShowPassword(false)
    }
  }, [loginOpen])

  if (!loginOpen) return null

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const res = await login(usernameOrEmail, password, stayLoggedIn)
    if (!res.ok) {
      setError(res.error)
      return
    }
    toast('Welcome back!')
    closeLogin()
  }

  return (
    <div className="xf-overlay-backdrop" onClick={closeLogin} role="presentation">
      <div
        className="xf-overlay"
        role="dialog"
        aria-modal="true"
        aria-labelledby="login-overlay-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="xf-overlay-head">
          <h2 id="login-overlay-title">Log in</h2>
          <button type="button" className="xf-overlay-close" onClick={closeLogin} aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={onSubmit}>
          <div className="xf-overlay-row">
            <label htmlFor="login-user">Your name or email address:</label>
            <div className="xf-overlay-field">
              <input
                id="login-user"
                className="input"
                value={usernameOrEmail}
                onChange={(e) => setUsernameOrEmail(e.target.value)}
                autoComplete="username"
                autoFocus
                required
              />
            </div>
          </div>

          <div className="xf-overlay-row">
            <label htmlFor="login-pass">Password:</label>
            <div className="xf-overlay-field">
              <div className="xf-pass-row">
                <input
                  id="login-pass"
                  className="input"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  className="xf-show"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-pressed={showPassword}
                >
                  {showPassword ? <EyeOff size={13} className="xf-show-icon" /> : <Eye size={13} className="xf-show-icon" />}
                  Show
                </button>
              </div>
              <button type="button" className="xf-forgot" onClick={() => setForgot(true)}>
                Forgot your password?
              </button>
              {forgot && (
                <p className="xf-reg-hint mt-1">
                  Password reset is not enabled. Contact an administrator if you need access.
                </p>
              )}
              <label className="xf-check">
                <input
                  type="checkbox"
                  checked={stayLoggedIn}
                  onChange={(e) => setStayLoggedIn(e.target.checked)}
                />
                Stay logged in
              </label>
              {error && <p className="text-sm text-[var(--color-danger)] mt-2">{error}</p>}
            </div>
          </div>

          <div className="xf-overlay-actions">
            <button type="submit" className="btn-login">
              <Lock size={12} />
              Log in
            </button>
          </div>
        </form>

        <div className="xf-overlay-signup">
          <span>Don&apos;t have an account?</span>
          <Link to="/register" className="btn-register-now" onClick={closeLogin}>
            Register now
          </Link>
        </div>
      </div>
    </div>
  )
}
