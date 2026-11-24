import { Navigate, Route, Routes } from 'react-router-dom'
import AppLayout from './layouts/AppLayout'
import AcceptInvitationPage from './pages/AcceptInvitationPage'
import ComingSoonPage from './pages/ComingSoonPage'
import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import OperationalDashboardPage from './pages/OperationalDashboardPage'
import AdminWorkspacePage from './pages/admin/AdminWorkspacePage'
import AdminAgreementReviewPage from './pages/admin/AdminAgreementReviewPage'
import CustomerAgreementsPage from './pages/CustomerAgreementsPage'
import RecruiterWorkspacePage from './pages/RecruiterWorkspacePage'
import CustomerCandidatesPage from './pages/CustomerCandidatesPage'
import RequirementIntakePage from './pages/RequirementIntakePage'
import AdminRoute from './routes/AdminRoute'
import ProtectedRoute from './routes/ProtectedRoute'
import CustomerRoute from './routes/CustomerRoute'

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
            <Route path="/app/admin/agreements/:agreementId/review" element={<AdminAgreementReviewPage />} />
          </Route>

          <Route element={<CustomerRoute />}>
            <Route path="/app/agreements" element={<CustomerAgreementsPage />} />
            <Route path="/app/candidates" element={<CustomerCandidatesPage />} />
          </Route>

          <Route path="/app/assigned-requirements" element={<RecruiterWorkspacePage />} />

          <Route path="/app/:section" element={<ComingSoonPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
