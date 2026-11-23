import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { authApi, isUnauthorized } from '../api/auth'
import type { AuthUser } from '../api/auth'

type AuthContextValue = {
  user: AuthUser | null
  isLoading: boolean
  sessionError: string | null
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  refreshSession: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [sessionError, setSessionError] = useState<string | null>(null)
  const sessionRequestId = useRef(0)

  const refreshSession = useCallback(async () => {
    const requestId = ++sessionRequestId.current
    setIsLoading(true)
    setSessionError(null)

    try {
      const currentUser = await authApi.me()
      if (requestId === sessionRequestId.current) {
        setUser(currentUser)
      }
    } catch (error) {
      if (requestId !== sessionRequestId.current) return

      setUser(null)
      if (!isUnauthorized(error)) {
        setSessionError(
          error instanceof Error ? error.message : 'Unable to verify your session.',
        )
      }
    } finally {
      if (requestId === sessionRequestId.current) {
        setIsLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    void refreshSession()
  }, [refreshSession])

  const login = useCallback(async (email: string, password: string) => {
    const requestId = ++sessionRequestId.current
    try {
      const signedInUser = await authApi.login(email, password)
      if (requestId === sessionRequestId.current) {
        setUser(signedInUser)
        setSessionError(null)
      }
    } finally {
      if (requestId === sessionRequestId.current) {
        setIsLoading(false)
      }
    }
  }, [])

  const logout = useCallback(async () => {
    await authApi.logout()
    sessionRequestId.current += 1
    setUser(null)
    setSessionError(null)
    setIsLoading(false)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({ user, isLoading, sessionError, login, logout, refreshSession }),
    [user, isLoading, sessionError, login, logout, refreshSession],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const contextValue = useContext(AuthContext)
  if (!contextValue) {
    throw new Error('useAuth must be used inside AuthProvider')
  }
  return contextValue
}
