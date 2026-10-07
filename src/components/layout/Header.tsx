import {
  Bell,
  Menu,
  Moon,
  Search,
  Sun,
  UserRound,
  X,
} from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useForum } from '../../context/ForumContext'

const primaryLinks = [
  { to: '/', label: "What's New" },
  { to: '/forums', label: 'Forum Listing' },
  { to: '/members', label: 'Members' },
  { to: '/search', label: 'Advanced Search' },
]

export function Header() {
  const { currentUser, logout, unreadCount, state, toggleDarkMode, isMod } = useForum()
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
    <header className="border-b border-[var(--color-border)] bg-white dark:bg-[#1a222c] dark:border-[#2a3542]">
      <div className="bg-[linear-gradient(90deg,#0f4f7c,#1769a5_45%,#2a8bc7)] text-white">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <Link to="/" className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 rounded bg-white/15 flex items-center justify-center font-bold text-lg shrink-0">
              MCW
            </div>
            <div className="min-w-0">
              <div className="font-bold text-lg leading-tight truncate">MCW Casino Forum</div>
              <div className="text-xs text-white/80 truncate">Community for players & enthusiasts</div>
            </div>
          </Link>
          <form onSubmit={onSearch} className="hidden md:flex items-center gap-2 flex-1 max-w-md ml-6">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/70" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search the entire site"
                className="w-full rounded pl-9 pr-3 py-2 text-sm text-[var(--color-ink)] bg-white"
              />
            </div>
            <button type="submit" className="btn bg-white/15 text-white border border-white/30 hover:bg-white/25">
              Search
            </button>
          </form>
          <button
            type="button"
            className="md:hidden btn bg-white/15 text-white border border-white/30"
            onClick={() => setOpen((v) => !v)}
            aria-label="Menu"
          >
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-2 flex flex-wrap items-center justify-between gap-2">
        <nav className="hidden md:flex flex-wrap items-center gap-1 text-sm">
          {primaryLinks.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              className={({ isActive }) =>
                `px-2.5 py-1.5 rounded hover:bg-[var(--color-brand-soft)] dark:hover:bg-[#243040] ${
                  isActive ? 'text-[var(--color-brand)] font-semibold' : 'prose-muted'
                }`
              }
              end={l.to === '/'}
            >
              {l.label}
            </NavLink>
          ))}
          {isMod && (
            <NavLink
              to="/moderation"
              className={({ isActive }) =>
                `px-2.5 py-1.5 rounded hover:bg-[var(--color-brand-soft)] ${
                  isActive ? 'text-[var(--color-brand)] font-semibold' : 'prose-muted'
                }`
              }
            >
              Moderation
            </NavLink>
          )}
        </nav>

        <div className="flex items-center gap-2 ml-auto">
          <button type="button" className="btn btn-secondary" onClick={toggleDarkMode} aria-label="Toggle theme">
            {state.darkMode ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          {currentUser ? (
            <>
              <Link to="/notifications" className="btn btn-secondary relative">
                <Bell size={16} />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-[var(--color-danger)] text-white text-[10px] flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </Link>
              <Link to="/create" className="btn btn-primary">
                Create thread
              </Link>
              <Link to={`/profile/${currentUser.username}`} className="btn btn-secondary">
                <UserRound size={16} /> {currentUser.username}
              </Link>
              <button type="button" className="btn btn-secondary" onClick={logout}>
                Log out
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="btn btn-secondary">
                Log in
              </Link>
              <Link to="/register" className="btn btn-primary">
                Sign up
              </Link>
            </>
          )}
        </div>
      </div>

      {open && (
        <div className="md:hidden border-t border-[var(--color-border)] px-4 py-3 space-y-2">
          <form onSubmit={onSearch} className="flex gap-2">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search..."
              className="input"
            />
            <button type="submit" className="btn btn-primary">
              Go
            </button>
          </form>
          {primaryLinks.map((l) => (
            <Link key={l.to} to={l.to} className="block py-1.5" onClick={() => setOpen(false)}>
              {l.label}
            </Link>
          ))}
          {isMod && (
            <Link to="/moderation" className="block py-1.5" onClick={() => setOpen(false)}>
              Moderation
            </Link>
          )}
        </div>
      )}
    </header>
  )
}
