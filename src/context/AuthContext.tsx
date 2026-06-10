import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '../lib/firebase'
import { getUserProfile, logout as logoutUser, mapFirebaseUser } from '../services/authService'
import type { AppUser } from '../types/user'

interface AuthContextValue {
  user: AppUser | null
  loading: boolean
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setUser(null)
        setLoading(false)
        return
      }

      const profile = await getUserProfile(firebaseUser.uid)

      if (profile && !profile.active) {
        await logoutUser()
        setUser(null)
        setLoading(false)
        return
      }

      setUser(mapFirebaseUser(firebaseUser, profile))
      setLoading(false)
    })

    return unsubscribe
  }, [])

  const value = useMemo(
    () => ({
      user,
      loading,
      logout: logoutUser,
    }),
    [user, loading],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth debe usarse dentro de AuthProvider')
  }
  return context
}
