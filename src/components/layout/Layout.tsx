import { Outlet } from 'react-router-dom'
import { Footer } from './Footer'
import { Header } from './Header'
import { LeftRail } from './LeftRail'
import { RightRail } from './RightRail'

export function Layout({ rails = 'none' }: { rails?: 'none' | 'left' | 'both' }) {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 max-w-[1360px] w-full mx-auto px-3 py-3">
        {rails === 'both' && (
          <div className="grid grid-cols-1 lg:grid-cols-[196px_minmax(0,1fr)_248px] gap-3">
            <div className="hidden lg:block"><LeftRail /></div>
            <div className="min-w-0"><Outlet /></div>
            <div className="hidden lg:block"><RightRail /></div>
          </div>
        )}
        {rails === 'left' && (
          <div className="grid grid-cols-1 lg:grid-cols-[196px_minmax(0,1fr)] gap-3">
            <div className="hidden lg:block"><LeftRail /></div>
            <div className="min-w-0"><Outlet /></div>
          </div>
        )}
        {rails === 'none' && <Outlet />}
      </main>
      <Footer />
    </div>
  )
}
