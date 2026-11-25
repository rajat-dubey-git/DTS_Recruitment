import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function CandidateRoute() {
  const { user } = useAuth()

  if (!user) return <Navigate to="/login" replace />
  if (user.role !== 'CANDIDATE') return <Navigate to="/app/dashboard" replace />

  return <Outlet />
}
