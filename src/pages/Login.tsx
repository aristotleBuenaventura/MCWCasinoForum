import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForum } from '../context/ForumContext'

/** Bookmarks to /login open the overlay on the home page instead of a standalone screen. */
export function Login() {
  const { openLogin, currentUser } = useForum()
  const navigate = useNavigate()

  useEffect(() => {
    if (!currentUser) openLogin()
    navigate('/', { replace: true })
  }, [currentUser, navigate, openLogin])

  return null
}
