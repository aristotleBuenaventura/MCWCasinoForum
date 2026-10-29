import { Link } from 'react-router-dom'

export function Footer() {
  return (
    <footer className="mt-10 border-t border-[var(--color-border)] bg-[#0b0d14]">
      <div className="max-w-[1440px] mx-auto px-4 py-10 grid sm:grid-cols-2 lg:grid-cols-5 gap-8 text-sm">
        <div className="lg:col-span-1">
          <div className="font-bold gold-text text-lg">MCW FORUM</div>
          <p className="prose-muted mt-2 text-xs leading-relaxed">
            The ultimate hub for casino players. Discuss, review, and share strategies.
          </p>
        </div>
        <div>
          <div className="section-title mb-3">About Us</div>
          <div className="space-y-1.5 prose-muted">
            <div>Company</div>
            <div>Press</div>
            <Link to="/communities/guides" className="block hover:text-[var(--color-gold)]">Guides</Link>
          </div>
        </div>
        <div>
          <div className="section-title mb-3">Explore</div>
          <div className="space-y-1.5 prose-muted">
            <Link to="/communities" className="block hover:text-[var(--color-gold)]">Communities</Link>
            <Link to="/communities/slot-games" className="block hover:text-[var(--color-gold)]">Games</Link>
            <Link to="/communities/casino-reviews" className="block hover:text-[var(--color-gold)]">Reviews</Link>
            <Link to="/members" className="block hover:text-[var(--color-gold)]">Leaderboards</Link>
          </div>
        </div>
        <div>
          <div className="section-title mb-3">Support</div>
          <div className="space-y-1.5 prose-muted">
            <div>FAQ</div>
            <div>Contact Us</div>
            <div>Help Center</div>
          </div>
        </div>
        <div>
          <div className="section-title mb-3">Legal</div>
          <div className="space-y-1.5 prose-muted">
            <div>Terms of Service</div>
            <div>Privacy Policy</div>
            <div>Cookie Settings</div>
            <div className="pt-2 text-[var(--color-gold)]">18+ · Play responsibly</div>
          </div>
        </div>
      </div>
      <div className="max-w-[1440px] mx-auto px-4 pb-6 text-xs prose-muted">
        © {new Date().getFullYear()} MCW FORUM. All rights reserved.
      </div>
    </footer>
  )
}
