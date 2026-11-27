// import { Navigate, Route, Routes } from 'react-router-dom'
// import AppLayout from './layouts/AppLayout'
// import AcceptInvitationPage from './pages/AcceptInvitationPage'
// import ComingSoonPage from './pages/ComingSoonPage'
// import LandingPage from './pages/LandingPage'
// import LoginPage from './pages/LoginPage'
// import OperationalDashboardPage from './pages/OperationalDashboardPage'
// import AdminWorkspacePage from './pages/admin/AdminWorkspacePage'
// import AdminAgreementReviewPage from './pages/admin/AdminAgreementReviewPage'
// import CustomerAgreementsPage from './pages/CustomerAgreementsPage'
// import RecruiterWorkspacePage from './pages/RecruiterWorkspacePage'
// import CustomerCandidatesPage from './pages/CustomerCandidatesPage'
// import RequirementIntakePage from './pages/RequirementIntakePage'
// import AdminRoute from './routes/AdminRoute'
// import ProtectedRoute from './routes/ProtectedRoute'
// import CustomerRoute from './routes/CustomerRoute'

// export default function App() {
//   return (
//     <Routes>
//       <Route path="/" element={<LandingPage />} />
//       <Route path="/login" element={<LoginPage />} />
//       <Route path="/accept-invitation" element={<AcceptInvitationPage />} />
//       <Route path="/requirement-form/:token" element={<RequirementIntakePage />} />

//       <Route element={<ProtectedRoute />}>
//         <Route element={<AppLayout />}>
//           <Route path="/app" element={<Navigate to="/app/dashboard" replace />} />
//           <Route path="/app/dashboard" element={<OperationalDashboardPage />} />

//           <Route element={<AdminRoute />}>
//             <Route path="/app/admin" element={<Navigate to="/app/admin/customers" replace />} />
//             <Route path="/app/admin/:module" element={<AdminWorkspacePage />} />
//             <Route path="/app/admin/agreements/:agreementId/review" element={<AdminAgreementReviewPage />} />
//           </Route>

//           <Route element={<CustomerRoute />}>
//             <Route path="/app/agreements" element={<CustomerAgreementsPage />} />
//             <Route path="/app/candidates" element={<CustomerCandidatesPage />} />
//             <Route path="/app/job-profiles" element={<CustomerJobProfilesPage />} />
//             <Route path="/app/my-requirements" element={<CustomerRequirementsPage />} />
//             <Route path="/app/recruiters" element={<CustomerRecruitersPage />} />
//             <Route path="/app/invoices" element={<CustomerInvoicesPage />} />
//           </Route>

//           <Route path="/app/assigned-requirements" element={<RecruiterWorkspacePage />} />

//           <Route path="/app/:section" element={<ComingSoonPage />} />
//         </Route>
//       </Route>

//       <Route path="*" element={<Navigate to="/" replace />} />
//     </Routes>
//   )
// }

