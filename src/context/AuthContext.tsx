import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { Role } from '../data/navigation'

export type User = {
  userId: number
  fullName: string
  email: string
  role: Role
}

type AuthContextValue = {
  user: User | null
  login: (email: string, password: string) => Promise<void>
  logout: () => void
}

const STORAGE_KEY = 'dts_demo_user'
const DEMO_PASSWORD = 'demo123'

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

const demoUsers: Record<string, User> = {
  'admin@dts.com': { userId: 1, fullName: 'DTS Administrator', email: 'admin@dts.com', role: 'ADMIN' },
  'customer@dts.com': { userId: 2, fullName: 'Customer User', email: 'customer@dts.com', role: 'CUSTOMER' },
  'recruiter@dts.com': { userId: 3, fullName: 'Recruitment Executive', email: 'recruiter@dts.com', role: 'RECRUITER' },
  'candidate@dts.com': { userId: 4, fullName: 'Candidate User', email: 'candidate@dts.com', role: 'CANDIDATE' },
}

function readStoredUser(): User | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as User) : null
  } catch {
    sessionStorage.removeItem(STORAGE_KEY)
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(readStoredUser)

  const login = useCallback(async (email: string, password: string) => {
    await new Promise((resolve) => setTimeout(resolve, 650))

    const match = demoUsers[email.trim().toLowerCase()]
    if (!match || password !== DEMO_PASSWORD) {
      throw new Error('Invalid email or password. Use one of the demo accounts shown below.')
    }

    setUser(match)
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(match))
  }, [])

  const logout = useCallback(() => {
    setUser(null)
    sessionStorage.removeItem(STORAGE_KEY)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({ user, login, logout }),
    [user, login, logout]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider')
  }
  return ctx
}