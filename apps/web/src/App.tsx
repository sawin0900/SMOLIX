import { Navigate, Route, Routes } from 'react-router-dom'
import Landing from './pages/Landing'
import AuthPage from './pages/AuthPage'
import AppCabinet from './pages/AppCabinet'
import AdminPanel from './pages/AdminPanel'
import LegalPage from './pages/LegalPage'
import InstallPage from './pages/InstallPage'
import StatusPage from './pages/StatusPage'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/install" element={<InstallPage />} />
      <Route path="/status" element={<StatusPage />} />
      <Route path="/auth" element={<AuthPage />} />
      <Route path="/app/*" element={<AppCabinet />} />
      <Route path="/admin" element={<AdminPanel />} />
      <Route path="/privacy" element={<Navigate to="/policy" replace />} />
      <Route path="/terms" element={<Navigate to="/oferta" replace />} />
      <Route path="/legal/privacy" element={<Navigate to="/policy" replace />} />
      <Route path="/legal/terms" element={<Navigate to="/oferta" replace />} />
      <Route path="/oferta" element={<LegalPage />} />
      <Route path="/policy" element={<LegalPage />} />
      <Route path="/legal/:doc" element={<LegalPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
