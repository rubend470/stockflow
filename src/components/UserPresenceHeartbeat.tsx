import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { updateUserPresence } from '../services/userService'

const HEARTBEAT_INTERVAL_MS = 45_000

export function UserPresenceHeartbeat() {
  const { user } = useAuth()
  const location = useLocation()
  const activePath = `${location.pathname}${location.search}`
  const activePathRef = useRef(activePath)

  useEffect(() => {
    activePathRef.current = activePath
  }, [activePath])

  useEffect(() => {
    if (!user) return

    let cancelled = false

    async function markOnline() {
      if (!user || cancelled || document.visibilityState === 'hidden') return

      await updateUserPresence(user.uid, {
        state: 'online',
        activePath,
      }).catch(() => undefined)
    }

    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        void markOnline()
      }
    }

    void markOnline()
    const intervalId = window.setInterval(markOnline, HEARTBEAT_INTERVAL_MS)
    window.addEventListener('focus', markOnline)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      cancelled = true
      window.clearInterval(intervalId)
      window.removeEventListener('focus', markOnline)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [user, activePath])

  useEffect(() => {
    if (!user) return
    const currentUser = user

    function markOffline() {
      void updateUserPresence(currentUser.uid, {
        state: 'offline',
        activePath: activePathRef.current,
      })
    }

    window.addEventListener('beforeunload', markOffline)

    return () => {
      window.removeEventListener('beforeunload', markOffline)
      markOffline()
    }
  }, [user])

  return null
}
