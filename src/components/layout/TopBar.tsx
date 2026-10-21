import { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { listBusinessesById, switchCurrentBusiness } from '../../services/businessService'
import type { Business } from '../../types/business'
import { roleLabels } from '../../utils/roles'
import { ThemeToggle } from './ThemeToggle'

interface TopBarProps {
  title: string
  subtitle?: string
  onMenuClick: () => void
}

export function TopBar({ title, subtitle, onMenuClick }: TopBarProps) {
  const { user, logout, refreshUser } = useAuth()
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [switchingBusiness, setSwitchingBusiness] = useState(false)

  useEffect(() => {
    if (!user?.businessIds?.length) return

    void listBusinessesById(user.businessIds).then(setBusinesses).catch(() => setBusinesses([]))
  }, [user?.businessIds])

  const visibleBusinesses = user?.businessIds?.length ? businesses : []

  async function handleBusinessChange(businessId: string) {
    if (!user || businessId === user.currentBusinessId) return
    setSwitchingBusiness(true)
    try {
      await switchCurrentBusiness(user.uid, businessId)
      await refreshUser()
      window.location.reload()
    } finally {
      setSwitchingBusiness(false)
    }
  }

  return (
    <header className="topbar">
      <div className="topbar-left">
        <button type="button" className="topbar-menu-btn" onClick={onMenuClick} aria-label="Abrir menú">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 7h16v2H4V7Zm0 5h16v2H4v-2Zm0 5h16v2H4v-2Z" />
          </svg>
        </button>
        <div>
          <h1>{title}</h1>
          {subtitle && <p>{subtitle}</p>}
        </div>
      </div>

      <div className="topbar-right">
        {visibleBusinesses.length > 0 && (
          <label className="topbar-business">
            <span>Empresa</span>
            <select
              value={user?.currentBusinessId ?? visibleBusinesses[0]?.id ?? ''}
              onChange={(event) => void handleBusinessChange(event.target.value)}
              disabled={switchingBusiness}
              aria-label="Empresa activa"
            >
              {visibleBusinesses.filter((business) => business.status === 'active').map((business) => (
                <option key={business.id} value={business.id}>{business.name}</option>
              ))}
            </select>
          </label>
        )}
        <ThemeToggle />
        <div className="topbar-user">
          <div>
            <strong>{user?.name}</strong>
            <span>{user ? roleLabels[user.role] : ''}</span>
          </div>
        </div>
        <button type="button" className="topbar-logout" onClick={() => logout()}>
          Salir
        </button>
      </div>
    </header>
  )
}
