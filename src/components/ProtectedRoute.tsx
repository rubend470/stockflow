import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getFirstAccessiblePath, userCanAccessPath } from '../utils/menuPermissions'

export function ProtectedRoute() {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner" />
        <p>Cargando...</p>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (!userCanAccessPath(user, location.pathname)) {
    const fallback = getFirstAccessiblePath(user)
    if (location.pathname === fallback) {
      return (
        <div className="loading-screen">
          <p>No tienes permisos para acceder a ninguna sección. Contacta al administrador.</p>
        </div>
      )
    }
    return <Navigate to={fallback} replace />
  }

  return <Outlet />
}

export function PublicRoute() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner" />
        <p>Cargando...</p>
      </div>
    )
  }

  if (user) {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}
