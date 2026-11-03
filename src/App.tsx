import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/layout/Layout'
import { ToastProvider } from './components/Toast'
import { ForumProvider } from './context/ForumContext'
import { LocaleProvider, detectLangFromPath, type Lang } from './i18n/locale'
import { Admin } from './pages/Admin'
import { Communities } from './pages/Communities'
import { CommunityDetail } from './pages/CommunityDetail'
import { CreateThread } from './pages/CreateThread'
import { Home } from './pages/Home'
import { Login } from './pages/Login'
import { Members } from './pages/Members'
import { Notifications } from './pages/Notifications'
import { Profile } from './pages/Profile'
import { Register } from './pages/Register'
import { ResetPassword } from './pages/ResetPassword'
import { Search } from './pages/Search'
import { ThreadDetail } from './pages/ThreadDetail'
import { VerifyEmail } from './pages/VerifyEmail'

function AppRoutes() {
  return (
    <Routes>
      <Route element={<Layout rails="both" />}>
        <Route index element={<Home />} />
        <Route path="communities" element={<Communities />} />
        <Route path="communities/:slug" element={<CommunityDetail />} />
        <Route path="thread/:id" element={<ThreadDetail />} />
        <Route path="members" element={<Members />} />
        <Route path="profile/:username" element={<Profile />} />
        <Route path="search" element={<Search />} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="login" element={<Login />} />
        <Route path="register" element={<Register />} />
        <Route path="reset" element={<ResetPassword />} />
        <Route path="verify-email" element={<VerifyEmail />} />
        <Route path="create" element={<CreateThread />} />
        <Route path="forums" element={<Navigate to="/communities" replace />} />
      </Route>
      <Route element={<Layout rails="none" />}>
        <Route path="admin" element={<Admin />} />
        <Route path="moderation" element={<Navigate to="/admin" replace />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

function LocalizedApp({ lang }: { lang: Lang }) {
  const basename = lang === 'bn' ? '/bn' : undefined
  return (
    <BrowserRouter key={lang} basename={basename}>
      <LocaleProvider lang={lang}>
        <ForumProvider>
          <ToastProvider>
            <AppRoutes />
          </ToastProvider>
        </ForumProvider>
      </LocaleProvider>
    </BrowserRouter>
  )
}

export default function App() {
  const lang = detectLangFromPath(window.location.pathname)
  return <LocalizedApp lang={lang} />
}
