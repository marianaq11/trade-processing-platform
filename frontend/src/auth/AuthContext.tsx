import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { ApiError, apiGet, apiPost, postLogin, setUnauthorizedHandler } from '../api/client.ts'
import type { CurrentUser } from '../api/types.ts'

interface AuthState {
  user: CurrentUser | null
  login: (username: string, password: string) => Promise<boolean>
  logout: () => Promise<void>
}

export const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null)
  const [checked, setChecked] = useState(false)
  const navigate = useNavigate()

  // Calling /me on startup also gets us the CSRF cookie, which the login request needs.
  useEffect(() => {
    apiGet<CurrentUser>('/api/auth/me')
      .then(setUser)
      .catch((e) => {
        if (!(e instanceof ApiError && e.status === 401)) console.error(e)
      })
      .finally(() => setChecked(true))
    setUnauthorizedHandler(() => setUser(null))
  }, [])

  const login = useCallback(async (username: string, password: string) => {
    if (!(await postLogin(username, password))) return false
    setUser(await apiGet<CurrentUser>('/api/auth/me'))
    return true
  }, [])

  // Go back to "/" so the next person to sign in starts on their own home page, not a page
  // for the previous user's role. An expired session keeps its URL instead.
  const logout = useCallback(async () => {
    await apiPost('/api/auth/logout').catch(() => {})
    setUser(null)
    navigate('/', { replace: true })
  }, [navigate])

  if (!checked) return null

  return <AuthContext.Provider value={{ user, login, logout }}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const auth = useContext(AuthContext)
  if (!auth) throw new Error('useAuth must be used inside AuthProvider')
  return auth
}

// Only for components rendered after login.
export function useCurrentUser(): CurrentUser {
  const { user } = useAuth()
  if (!user) throw new Error('No logged-in user')
  return user
}
