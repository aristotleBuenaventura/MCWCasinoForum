import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/layout/Layout'
import { ToastProvider } from './components/Toast'
import { ForumProvider } from './context/ForumContext'
import { CreateThread } from './pages/CreateThread'
import { Forums } from './pages/Forums'
import { Home } from './pages/Home'
import { Login } from './pages/Login'
import { Members } from './pages/Members'
import { Moderation } from './pages/Moderation'
import { Notifications } from './pages/Notifications'
import { Profile } from './pages/Profile'
import { Register } from './pages/Register'
import { Search } from './pages/Search'
import { ThreadDetail } from './pages/ThreadDetail'

export default function App() {
  return (
    <ForumProvider>
      <ToastProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<Home />} />
              <Route path="forums" element={<Forums />} />
              <Route path="thread/:id" element={<ThreadDetail />} />
              <Route path="members" element={<Members />} />
              <Route path="profile/:username" element={<Profile />} />
              <Route path="search" element={<Search />} />
              <Route path="notifications" element={<Notifications />} />
              <Route path="moderation" element={<Moderation />} />
            </Route>
            <Route element={<Layout showSidebar={false} />}>
              <Route path="login" element={<Login />} />
              <Route path="register" element={<Register />} />
              <Route path="create" element={<CreateThread />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </ForumProvider>
  )
}
