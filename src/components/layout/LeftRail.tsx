import {
  Bookmark,
  Flame,
  Home,
  Layers,
  Shield,
  Sparkles,
  Spade,
  TrendingUp,
  Trophy,
} from 'lucide-react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { AdRotator } from '../AdRotator'

const feedItems = [
  { to: '/', feed: '', label: 'Home', icon: Home },
  { to: '/?feed=popular', feed: 'popular', label: 'Popular', icon: Flame },
  { to: '/?feed=trending', feed: 'trending', label: 'Trending', icon: TrendingUp },
  { to: '/?feed=latest', feed: 'latest', label: 'Latest', icon: Sparkles },
  { to: '/?feed=saved', feed: 'saved', label: 'Saved', icon: Bookmark },
]

const communities = [
  { to: '/communities/slot-games', label: 'Slot Games', icon: Spade },
  { to: '/communities/casino-reviews', label: 'Casino Reviews', icon: Trophy },
  { to: '/communities/game-providers', label: 'Game Providers', icon: Layers },
  { to: '/communities/bonuses', label: 'Bonuses', icon: Sparkles },
  { to: '/communities/rtp-volatility', label: 'RTP & Volatility', icon: TrendingUp },
  { to: '/communities/responsible-gambling', label: 'Responsible Gambling', icon: Shield },
]

export function LeftRail() {
  const [params] = useSearchParams()
  const location = useLocation()
  const feed = params.get('feed') || ''
  const onHome = location.pathname === '/'

  return (
    <aside className="space-y-3">
      <nav className="forum-card p-2">
        {feedItems.map((item) => {
          const Icon = item.icon
          const active = onHome && feed === item.feed
          return (
            <Link key={item.label} to={item.to} className={`side-link ${active ? 'active' : ''}`}>
              <Icon size={14} />
              {item.label}
            </Link>
          )
        })}
        <div className="h-px bg-[var(--color-border)] my-2" />
        <div className="section-title px-2 py-1.5">Communities</div>
        {communities.map((item) => {
          const Icon = item.icon
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`side-link ${location.pathname === item.to ? 'active' : ''}`}
            >
              <Icon size={14} />
              {item.label}
            </Link>
          )
        })}
        <Link to="/communities" className="block text-center text-[11px] gold-text py-2 hover:underline">
          View all
        </Link>
      </nav>
      <AdRotator slot="left-1" heightClass="h-56" />
      <AdRotator slot="left-2" heightClass="h-36" />
      <AdRotator slot="left-3" heightClass="h-56" />
    </aside>
  )
}
