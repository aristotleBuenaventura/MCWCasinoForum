import { ChevronRight } from 'lucide-react'
import { Link, NavLink } from 'react-router-dom'
import { useForum } from '../../context/ForumContext'
import { AdRotator } from '../AdRotator'

export function LeftRail() {
  const { topCategories, childCategories } = useForum()

  return (
    <aside className="space-y-4">
      <section className="forum-card p-3">
        <div className="section-title px-2 py-2">Communities</div>
        <nav className="space-y-0.5">
          {topCategories.map((c) => {
            const children = childCategories(c.id)
            return (
              <div key={c.id}>
                <NavLink
                  to={`/communities/${c.slug}`}
                  className={({ isActive }) =>
                    `flex items-center justify-between px-2 py-2 rounded-lg text-sm hover:bg-white/5 ${
                      isActive ? 'text-[var(--color-gold)] bg-white/5' : 'text-[#d7dbe6]'
                    }`
                  }
                >
                  <span>{c.name}</span>
                  {children.length > 0 && <ChevronRight size={14} className="opacity-50" />}
                </NavLink>
                {children.length > 0 && (
                  <div className="ml-3 mb-1">
                    {children.map((child) => (
                      <NavLink
                        key={child.id}
                        to={`/communities/${child.slug}`}
                        className={({ isActive }) =>
                          `block px-2 py-1.5 rounded-md text-xs hover:bg-white/5 ${
                            isActive ? 'text-[var(--color-gold)]' : 'prose-muted'
                          }`
                        }
                      >
                        {child.name}
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </nav>
        <Link to="/communities" className="block text-center text-xs gold-text mt-2 py-2 hover:underline">
          View all communities
        </Link>
      </section>
      <AdRotator slot="left-1" />
      <AdRotator slot="left-2" />
      <AdRotator slot="left-3" />
    </aside>
  )
}
