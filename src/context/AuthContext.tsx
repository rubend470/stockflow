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
import { setActiveBusinessId } from '../lib/tenantScope'
import { getUserProfile, logout as logoutUser, mapFirebaseUser } from '../services/authService'
import type { AppUser } from '../types/user'

interface AuthContextValue {
  user: AppUser | null
  loading: boolean
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setActiveBusinessId()
        setUser(null)
        setLoading(false)
        return
      }

      const profile = await getUserProfile(firebaseUser.uid)

      if (profile && !profile.active) {
        await logoutUser()
        setActiveBusinessId()
        setUser(null)
        setLoading(false)
        return
      }

      const mappedUser = mapFirebaseUser(firebaseUser, profile)
      setActiveBusinessId(mappedUser.currentBusinessId)
      setUser(mappedUser)
      setLoading(false)
    })

    return unsubscribe
  }, [])

  async function refreshUser() {
    const firebaseUser = auth.currentUser
    if (!firebaseUser) {
      setActiveBusinessId()
      setUser(null)
      return
    }

    const profile = await getUserProfile(firebaseUser.uid)
    if (profile && !profile.active) {
      await logoutUser()
      setActiveBusinessId()
      setUser(null)
      return
    }

    const mappedUser = mapFirebaseUser(firebaseUser, profile)
    setActiveBusinessId(mappedUser.currentBusinessId)
    setUser(mappedUser)
  }

  const value = useMemo(
    () => ({
      user,
      loading,
      logout: logoutUser,
      refreshUser,
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
