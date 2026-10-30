import { Bell, Menu, Search, X } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useForum } from '../../context/ForumContext'
import { Avatar } from '../Avatar'
import { LoginLink } from '../LoginModal'

const links = [
  { to: '/', label: 'Home' },
  { to: '/communities', label: 'Communities' },
  { to: '/communities/slot-games', label: 'Games' },
  { to: '/communities/casino-reviews', label: 'Reviews' },
  { to: '/members', label: 'Leaderboards' },
]

export function Header() {
  const { currentUser, logout, unreadCount, isMod } = useForum()
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()

  const onSearch = (e: FormEvent) => {
    e.preventDefault()
    if (!q.trim()) return
    navigate(`/search?q=${encodeURIComponent(q.trim())}`)
    setOpen(false)
  }

  return (
    <header className="site-header sticky top-0 z-40">
      <div className="w-full px-3 h-12 flex items-center gap-3">
        <Link to="/" className="flex items-center gap-2 shrink-0">
          <img src="/assets/hero-crest.jpg" alt="" className="h-7 w-7 rounded object-cover" />
          <div className="leading-none">
            <div className="text-[13px] font-extrabold tracking-wide gold-text">MCW</div>
            <div className="text-[9px] uppercase tracking-[0.16em] text-[#929cb3]">Forum</div>
          </div>
        </Link>

        <nav className="hidden md:flex items-center text-[13px]">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.to === '/'} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              {l.label}
            </NavLink>
          ))}
        </nav>

        <form onSubmit={onSearch} className="hidden md:flex flex-1 max-w-sm ml-2">
          <div className="relative w-full">
            <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[#929cb3]" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search discussions, games, and reviews"
              className="input pl-9 h-8 text-[13px]"
            />
          </div>
        </form>

        <div className="flex items-center gap-1.5 ml-auto">
          <Link to="/create" className="btn btn-accent h-8 px-3 hidden sm:inline-flex">Create Post</Link>
          {currentUser ? (
            <>
              <Link to="/notifications" className="btn btn-secondary btn-icon relative" aria-label="Notifications">
                <Bell size={14} />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-[var(--color-danger)] text-white text-[10px] flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </Link>
              {isMod && <Link to="/admin" className="btn btn-secondary h-8 hidden sm:inline-flex">Admin</Link>}
              <Link to={`/profile/${currentUser.username}`} className="rounded-full focus-visible:outline-2 focus-visible:outline-[color-mix(in_oklab,var(--color-gold)_55%,transparent)] focus-visible:outline-offset-1" aria-label="Your profile">
                <Avatar user={currentUser} size={26} />
              </Link>
              <button type="button" className="btn btn-secondary h-8 hidden md:inline-flex" onClick={logout}>Log out</button>
            </>
          ) : (
            <>
              <LoginLink className="btn btn-secondary h-8">Log in</LoginLink>
              <Link to="/register" className="btn btn-primary h-8">Register</Link>
            </>
          )}
          <button
            type="button"
            className="md:hidden btn btn-secondary btn-icon"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
          >
            {open ? <X size={15} /> : <Menu size={15} />}
          </button>
        </div>
      </div>

      {open && (
        <div className="md:hidden border-t border-[var(--color-border)] px-3 py-2 space-y-1 bg-[var(--color-nav)]">
          <form onSubmit={onSearch} className="pb-2">
            <div className="relative">
              <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[#929cb3]" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search the forum"
                className="input pl-9 h-8 text-[13px]"
              />
            </div>
          </form>
          {links.map((l) => (
            <Link key={l.to} to={l.to} className="block py-1.5 text-sm" onClick={() => setOpen(false)}>{l.label}</Link>
          ))}
          {currentUser && (
            <button
              type="button"
              className="block py-1.5 text-sm w-full text-left"
              onClick={() => {
                setOpen(false)
                logout()
              }}
            >
              Log out
            </button>
          )}
        </div>
      )}
    </header>
  )
}
