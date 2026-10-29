import { Bell, Menu, Search, X } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useForum } from '../../context/ForumContext'
import { Avatar } from '../Avatar'

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
    <header className="sticky top-0 z-40 border-b border-[var(--color-border)] bg-[#0b0d14]/95 backdrop-blur">
      <div className="max-w-[1440px] mx-auto px-4 h-16 flex items-center gap-4">
        <Link to="/" className="flex items-center gap-2 shrink-0">
          <div className="h-9 w-9 rounded-md bg-gradient-to-br from-[#f0d48a] to-[#8a6d32] text-[#1a1408] font-black flex items-center justify-center text-xs">
            MCW
          </div>
          <div className="leading-tight">
            <div className="font-bold tracking-wide gold-text">MCW</div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-[#9aa0b3]">Forum</div>
          </div>
        </Link>

        <nav className="hidden lg:flex items-center gap-1 text-sm">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.to === '/'} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              {l.label}
            </NavLink>
          ))}
        </nav>

        <form onSubmit={onSearch} className="hidden md:flex flex-1 max-w-md ml-auto">
          <div className="relative w-full">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8b8fa3]" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search discussions, games, and reviews"
              className="input pl-9 h-10"
            />
          </div>
        </form>

        <div className="flex items-center gap-2 ml-auto md:ml-0">
          {currentUser ? (
            <>
              <Link to="/notifications" className="btn btn-secondary relative px-2.5">
                <Bell size={16} />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-[var(--color-danger)] text-white text-[10px] flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </Link>
              <Link to="/create" className="btn btn-accent hidden sm:inline-flex">
                Create Post
              </Link>
              {isMod && (
                <Link to="/admin" className="btn btn-secondary hidden sm:inline-flex">
                  Admin
                </Link>
              )}
              <Link to={`/profile/${currentUser.username}`} className="flex items-center gap-2">
                <Avatar user={currentUser} size={32} />
              </Link>
              <button type="button" className="btn btn-secondary hidden md:inline-flex" onClick={logout}>
                Log out
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="btn btn-secondary">
                Log in
              </Link>
              <Link to="/register" className="btn btn-primary">
                Join
              </Link>
            </>
          )}
          <button type="button" className="lg:hidden btn btn-secondary px-2.5" onClick={() => setOpen((v) => !v)}>
            {open ? <X size={16} /> : <Menu size={16} />}
          </button>
        </div>
      </div>

      {open && (
        <div className="lg:hidden border-t border-[var(--color-border)] px-4 py-3 space-y-2 bg-[#0b0d14]">
          <form onSubmit={onSearch} className="flex gap-2 md:hidden">
            <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search..." />
            <button type="submit" className="btn btn-primary">Go</button>
          </form>
          {links.map((l) => (
            <Link key={l.to} to={l.to} className="block py-1.5" onClick={() => setOpen(false)}>
              {l.label}
            </Link>
          ))}
          {currentUser && (
            <>
              <Link to="/create" className="block py-1.5" onClick={() => setOpen(false)}>Create Post</Link>
              {isMod && <Link to="/admin" className="block py-1.5" onClick={() => setOpen(false)}>Admin</Link>}
              <button type="button" className="block py-1.5" onClick={() => { logout(); setOpen(false) }}>Log out</button>
            </>
          )}
        </div>
      )}
    </header>
  )
}
