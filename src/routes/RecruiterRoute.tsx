import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function RecruiterRoute() {
  const { user } = useAuth()

  if (!user) return <Navigate to="/login" replace />
  if (user.role !== 'RECRUITER' && user.role !== 'ADMIN') {
    return <Navigate to="/app/dashboard" replace />
  }

  return <Outlet />
}
