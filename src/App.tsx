import { Navigate, Route, Routes } from 'react-router-dom'
import AppLayout from './layouts/AppLayout'
import AcceptInvitationPage from './pages/AcceptInvitationPage'
import ComingSoonPage from './pages/ComingSoonPage'
import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import OperationalDashboardPage from './pages/OperationalDashboardPage'
import AdminWorkspacePage from './pages/admin/AdminWorkspacePage'
import RequirementIntakePage from './pages/RequirementIntakePage'
import AdminRoute from './routes/AdminRoute'
import ProtectedRoute from './routes/ProtectedRoute'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/accept-invitation" element={<AcceptInvitationPage />} />
      <Route path="/requirement-form/:token" element={<RequirementIntakePage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/app" element={<Navigate to="/app/dashboard" replace />} />
          <Route path="/app/dashboard" element={<OperationalDashboardPage />} />

          <Route element={<AdminRoute />}>
            <Route path="/app/admin" element={<Navigate to="/app/admin/customers" replace />} />
            <Route path="/app/admin/:module" element={<AdminWorkspacePage />} />
          </Route>

          <Route path="/app/:section" element={<ComingSoonPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
