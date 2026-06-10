import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AppLayout } from '../components/layout/AppLayout'
import { AnimatedPanel } from '../components/ui/motion'
import { useAuth } from '../context/AuthContext'
import { getDashboardStats } from '../services/reportService'
import type { DashboardStats } from '../services/reportService'
import { formatBaseMoney } from '../utils/formatMoney'

const quickLinks = [
  { label: 'Venta', path: '/ventas/pos', tone: 'green' },
  { label: 'Historial de ventas', path: '/ventas/historial', tone: 'amber' },
  { label: 'Productos', path: '/inventario/productos', tone: 'blue' },
  { label: 'Deudas', path: '/clientes/deudas', tone: 'rose' },
]

export function DashboardPage() {
  const { user } = useAuth()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)

  const canViewProfit = user?.role !== 'cashier'

  useEffect(() => {
    getDashboardStats(canViewProfit)
      .then(setStats)
      .finally(() => setLoading(false))
  }, [canViewProfit])

  const lowStockPreview = stats?.lowStock.slice(0, 8) ?? []
  const lowStockOverflow = (stats?.lowStock.length ?? 0) - lowStockPreview.length

  return (
    <AppLayout title="Inicio" subtitle="Resumen general del negocio">
      <div className="dashboard-grid">
        <section className="stats-grid">
          <AnimatedPanel delay={1} className="stat-card">
            <span>Ventas del día</span>
            <strong>{loading ? '—' : stats?.todaySales.count ?? 0}</strong>
            <small>
              {loading ? 'Cargando...' : formatBaseMoney(stats?.todaySales.revenue ?? 0)}
            </small>
          </AnimatedPanel>
          <AnimatedPanel delay={2} className="stat-card">
            <span>Ingresos del día</span>
            <strong>
              {loading ? '—' : formatBaseMoney(stats?.todaySales.revenue ?? 0)}
            </strong>
            <small>
              <Link to="/ventas/historial">Ver historial</Link>
            </small>
          </AnimatedPanel>
          <AnimatedPanel delay={3} className="stat-card">
            <span>Productos activos</span>
            <strong>{loading ? '—' : stats?.productCount ?? 0}</strong>
            <small>
              {loading ? '' : `${stats?.lowStockCount ?? 0} con stock bajo o agotado`}
            </small>
          </AnimatedPanel>
          <AnimatedPanel delay={4} className="stat-card">
            <span>Deudas (fiado)</span>
            <strong>
              {loading ? '—' : formatBaseMoney(stats?.activeDebtBalance ?? 0)}
            </strong>
            <small>Saldo por cobrar</small>
          </AnimatedPanel>
          <AnimatedPanel delay={5} className="stat-card">
            <span>Préstamos</span>
            <strong>
              {loading ? '—' : formatBaseMoney(stats?.activeLoanBalance ?? 0)}
            </strong>
            <small>
              <Link to="/clientes/deudas">Ver deudas y créditos</Link>
            </small>
          </AnimatedPanel>
        </section>

        {!loading && stats?.lowStockAlertEnabled && lowStockPreview.length > 0 && (
          <AnimatedPanel delay={6} className="dashboard-stock-alert">
            <div className="dashboard-stock-alert-header">
              <div>
                <h3>Alerta de stock</h3>
                <p>
                  {stats.lowStockCount} producto(s) con stock bajo o agotado.
                </p>
              </div>
              <Link to="/inventario/stock" className="dashboard-stock-alert-link">
                Ver inventario
              </Link>
            </div>
            <ul className="dashboard-stock-alert-list">
              {lowStockPreview.map((item) => (
                <li key={item.productId} className={`dashboard-stock-alert-item ${item.status}`}>
                  <strong>{item.productName}</strong>
                  <span>
                    {item.stock} {item.unitLabel} · mín. {item.minStock} {item.unitLabel}
                  </span>
                  <span className={`dashboard-stock-alert-badge ${item.status}`}>
                    {item.status === 'out' ? 'Agotado' : 'Stock bajo'}
                  </span>
                </li>
              ))}
            </ul>
            {lowStockOverflow > 0 && (
              <p className="dashboard-stock-alert-more">
                Y {lowStockOverflow} producto(s) más.{' '}
                <Link to="/inventario/stock">Ver todos</Link>
              </p>
            )}
          </AnimatedPanel>
        )}

        <AnimatedPanel delay={7} className="quick-links-card">
          <h3>Accesos rápidos</h3>
          <div className="quick-links">
            {quickLinks.map((link) => (
              <Link key={link.path} to={link.path} className={`quick-link ${link.tone}`}>
                {link.label}
              </Link>
            ))}
          </div>
        </AnimatedPanel>
      </div>
    </AppLayout>
  )
}
