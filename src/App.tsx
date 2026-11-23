
import { Navigate, Route, Routes } from 'react-router-dom'

import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import CustomersPage from './pages/admin/CustomersPage'
import ComingSoonPage from './pages/ComingSoonPage'

import ProtectedRoute from './routes/ProtectedRoute'
import AdminRoute from './routes/AdminRoute'
import AppLayout from './layouts/AppLayout'

import UsersPage from './pages/admin/UsersPage'
import JobProfilesPage from './pages/admin/JobProfilesPage'
import AdminCatalogPage from './pages/admin/AdminCatalogPage'

export default function App() {
  return (
    <Routes>

      {/* Public pages */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />

      {/* Authenticated application */}
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>

          <Route
            path="/app"
            element={<Navigate to="/app/dashboard" replace />}
          />

          <Route
            path="/app/dashboard"
            element={<DashboardPage />}
          />

          {/* Admin-only pages */}
          <Route element={<AdminRoute />}>
            <Route
              path="/app/customers"
              element={<CustomersPage />}
            />
            <Route
              path="/app/users"
              element={<UsersPage />}
            />
            <Route
              path="/app/job-profiles"
              element={<JobProfilesPage />}
            />
            <Route
            path="/app/skills"
            element={<AdminCatalogPage key="skills" />}
            />
            <Route
            path="/app/service-types"
            element={<AdminCatalogPage key="service-types" />}
            />
            <Route
              path="/app/catalog"
              element={<AdminCatalogPage />}
            />
          </Route>

          {/* Temporary pages for modules not implemented yet */}
          <Route
            path="/app/:section"
            element={<ComingSoonPage />}
          />

        </Route>
      </Route>

      {/* Unknown URLs */}
      <Route path="*" element={<Navigate to="/" replace />} />

    </Routes>
  )
}