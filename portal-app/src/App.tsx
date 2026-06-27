import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { AppLayout } from './components/AppLayout'
import { ProtectedRoute, PublicOnlyRoute } from './components/ProtectedRoute'
import { SpaRedirect } from './components/SpaRedirect'
import { HomePage } from './pages/HomePage'
import { LoginPage } from './pages/LoginPage'
import { LegacyPage } from './pages/LegacyPage'
import { MobileModulesPage } from './pages/MobileModulesPage'
import { isNativeApp } from './lib/portal-origin'

function IndexPage() {
  return isNativeApp() ? <MobileModulesPage /> : <HomePage />
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter basename="/app">
        <SpaRedirect />
        <Routes>
          <Route element={<PublicOnlyRoute />}>
            <Route path="/login" element={<LoginPage />} />
          </Route>

          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route index element={<IndexPage />} />
              <Route path="/modulos" element={<Navigate to="/" replace />} />
              <Route path="/legado/*" element={<LegacyPage />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
