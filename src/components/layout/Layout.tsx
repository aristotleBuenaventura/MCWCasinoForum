import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { useLocale } from '../../i18n/locale'
import { LoginModal } from '../LoginModal'
import { Footer } from './Footer'
import { Header } from './Header'
import { LeftRail } from './LeftRail'
import { RightRail } from './RightRail'

export function Layout({ rails = 'none' }: { rails?: 'none' | 'left' | 'both' }) {
  const { lang } = useLocale()

  useEffect(() => {
    document.documentElement.lang = lang === 'bn' ? 'bn' : 'en'
  }, [lang])

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <LoginModal />
      <main className="flex-1 w-full px-2 lg:px-3 py-3">
        {rails === 'both' && (
          <div className="grid grid-cols-1 lg:grid-cols-[240px_minmax(0,1fr)_300px] gap-3">
            <div className="hidden lg:block min-w-0"><LeftRail /></div>
            <div className="min-w-0"><Outlet /></div>
            <div className="hidden lg:block min-w-0"><RightRail /></div>
          </div>
        )}
        {rails === 'left' && (
          <div className="grid grid-cols-1 lg:grid-cols-[240px_minmax(0,1fr)] gap-3">
            <div className="hidden lg:block min-w-0"><LeftRail /></div>
            <div className="min-w-0"><Outlet /></div>
          </div>
        )}
        {rails === 'none' && <Outlet />}
      </main>
      <Footer />
    </div>
  )
}
