import { Link } from 'react-router-dom'

export function Footer() {
  return (
    <footer className="mt-10 border-t border-[var(--color-border)] dark:border-[#2a3542] bg-white dark:bg-[#1a222c]">
      <div className="max-w-6xl mx-auto px-4 py-6 flex flex-wrap gap-x-4 gap-y-2 text-sm prose-muted">
        <Link to="/" className="hover:text-[var(--color-brand)]">
          Home
        </Link>
        <Link to="/forums" className="hover:text-[var(--color-brand)]">
          Forums
        </Link>
        <Link to="/members" className="hover:text-[var(--color-brand)]">
          Members
        </Link>
        <span>Terms of Use</span>
        <span>Privacy Policy</span>
        <span>Help</span>
      </div>
      <div className="max-w-6xl mx-auto px-4 pb-6 text-xs prose-muted">
        MCW Casino Forum — demo community inspired by classic forum layouts. Play responsibly.
      </div>
    </footer>
  )
}
