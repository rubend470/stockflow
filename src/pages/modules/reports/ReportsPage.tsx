import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { AppLayout } from '../../../components/layout/AppLayout'
import { AnimatedPanel, AnimatedTableRow } from '../../../components/ui/motion'
import { useAuth } from '../../../context/AuthContext'
import {
  getReportData,
  type CurrencyExchangeFlowRow,
  type CurrencyExchangeReportRow,
  type CurrencyExchangeSummary,
  type LowStockRow,
  type ReportPeriod,
  type SalesByCashierRow,
  type SalesByCategoryRow,
  type SalesByDayRow,
  type SalesPeriodStats,
  type TopProductRow,
} from '../../../services/reportService'
import { formatBaseMoney, formatMoney } from '../../../utils/formatMoney'
import { userCanViewProfit, userHasMenuPermission } from '../../../utils/menuPermissions'

const periodLabels: Record<ReportPeriod, string> = {
  today: 'Hoy',
  week: 'Últimos 7 días',
  month: 'Último mes',
}

function formatMargin(value: number) {
  return `${value.toFixed(1)} %`
}

function formatDateTime(value: string) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('es', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function formatExchangeMethod(name: string, reference?: string) {
  return reference ? `${name} · Ref. ${reference}` : name
}

function EmptyReport({ message }: { message: string }) {
  return <div className="finance-empty">{message}</div>
}

export function ReportsPage() {
  const { user } = useAuth()
  const [period, setPeriod] = useState<ReportPeriod>('today')
  const [summary, setSummary] = useState<SalesPeriodStats>({
    count: 0,
    revenue: 0,
    profit: 0,
    marginPercent: 0,
  })
  const [topProducts, setTopProducts] = useState<TopProductRow[]>([])
  const [byDay, setByDay] = useState<SalesByDayRow[]>([])
  const [byCashier, setByCashier] = useState<SalesByCashierRow[]>([])
  const [byCategory, setByCategory] = useState<SalesByCategoryRow[]>([])
  const [lowStock, setLowStock] = useState<LowStockRow[]>([])
  const [exchangeSummary, setExchangeSummary] = useState<CurrencyExchangeSummary>({
    count: 0,
    volumeInBase: 0,
  })
  const [exchanges, setExchanges] = useState<CurrencyExchangeReportRow[]>([])
  const [exchangeFlowByCurrency, setExchangeFlowByCurrency] = useState<CurrencyExchangeFlowRow[]>(
    [],
  )
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const canViewProfit = userCanViewProfit(user)
  const canAccess = userHasMenuPermission(user, 'reports')

  useEffect(() => {
    loadReport()
  }, [period, canViewProfit])

  async function loadReport() {
    setLoading(true)
    setError('')

    try {
      const data = await getReportData(period, canViewProfit)
      setSummary(data.summary)
      setTopProducts(data.topProducts)
      setByDay(data.byDay)
      setByCashier(data.byCashier)
      setByCategory(data.byCategory)
      setLowStock(data.lowStock)
      setExchangeSummary(data.exchangeSummary)
      setExchanges(data.exchanges)
      setExchangeFlowByCurrency(data.exchangeFlowByCurrency)
    } catch {
      setError('No se pudieron cargar los reportes.')
    } finally {
      setLoading(false)
    }
  }

  if (!canAccess) {
    return <Navigate to="/" replace />
  }

  return (
    <AppLayout title="Reportes" subtitle="Análisis del negocio">
      <AnimatedPanel className="finance-panel">
        <div className="finance-panel-header">
          <div>
            <h2>Resumen de ventas</h2>
            <p>Ventas, cambio de moneda, ganancias, desglose y stock bajo del periodo seleccionado.</p>
          </div>
          <select value={period} onChange={(event) => setPeriod(event.target.value as ReportPeriod)}>
            {Object.entries(periodLabels).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        {loading ? (
          <div className="finance-empty">Cargando reportes...</div>
        ) : (
          <>
            <div className="finance-stats">
              <article>
                <span>Ventas ({periodLabels[period].toLowerCase()})</span>
                <strong>{summary.count}</strong>
              </article>
              <article>
                <span>Ingresos</span>
                <strong>{formatBaseMoney(summary.revenue)}</strong>
              </article>
              {canViewProfit && (
                <>
                  <article>
                    <span>Ganancia bruta</span>
                    <strong className="finance-profit">{formatBaseMoney(summary.profit)}</strong>
                  </article>
                  <article>
                    <span>Margen bruto</span>
                    <strong className="finance-profit">{formatMargin(summary.marginPercent)}</strong>
                  </article>
                </>
              )}
              <article>
                <span>Cambios de moneda</span>
                <strong>{exchangeSummary.count}</strong>
              </article>
              {exchangeSummary.count > 0 && (
                <article>
                  <span>Volumen cambio (COP)</span>
                  <strong>{formatBaseMoney(exchangeSummary.volumeInBase)}</strong>
                </article>
              )}
            </div>

            {exchangeSummary.count > 0 && (
              <section className="report-section">
                <h3 className="finance-detail-title">Cambio de moneda</h3>
                <p className="finance-detail-hint">
                  Entradas y salidas de caja por operaciones de casa de cambio en este periodo.
                </p>

                {exchangeFlowByCurrency.length > 0 && (
                  <div className="sales-currency-grid report-exchange-flow">
                    {exchangeFlowByCurrency.map((row) => (
                      <article key={row.currencyCode} className="sales-currency-card">
                        <span>{row.currencyCode}</span>
                        <div className="report-exchange-flow-totals">
                          {row.cashIn > 0 && (
                            <small className="exchange-flow-in">
                              Entró {formatMoney(row.cashIn, row.currencyCode)}
                            </small>
                          )}
                          {row.cashOut > 0 && (
                            <small className="exchange-flow-out">
                              Salió {formatMoney(row.cashOut, row.currencyCode)}
                            </small>
                          )}
                        </div>
                      </article>
                    ))}
                  </div>
                )}

                <div className="finance-table-wrap">
                  <table className="finance-table">
                    <thead>
                      <tr>
                        <th>Fecha</th>
                        <th>Entró a caja</th>
                        <th>Salió de caja</th>
                        <th>Tasa</th>
                        <th>Equiv. COP</th>
                        <th>Cliente</th>
                        <th>Cajero</th>
                      </tr>
                    </thead>
                    <tbody>
                      {exchanges.map((row, index) => (
                        <AnimatedTableRow key={row.id} index={index}>
                          <td>{formatDateTime(row.createdAt)}</td>
                          <td>
                            <strong>
                              {formatMoney(row.cashInAmount, row.cashInCurrency)}
                            </strong>
                            <small className="exchange-method-hint">
                              {formatExchangeMethod(row.cashInMethodName, row.cashInReference)}
                            </small>
                          </td>
                          <td>
                            <strong>
                              {formatMoney(row.cashOutAmount, row.cashOutCurrency)}
                            </strong>
                            <small className="exchange-method-hint">
                              {formatExchangeMethod(row.cashOutMethodName, row.cashOutReference)}
                            </small>
                          </td>
                          <td className="exchange-rate-cell">{row.rateLabel}</td>
                          <td>{formatBaseMoney(row.amountInBase)}</td>
                          <td>{row.clientName || '—'}</td>
                          <td>{row.createdByName}</td>
                        </AnimatedTableRow>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            <section className="report-section">
              <h3 className="finance-detail-title">Ventas por día</h3>
              {byDay.length === 0 ? (
                <EmptyReport message="Sin ventas en este periodo." />
              ) : (
                <div className="finance-table-wrap">
                  <table className="finance-table">
                    <thead>
                      <tr>
                        <th>Fecha</th>
                        <th>Ventas</th>
                        <th>Ingresos</th>
                        {canViewProfit && <th>Ganancia</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {byDay.map((row, index) => (
                        <AnimatedTableRow key={row.dateKey} index={index}>
                          <td>{row.dateLabel}</td>
                          <td>{row.count}</td>
                          <td>{formatBaseMoney(row.revenue)}</td>
                          {canViewProfit && <td>{formatBaseMoney(row.profit)}</td>}
                        </AnimatedTableRow>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="report-section">
              <h3 className="finance-detail-title">Ventas por cajero</h3>
              {byCashier.length === 0 ? (
                <EmptyReport message="Sin ventas en este periodo." />
              ) : (
                <div className="finance-table-wrap">
                  <table className="finance-table">
                    <thead>
                      <tr>
                        <th>Cajero</th>
                        <th>Ventas</th>
                        <th>Ingresos</th>
                        {canViewProfit && <th>Ganancia</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {byCashier.map((row, index) => (
                        <AnimatedTableRow key={row.cashierId} index={index}>
                          <td>
                            <strong>{row.cashierName}</strong>
                          </td>
                          <td>{row.count}</td>
                          <td>{formatBaseMoney(row.revenue)}</td>
                          {canViewProfit && <td>{formatBaseMoney(row.profit)}</td>}
                        </AnimatedTableRow>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="report-section">
              <h3 className="finance-detail-title">Ventas por categoría</h3>
              {byCategory.length === 0 ? (
                <EmptyReport message="Sin ventas en este periodo." />
              ) : (
                <div className="finance-table-wrap">
                  <table className="finance-table">
                    <thead>
                      <tr>
                        <th>Categoría</th>
                        <th>Cantidad</th>
                        <th>Ingresos</th>
                        {canViewProfit && <th>Ganancia</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {byCategory.map((row, index) => (
                        <AnimatedTableRow key={row.category} index={index}>
                          <td>
                            <strong>{row.categoryLabel}</strong>
                          </td>
                          <td>{row.quantity}</td>
                          <td>{formatBaseMoney(row.revenue)}</td>
                          {canViewProfit && <td>{formatBaseMoney(row.profit)}</td>}
                        </AnimatedTableRow>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="report-section">
              <h3 className="finance-detail-title">Productos más vendidos</h3>
              {topProducts.length === 0 ? (
                <EmptyReport message="Sin ventas en este periodo." />
              ) : (
                <div className="finance-table-wrap">
                  <table className="finance-table">
                    <thead>
                      <tr>
                        <th>Producto</th>
                        <th>Cantidad</th>
                        <th>Ingresos</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topProducts.map((row, index) => (
                        <AnimatedTableRow key={row.productId} index={index}>
                          <td>
                            <strong>{row.productName}</strong>
                          </td>
                          <td>{row.quantity}</td>
                          <td>{formatBaseMoney(row.revenue)}</td>
                        </AnimatedTableRow>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="report-section">
              <div className="report-section-header">
                <h3 className="finance-detail-title">Stock bajo y agotado</h3>
                <Link to="/inventario/productos" className="report-section-link">
                  Ver productos
                </Link>
              </div>
              {lowStock.length === 0 ? (
                <EmptyReport message="Todos los productos tienen stock suficiente." />
              ) : (
                <div className="finance-table-wrap">
                  <table className="finance-table">
                    <thead>
                      <tr>
                        <th>Producto</th>
                        <th>Stock</th>
                        <th>Mínimo</th>
                        <th>Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lowStock.map((row, index) => (
                        <AnimatedTableRow key={row.productId} index={index}>
                          <td>
                            <strong>{row.productName}</strong>
                          </td>
                          <td>
                            {row.stock} {row.unitLabel}
                          </td>
                          <td>
                            {row.minStock} {row.unitLabel}
                          </td>
                          <td>
                            <span className={`report-stock-badge ${row.status}`}>
                              {row.status === 'out' ? 'Agotado' : 'Stock bajo'}
                            </span>
                          </td>
                        </AnimatedTableRow>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </AnimatedPanel>
    </AppLayout>
  )
}
