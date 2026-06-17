import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { api, apiPost } from '../api'

const AuthContext = createContext()

export function useAuth() { return useContext(AuthContext) }

const TOKEN_KEY = 'dashboard_token'

function storeToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

function getStoredToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showLogin, setShowLogin] = useState(false)

  const checkAuth = useCallback(async () => {
    const token = getStoredToken()
    if (!token) { setLoading(false); return }
    try {
      const data = await api('auth/me', {}, { headers: { Authorization: `Bearer ${token}` } })
      setUser(data.user)
    } catch { localStorage.removeItem(TOKEN_KEY); setUser(null) }
    setLoading(false)
  }, [])

  useEffect(() => { checkAuth() }, [checkAuth])

  const login = useCallback(async (username, password) => {
    try {
      const result = await apiPost('auth/login', { username, password })
      if (result.ok) {
        storeToken(result.token)
        setUser(result.user)
        setShowLogin(false)
      }
      return result
    } catch (e) {
      return { ok: false, error: e.message || 'Connection error' }
    }
  }, [])

  const logout = useCallback(() => {
    storeToken(null)
    setUser(null)
  }, [])

  const hasRole = useCallback((...roles) => {
    if (!user) return false
    return roles.includes(user.role)
  }, [user])

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, showLogin, setShowLogin, hasRole }}>
      {children}
    </AuthContext.Provider>
  )
}
