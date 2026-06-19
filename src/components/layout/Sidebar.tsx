import { Fragment, useEffect, useMemo, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { filterNavigation, navigation, type NavItem } from '../../config/navigation'
import { useAuth } from '../../context/AuthContext'
import { userHasMenuPermission } from '../../utils/menuPermissions'
import { roleLabels } from '../../utils/roles'
import { ThemeToggle } from './ThemeToggle'
import { NavIcon } from './NavIcon'

interface SidebarProps {
  open: boolean
  onClose: () => void
}

function isPathActive(pathname: string, path: string) {
  if (path === '/') return pathname === '/'
  return pathname === path || pathname.startsWith(`${path}/`)
}

function isGroupActive(pathname: string, item: NavItem) {
  if (item.path) return isPathActive(pathname, item.path)
  return item.children?.some((child) => child.path && isPathActive(pathname, child.path)) ?? false
}

function NavItemContent({ icon, label }: { icon: string; label: string }) {
  return (
    <>
      <span className="sidebar-icon-wrap">
        <NavIcon name={icon} />
      </span>
      <span className="sidebar-item-label">{label}</span>
    </>
  )
}

function SidebarLink({ item, onNavigate }: { item: NavItem; onNavigate?: () => void }) {
  if (!item.path) return null

  return (
    <NavLink
      to={item.path}
      end={item.path === '/'}
      className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
      onClick={onNavigate}
    >
      <NavItemContent icon={item.icon} label={item.label} />
    </NavLink>
  )
}

function SidebarGroup({
  item,
  pathname,
  onNavigate,
}: {
  item: NavItem
  pathname: string
  onNavigate?: () => void
}) {
  const active = isGroupActive(pathname, item)
  const [expanded, setExpanded] = useState(active)

  useEffect(() => {
    if (active) setExpanded(true)
  }, [active, pathname])

  if (!item.children?.length) {
    return <SidebarLink item={item} onNavigate={onNavigate} />
  }

  return (
    <div className={`sidebar-group ${expanded ? 'expanded' : ''} ${active ? 'active-group' : ''}`}>
      <button
        type="button"
        className="sidebar-group-toggle"
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
      >
        <span className="sidebar-group-label">
          <NavItemContent icon={item.icon} label={item.label} />
        </span>
        <svg viewBox="0 0 24 24" aria-hidden="true" className="sidebar-chevron">
          <path d="M8.5 10 12 13.5 15.5 10" />
        </svg>
      </button>

      <div className="sidebar-submenu">
        <div className="sidebar-submenu-inner">
          {item.children.map((child) => (
            <NavLink
              key={child.id}
              to={child.path!}
              className={({ isActive }) => `sidebar-sublink ${isActive ? 'active' : ''}`}
              onClick={onNavigate}
            >
              <span className="sidebar-sublink-dot" aria-hidden="true" />
              <NavItemContent icon={child.icon} label={child.label} />
            </NavLink>
          ))}
        </div>
      </div>
    </div>
  )
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const { user } = useAuth()
  const location = useLocation()

  const items = useMemo(() => filterNavigation(navigation, user), [user])
  const canOpenPos = userHasMenuPermission(user, 'pos')

  const userInitial = user?.name?.charAt(0).toUpperCase() ?? 'U'

  return (
    <>
      <div className={`sidebar-backdrop ${open ? 'visible' : ''}`} onClick={onClose} />
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <div className="sidebar-brand-main">
            <span className="sidebar-logo">SF</span>
            <div>
              <strong>StockFlow</strong>
              <span>Abasto y charcutería</span>
            </div>
          </div>
          <button
            type="button"
            className="sidebar-close-btn"
            onClick={onClose}
            aria-label="Cerrar menú"
          >
            ×
          </button>
        </div>

        <div className="sidebar-actions">
          {canOpenPos && (
            <NavLink
              to="/ventas/pos"
              className={({ isActive }) => `sidebar-quick-action ${isActive ? 'active' : ''}`}
              onClick={onClose}
            >
              <span className="sidebar-quick-action-icon">
                <NavIcon name="pos" />
              </span>
              <span className="sidebar-quick-action-text">
                <strong>Nueva venta</strong>
                <small>Punto de venta</small>
              </span>
              <svg viewBox="0 0 24 24" aria-hidden="true" className="sidebar-quick-action-arrow">
                <path d="M9 6l6 6-6 6" />
              </svg>
            </NavLink>
          )}
        </div>

        <nav className="sidebar-nav" aria-label="Menú principal">
          {items.map((item, index) => (
            <Fragment key={item.id}>
              {index > 0 && <div className="sidebar-divider" aria-hidden="true" />}
              <SidebarGroup item={item} pathname={location.pathname} onNavigate={onClose} />
            </Fragment>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user-card">
            <span className="sidebar-user-avatar">{userInitial}</span>
            <div className="sidebar-user-info">
              <strong>{user?.name ?? 'Usuario'}</strong>
              <span>{user ? roleLabels[user.role] : ''}</span>
            </div>
            <ThemeToggle />
          </div>
        </div>
      </aside>
    </>
  )
}
