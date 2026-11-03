import { lazy } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/layout/Layout'
import { ToastProvider } from './components/Toast'
import { ForumProvider } from './context/ForumContext'
import { LocaleProvider, detectLangFromPath, type Lang } from './i18n/locale'

const Home = lazy(() => import('./pages/Home').then((m) => ({ default: m.Home })))
const Communities = lazy(() => import('./pages/Communities').then((m) => ({ default: m.Communities })))
const CommunityDetail = lazy(() =>
  import('./pages/CommunityDetail').then((m) => ({ default: m.CommunityDetail })),
)
const ThreadDetail = lazy(() =>
  import('./pages/ThreadDetail').then((m) => ({ default: m.ThreadDetail })),
)
const Members = lazy(() => import('./pages/Members').then((m) => ({ default: m.Members })))
const Profile = lazy(() => import('./pages/Profile').then((m) => ({ default: m.Profile })))
const Search = lazy(() => import('./pages/Search').then((m) => ({ default: m.Search })))
const Notifications = lazy(() =>
  import('./pages/Notifications').then((m) => ({ default: m.Notifications })),
)
const Login = lazy(() => import('./pages/Login').then((m) => ({ default: m.Login })))
const Register = lazy(() => import('./pages/Register').then((m) => ({ default: m.Register })))
const ResetPassword = lazy(() =>
  import('./pages/ResetPassword').then((m) => ({ default: m.ResetPassword })),
)
const VerifyEmail = lazy(() =>
  import('./pages/VerifyEmail').then((m) => ({ default: m.VerifyEmail })),
)
const CreateThread = lazy(() =>
  import('./pages/CreateThread').then((m) => ({ default: m.CreateThread })),
)
const Admin = lazy(() => import('./pages/Admin').then((m) => ({ default: m.Admin })))

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
    // useTransitions={false}: RR7 wraps nav in startTransition by default, which
    // keeps the previous lazy page painted until the next chunk resolves — feels
    // like clicks do nothing. Eager commit so Suspense fallback can show.
    <BrowserRouter key={lang} basename={basename} useTransitions={false}>
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
