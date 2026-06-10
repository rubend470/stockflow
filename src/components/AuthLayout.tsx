import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'
import { ThemeToggle } from './layout/ThemeToggle'

interface AuthLayoutProps {
  title: string
  subtitle: string
  children: ReactNode
  footer: ReactNode
}

export function AuthLayout({ title, subtitle, children, footer }: AuthLayoutProps) {
  return (
    <div className="auth-page">
      <div className="auth-theme-toggle">
        <ThemeToggle />
      </div>
      <div className="auth-card">
        <div className="auth-brand">
          <span className="auth-logo">SF</span>
          <div>
            <h1>StockFlow</h1>
            <p>Sistema de ventas e inventario</p>
          </div>
        </div>

        <div className="auth-header">
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>

        {children}

        <div className="auth-footer">{footer}</div>
      </div>
    </div>
  )
}

export function AuthLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="auth-link">
      {children}
    </Link>
  )
}
