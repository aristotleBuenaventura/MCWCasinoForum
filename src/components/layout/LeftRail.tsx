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
import { useLocale } from '../../i18n/locale'
import { AdRotator } from '../AdRotator'

export function LeftRail() {
  const [params] = useSearchParams()
  const location = useLocation()
  const { t } = useLocale()
  const feed = params.get('feed') || ''
  const onHome = location.pathname === '/'

  const feedItems = [
    { to: '/', feed: '', label: t('nav.home'), icon: Home },
    { to: '/?feed=popular', feed: 'popular', label: t('rail.popular'), icon: Flame },
    { to: '/?feed=trending', feed: 'trending', label: t('rail.trending'), icon: TrendingUp },
    { to: '/?feed=latest', feed: 'latest', label: t('rail.latest'), icon: Sparkles },
    { to: '/?feed=saved', feed: 'saved', label: t('rail.saved'), icon: Bookmark },
  ]

  const communities = [
    { to: '/communities/slot-games', label: t('rail.slotGames'), icon: Spade },
    { to: '/communities/casino-reviews', label: t('rail.casinoReviews'), icon: Trophy },
    { to: '/communities/game-providers', label: t('rail.gameProviders'), icon: Layers },
    { to: '/communities/bonuses', label: t('rail.bonuses'), icon: Sparkles },
    { to: '/communities/rtp-volatility', label: t('rail.rtp'), icon: TrendingUp },
    { to: '/communities/responsible-gambling', label: t('rail.responsible'), icon: Shield },
  ]

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
        <div className="section-title px-2 py-1.5">{t('rail.communities')}</div>
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
          {t('rail.viewAll')}
        </Link>
      </nav>
      <AdRotator slot="left-1" heightClass="aspect-[9/16] h-auto" />
      <AdRotator slot="left-2" heightClass="aspect-[9/16] h-auto" />
      <AdRotator slot="left-3" heightClass="aspect-[9/16] h-auto" />
    </aside>
  )
}
