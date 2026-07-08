import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-soc-bg dark:bg-soc-darkbg">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-soc-accent border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-soc-stext/50 dark:text-soc-darkstext/50">Authenticating...</span>
        </div>
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />

  return children
}
