import { Eye, EyeOff } from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { LoginLink } from '../components/LoginModal'
import { useToast } from '../components/Toast'
import { TurnstileWidget } from '../components/TurnstileWidget'
import { useForum } from '../context/ForumContext'

const WAIT_SECONDS = 25

const MONTHS = [
  { value: '', label: '' },
  { value: '01', label: 'January' },
  { value: '02', label: 'February' },
  { value: '03', label: 'March' },
  { value: '04', label: 'April' },
  { value: '05', label: 'May' },
  { value: '06', label: 'June' },
  { value: '07', label: 'July' },
  { value: '08', label: 'August' },
  { value: '09', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' },
]

export function Register() {
  const { register, currentUser } = useForum()
  const toast = useToast()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [month, setMonth] = useState('')
  const [day, setDay] = useState('')
  const [year, setYear] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [token, setToken] = useState('')
  const [error, setError] = useState('')
  const [wait, setWait] = useState(WAIT_SECONDS)

  useEffect(() => {
    if (currentUser) navigate('/', { replace: true })
  }, [currentUser, navigate])

  useEffect(() => {
    if (wait <= 0) return
    const id = window.setTimeout(() => setWait((s) => s - 1), 1000)
    return () => window.clearTimeout(id)
  }, [wait])

  const dateOfBirth = useMemo(() => {
    if (!month || !day || !year) return ''
    const d = day.padStart(2, '0')
    return `${year}-${month}-${d}`
  }, [month, day, year])

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (wait > 0) return
    if (!agreed) {
      setError('Please agree to the terms and privacy policy.')
      return
    }
    if (!token) {
      setError('Please complete the verification check.')
      return
    }
    if (!dateOfBirth) {
      setError('Date of birth is required.')
      return
    }
    const res = register({
      username,
      email,
      password,
      dateOfBirth,
      turnstileToken: token,
    })
    if (!res.ok) {
      setError(res.error)
      return
    }
    toast('Account created — welcome!')
    navigate('/')
  }

  return (
    <div className="max-w-[1100px] mx-auto">
      <nav className="text-[12px] prose-muted mb-2">
        <Link to="/" className="gold-text hover:underline">Home</Link>
        {' > '}
        Register
      </nav>

      <form onSubmit={onSubmit} className="xf-reg">
        <div className="xf-reg-title">Register</div>

        <div className="xf-reg-body">
          <div className="xf-reg-row">
            <label htmlFor="reg-username">
              Username:
              <span className="xf-reg-req">Required</span>
            </label>
            <div>
              <input
                id="reg-username"
                className="input"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                required
              />
              <p className="xf-reg-hint">
                This is the name that will be shown with your messages. You may use any name you wish.
              </p>
            </div>
          </div>

          <div className="xf-reg-row">
            <label htmlFor="reg-email">
              Email:
              <span className="xf-reg-req">Required</span>
            </label>
            <div>
              <input
                id="reg-email"
                className="input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </div>
          </div>

          <div className="xf-reg-row">
            <label htmlFor="reg-password">
              Password:
              <span className="xf-reg-req">Required</span>
            </label>
            <div>
              <div className="xf-pass-row">
                <input
                  id="reg-password"
                  className="input"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
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
              <div className="xf-pass-meter" />
              <p className="xf-reg-hint">
                {password ? 'Choose a strong password of at least 6 characters.' : 'Entering a password is required.'}
              </p>
            </div>
          </div>

          <div className="xf-reg-row">
            <label htmlFor="reg-month">
              Date of birth:
              <span className="xf-reg-req">Required</span>
            </label>
            <div className="xf-dob">
              <select id="reg-month" className="input xf-dob-month" value={month} onChange={(e) => setMonth(e.target.value)} required>
                {MONTHS.map((m) => (
                  <option key={m.value || 'empty'} value={m.value}>{m.label}</option>
                ))}
              </select>
              <input
                className="input xf-dob-num"
                inputMode="numeric"
                placeholder="Day"
                value={day}
                onChange={(e) => setDay(e.target.value.replace(/\D/g, '').slice(0, 2))}
                required
              />
              <input
                className="input xf-dob-num"
                inputMode="numeric"
                placeholder="Year"
                value={year}
                onChange={(e) => setYear(e.target.value.replace(/\D/g, '').slice(0, 4))}
                required
              />
            </div>
          </div>

          <div className="xf-reg-row">
            <div className="xf-reg-label">
              Verification:
              <span className="xf-reg-req">Required</span>
            </div>
            <div>
              <TurnstileWidget onToken={setToken} />
            </div>
          </div>

          <div className="xf-reg-row xf-reg-agree-row">
            <div />
            <label className="xf-check">
              <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
              <span>
                I agree to the <a href="#terms" className="gold-text hover:underline">terms</a> and{' '}
                <a href="#privacy" className="gold-text hover:underline">privacy policy</a>.
              </span>
            </label>
          </div>

          {error && <p className="text-sm text-[var(--color-danger)] mb-3">{error}</p>}
        </div>

        <div className="xf-reg-actions">
          <button type="submit" className="btn-wait" disabled={wait > 0}>
            {wait > 0 ? `(Please wait ${wait} second(s).)` : 'Register'}
          </button>
        </div>
      </form>

      <p className="text-[12px] prose-muted mt-3">
        Already registered?{' '}
        <LoginLink className="gold-text hover:underline bg-transparent border-0 p-0 cursor-pointer">Log in</LoginLink>
      </p>

      <section id="terms" className="xf-legal mt-6">
        <h2>Terms and rules</h2>
        <p>
          MCW Forum is a community for players 18+. Do not spam, impersonate staff, share account credentials,
          or promote illegal activity. Moderators may remove content and restrict accounts that break these rules.
        </p>
      </section>
      <section id="privacy" className="xf-legal mt-4">
        <h2>Privacy policy</h2>
        <p>
          This demo stores your username, email, and date of birth in your browser so the forum can run locally.
          Nothing is sent to a remote account server.
        </p>
      </section>
    </div>
  )
}
