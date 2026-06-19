import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AppLayout } from '../components/layout/AppLayout'
import { AnimatedPanel } from '../components/ui/motion'
import { useAuth } from '../context/AuthContext'
import { getDashboardStats } from '../services/reportService'
import type { DashboardStats } from '../services/reportService'
import { purchaseInvoiceStatusLabels } from '../types/purchaseInvoice'
import { formatBaseMoney, formatMoney } from '../utils/formatMoney'
import { userCanViewProfit, userHasAnyMenuPermission } from '../utils/menuPermissions'

const quickLinks = [
  { label: 'Venta', description: 'Abrir caja', path: '/ventas/pos', tone: 'green' },
  { label: 'Historial de ventas', description: 'Consultar movimientos', path: '/ventas/historial', tone: 'amber' },
  { label: 'Productos', description: 'Inventario y precios', path: '/inventario/productos', tone: 'blue' },
  { label: 'Deudas', description: 'Fiados y préstamos', path: '/clientes/deudas', tone: 'rose' },
]

export function DashboardPage() {
  const { user } = useAuth()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)

  const canViewProfit = userCanViewProfit(user)
  const canManage = userHasAnyMenuPermission(user, ['pending-invoices', 'suppliers', 'settings'])

  useEffect(() => {
    getDashboardStats(canViewProfit)
      .then(setStats)
      .finally(() => setLoading(false))
  }, [canViewProfit])

  const lowStockPreview = stats?.lowStock.slice(0, 8) ?? []
  const lowStockOverflow = (stats?.lowStock.length ?? 0) - lowStockPreview.length
  const pendingInvoicesPreview = stats?.pendingPurchaseInvoices.slice(0, 8) ?? []
  const pendingInvoicesOverflow =
    (stats?.pendingPurchaseInvoices.length ?? 0) - pendingInvoicesPreview.length

  return (
    <AppLayout title="Inicio" subtitle="Resumen general del negocio">
      <div className="dashboard-grid">
        <section className="stats-grid">
          <AnimatedPanel delay={1} className="stat-card stat-card-green">
            <span>Ventas del día</span>
            <strong>{loading ? '—' : stats?.todaySales.count ?? 0}</strong>
            <small>
              {loading ? 'Cargando...' : formatBaseMoney(stats?.todaySales.revenue ?? 0)}
            </small>
          </AnimatedPanel>
          <AnimatedPanel delay={2} className="stat-card stat-card-blue">
            <span>Ingresos del día</span>
            <strong>
              {loading ? '—' : formatBaseMoney(stats?.todaySales.revenue ?? 0)}
            </strong>
            <small>
              <Link to="/ventas/historial">Ver historial</Link>
            </small>
          </AnimatedPanel>
          <AnimatedPanel delay={3} className="stat-card stat-card-amber">
            <span>Productos activos</span>
            <strong>{loading ? '—' : stats?.productCount ?? 0}</strong>
            <small>
              {loading ? '' : `${stats?.lowStockCount ?? 0} con stock bajo o agotado`}
            </small>
          </AnimatedPanel>
          <AnimatedPanel delay={4} className="stat-card stat-card-rose">
            <span>Deudas (fiado)</span>
            <strong>
              {loading ? '—' : formatBaseMoney(stats?.activeDebtBalance ?? 0)}
            </strong>
            <small>Saldo por cobrar</small>
          </AnimatedPanel>
          <AnimatedPanel delay={5} className="stat-card stat-card-violet">
            <span>Préstamos</span>
            <strong>
              {loading ? '—' : formatBaseMoney(stats?.activeLoanBalance ?? 0)}
            </strong>
            <small>
              <Link to="/clientes/deudas">Ver deudas y créditos</Link>
            </small>
          </AnimatedPanel>
          {canManage && (
            <AnimatedPanel delay={6} className="stat-card stat-card-red">
              <span>Facturas por pagar</span>
              <strong>
                {loading ? '—' : stats?.pendingPurchaseInvoices.length ?? 0}
              </strong>
              <small>
                {loading
                  ? 'Cargando...'
                  : `${formatBaseMoney(stats?.pendingPurchaseInvoicesTotalDueInBase ?? 0)} pendientes`}
              </small>
            </AnimatedPanel>
          )}
        </section>

        {!loading && canManage && pendingInvoicesPreview.length > 0 && (
          <AnimatedPanel delay={7} className="dashboard-stock-alert dashboard-pending-invoices">
            <div className="dashboard-stock-alert-header">
              <div>
                <h3>Facturas pendientes por pagar</h3>
                <p>
                  {stats?.pendingPurchaseInvoices.length ?? 0} factura(s) de proveedor con saldo
                  pendiente ({formatBaseMoney(stats?.pendingPurchaseInvoicesTotalDueInBase ?? 0)}).
                </p>
              </div>
              <Link
                to="/ventas/facturas-pendientes"
                className="dashboard-stock-alert-link"
              >
                Ver entradas
              </Link>
            </div>
            <ul className="dashboard-stock-alert-list">
              {pendingInvoicesPreview.map((invoice) => (
                <li key={invoice.id} className="dashboard-stock-alert-item low">
                  <strong>
                    {invoice.number} · {invoice.supplierName}
                  </strong>
                  <span>
                    {formatMoney(invoice.amountDue, invoice.currencyCode)} por pagar
                  </span>
                  <span className="dashboard-stock-alert-badge low">
                    {purchaseInvoiceStatusLabels[invoice.status]}
                  </span>
                </li>
              ))}
            </ul>
            {pendingInvoicesOverflow > 0 && (
              <p className="dashboard-stock-alert-more">
                Y {pendingInvoicesOverflow} factura(s) más.{' '}
                <Link to="/ventas/facturas-pendientes">Ver todas</Link>
              </p>
            )}
          </AnimatedPanel>
        )}

        {!loading && stats?.lowStockAlertEnabled && lowStockPreview.length > 0 && (
          <AnimatedPanel delay={8} className="dashboard-stock-alert">
            <div className="dashboard-stock-alert-header">
              <div>
                <h3>Alerta de stock</h3>
                <p>
                  {stats.lowStockCount} producto(s) con stock bajo o agotado.
                </p>
              </div>
              <Link to="/inventario/productos" className="dashboard-stock-alert-link">
                Ver productos
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
                <Link to="/inventario/productos">Ver todos</Link>
              </p>
            )}
          </AnimatedPanel>
        )}

        <AnimatedPanel delay={9} className="quick-links-card">
          <h3>Accesos rápidos</h3>
          <div className="quick-links">
            {quickLinks.map((link) => (
              <Link key={link.path} to={link.path} className={`quick-link ${link.tone}`}>
                <span>
                  <strong>{link.label}</strong>
                  <small>{link.description}</small>
                </span>
                <b aria-hidden="true">&gt;</b>
              </Link>
            ))}
          </div>
        </AnimatedPanel>
      </div>
    </AppLayout>
  )
}
