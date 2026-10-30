import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { DocumentTitle } from '../components/DocumentTitle'
import { api } from '../lib/api'

export function VerifyEmail() {
  const [params] = useSearchParams()
  const token = params.get('token') || ''
  const [message, setMessage] = useState('Verifying…')

  useEffect(() => {
    if (!token) {
      setMessage('This verification link is missing.')
      return
    }
    void api('/api/auth/verify-email', { method: 'POST', body: JSON.stringify({ token }) }).then((res) => {
      setMessage(res.ok ? 'Email verified. You can continue using the forum.' : res.error)
    })
  }, [token])

  return (
    <div className="max-w-md mx-auto forum-card p-5 space-y-3">
      <DocumentTitle title="Verify email — MCW Forum" />
      <h1 className="page-title gold-text">Email verification</h1>
      <p className="text-sm prose-muted">{message}</p>
      <Link to="/" className="text-sm gold-text hover:underline">Back to home</Link>
    </div>
  )
}
