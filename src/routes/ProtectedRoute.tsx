import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute() {
  const { user, isLoading, sessionError, refreshSession } = useAuth()

  if (isLoading) {
    return <div role="status" className="page-loading">Checking your session…</div>
  }

  if (sessionError) {
    return (
      <div role="alert" className="page-loading">
        <p>{sessionError}</p>
        <button type="button" className="btn btn-primary" onClick={() => void refreshSession()}>
          Retry
        </button>
      </div>
    )
  }

  return user ? <Outlet /> : <Navigate to="/login" replace />
}
