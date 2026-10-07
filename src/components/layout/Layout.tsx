import { Outlet } from 'react-router-dom'
import { Footer } from './Footer'
import { Header } from './Header'
import { Sidebar } from './Sidebar'

export function Layout({ showSidebar = true }: { showSidebar?: boolean }) {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-5">
        {showSidebar ? (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-5">
            <div className="min-w-0">
              <Outlet />
            </div>
            <div className="min-w-0">
              <Sidebar />
            </div>
          </div>
        ) : (
          <Outlet />
        )}
      </main>
      <Footer />
    </div>
  )
}
