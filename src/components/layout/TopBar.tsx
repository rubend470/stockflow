import { useAuth } from '../../context/AuthContext'
import { roleLabels } from '../../utils/roles'
import { ThemeToggle } from './ThemeToggle'

interface TopBarProps {
  title: string
  subtitle?: string
  onMenuClick: () => void
}

export function TopBar({ title, subtitle, onMenuClick }: TopBarProps) {
  const { user, logout } = useAuth()

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