import { Navigate, Route, Routes } from 'react-router-dom'
import AppLayout from './layouts/AppLayout'
import AcceptInvitationPage from './pages/AcceptInvitationPage'
import ComingSoonPage from './pages/ComingSoonPage'
import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import OperationalDashboardPage from './pages/OperationalDashboardPage'
import AdminWorkspacePage from './pages/admin/AdminWorkspacePage'
import AdminAgreementReviewPage from './pages/admin/AdminAgreementReviewPage'
import AdminCandidatesPage from './pages/admin/AdminCandidatesPage'
import AdminCreateInvoicePage from './pages/admin/AdminCreateInvoicePage'
import AdminInvoicesPage from './pages/admin/AdminInvoicesPage'
import AdminOffersPage from './pages/admin/AdminOffersPage'
import CustomerAgreementsPage from './pages/CustomerAgreementsPage'
import RecruiterWorkspacePage from './pages/RecruiterWorkspacePage'
import RecruiterCandidatesPage from './pages/RecruiterCandidatesPage'
import RecruiterApplicationsPage from './pages/RecruiterApplicationsPage'
import RecruiterInterviewsPage from './pages/RecruiterInterviewsPage'
import CustomerCandidatesPage from './pages/CustomerCandidatesPage'
import CustomerJobProfilesPage from './pages/CustomerJobProfilesPage'
import CustomerRequirementsPage from './pages/CustomerRequirementsPage'
import CustomerRecruitersPage from './pages/CustomerRecruitersPage'
import CustomerInterviewsPage from './pages/CustomerInterviewsPage'
import CustomerInvoicesPage from './pages/CustomerInvoicesPage'
import CandidateDashboardPage from './pages/CandidateDashboardPage'
import CandidateResumePage from './pages/CandidateResumePage'
import CandidateProfilePage from './pages/CandidateProfilePage'
import CandidateApplicationsPage from './pages/CandidateApplicationsPage'
import CandidateOffersPage from './pages/CandidateOffersPage'
import CandidateRequirementsPage from './pages/CandidateRequirementsPage'
import RequirementIntakePage from './pages/RequirementIntakePage'
import CandidateRoute from './routes/CandidateRoute'
import { useAuth } from './context/AuthContext'
import AdminRoute from './routes/AdminRoute'
import ProtectedRoute from './routes/ProtectedRoute'
import CustomerRoute from './routes/CustomerRoute'
import RecruiterRoute from './routes/RecruiterRoute'

function RoleDashboardPage() {
  const { user } = useAuth()
  return user?.role === 'CANDIDATE' ? <CandidateDashboardPage /> : <OperationalDashboardPage />
}

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
          <Route path="/app/dashboard" element={<RoleDashboardPage />} />

          <Route element={<AdminRoute />}>
            <Route path="/app/admin" element={<Navigate to="/app/admin/customers" replace />} />
            <Route path="/app/admin/candidates" element={<AdminCandidatesPage />} />
            <Route path="/app/admin/create-invoice" element={<AdminCreateInvoicePage />} />
            <Route path="/app/admin/invoices" element={<AdminInvoicesPage />} />
            <Route path="/app/admin/offers" element={<AdminOffersPage />} />
            <Route path="/app/admin/:module" element={<AdminWorkspacePage />} />
            <Route path="/app/admin/agreements/:agreementId/review" element={<AdminAgreementReviewPage />} />
          </Route>

          <Route element={<CustomerRoute />}>
            <Route path="/app/agreements" element={<CustomerAgreementsPage />} />
            <Route path="/app/candidates" element={<CustomerCandidatesPage />} />
            <Route path="/app/job-profiles" element={<CustomerJobProfilesPage />} />
            <Route path="/app/my-requirements" element={<CustomerRequirementsPage />} />
            <Route path="/app/recruiters" element={<CustomerRecruitersPage />} />
            <Route path="/app/interviews" element={<CustomerInterviewsPage />} />
            <Route path="/app/invoices" element={<CustomerInvoicesPage />} />
          </Route>

          <Route element={<RecruiterRoute />}>
            <Route path="/app/assigned-requirements" element={<RecruiterWorkspacePage />} />
            <Route path="/app/recruiter/candidates" element={<RecruiterCandidatesPage />} />
            <Route path="/app/recruiter/applications" element={<RecruiterApplicationsPage />} />
            <Route path="/app/recruiter/interviews" element={<RecruiterInterviewsPage />} />
          </Route>
          <Route element={<CandidateRoute />}>
            <Route path="/app/candidate/profile" element={<CandidateProfilePage />} />
            <Route path="/app/candidate/resume" element={<CandidateResumePage />} />
            <Route path="/app/candidate/requirements" element={<CandidateRequirementsPage />} />
            <Route path="/app/candidate/applications" element={<CandidateApplicationsPage />} />
            <Route path="/app/candidate/offers" element={<CandidateOffersPage />} />
          </Route>

          <Route path="/app/:section" element={<ComingSoonPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
