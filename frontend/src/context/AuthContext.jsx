import { createContext, useContext, useState, useCallback } from 'react'
import { authApi } from '../api/index.js'

const AuthContext = createContext(null)

export function AuthProvider ({ children }) {
  const [user, setUser]   = useState(() => {
    try { return JSON.parse(localStorage.getItem('sda_user')) } catch { return null }
  })
  const [token, setToken] = useState(() => localStorage.getItem('sda_token'))

  const login = useCallback(async (sapCode, password) => {
    const data = await authApi.login(sapCode, password)
    localStorage.setItem('sda_token', data.token)
    localStorage.setItem('sda_user', JSON.stringify(data.customer))
    setToken(data.token)
    setUser(data.customer)
    return data
  }, [])

  const logout = useCallback(async () => {
    try { await authApi.logout() } catch {}
    localStorage.removeItem('sda_token')
    localStorage.removeItem('sda_user')
    setToken(null)
    setUser(null)
  }, [])

  const isAdmin    = user?.role === 'ADMIN'
  const isPremium  = user?.profile === 'PREMIUM' || user?.profile === 'VIP'
  const isVip      = user?.profile === 'VIP'

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isAdmin, isPremium, isVip, isAuthenticated: !!token }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth () {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
