import { Link } from 'react-router-dom'

export function Footer() {
  return (
    <footer className="site-footer mt-8">
      <div className="w-full px-4 py-8 grid sm:grid-cols-2 lg:grid-cols-6 gap-6 text-[13px]">
        <div className="lg:col-span-2">
          <div className="flex items-center gap-2">
            <img src="/assets/hero-crest.jpg" alt="" className="h-8 w-8 rounded object-cover" />
            <div>
              <div className="font-extrabold gold-text tracking-wide">MCW FORUM</div>
              <div className="text-[11px] prose-muted">The ultimate hub for casino players.</div>
            </div>
          </div>
          <div className="flex gap-3 mt-3 text-[11px] prose-muted">
            <span>Facebook</span>
            <span>X</span>
            <span>Instagram</span>
            <span>YouTube</span>
          </div>
        </div>
        <div>
          <div className="section-title mb-2">About Us</div>
          <div className="space-y-1.5 prose-muted">
            <div>Company</div>
            <div>Press</div>
            <Link to="/communities/guides" className="block hover:text-[var(--color-gold)]">Guides</Link>
            <div>Blog</div>
          </div>
        </div>
        <div>
          <div className="section-title mb-2">Explore</div>
          <div className="space-y-1.5 prose-muted">
            <Link to="/communities" className="block hover:text-[var(--color-gold)]">Communities</Link>
            <Link to="/communities/slot-games" className="block hover:text-[var(--color-gold)]">Games</Link>
            <Link to="/communities/casino-reviews" className="block hover:text-[var(--color-gold)]">Reviews</Link>
            <Link to="/members" className="block hover:text-[var(--color-gold)]">Leaderboards</Link>
          </div>
        </div>
        <div>
          <div className="section-title mb-2">Support</div>
          <div className="space-y-1.5 prose-muted">
            <div>FAQ</div>
            <div>Contact Us</div>
            <div>Help Center</div>
          </div>
        </div>
        <div>
          <div className="section-title mb-2">Legal</div>
          <div className="space-y-1.5 prose-muted">
            <div>Terms of Service</div>
            <div>Privacy Policy</div>
            <div>Cookie Settings</div>
            <div className="pt-2 text-[var(--color-gold)]">18+ · Play responsibly</div>
          </div>
        </div>
      </div>
      <div className="w-full px-4 pb-5 flex flex-wrap items-center justify-between gap-2 text-[11px] prose-muted">
        <span>© {new Date().getFullYear()} MCW FORUM. All rights reserved.</span>
        <span>Responsible Gambling · Please play responsibly.</span>
      </div>
    </footer>
  )
}
