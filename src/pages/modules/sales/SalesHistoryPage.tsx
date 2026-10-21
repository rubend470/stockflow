import { useEffect, useMemo, useState } from 'react'
import { AppLayout } from '../../../components/layout/AppLayout'
import { CurrencyCashBreakdown } from '../../../components/sales/CurrencyCashBreakdown'
import { SaleDetailModal } from '../../../components/sales/SaleDetailModal'
import { AnimatedPanel, AnimatedTableRow } from '../../../components/ui/motion'
import { MoneyText } from '../../../components/ui/MoneyText'
import { TableAction, TableActions } from '../../../components/ui/TableActions'
import { TablePagination } from '../../../components/ui/TablePagination'
import { usePagination } from '../../../hooks/usePagination'
import { useAuth } from '../../../context/AuthContext'
import { useConfirm } from '../../../context/ConfirmContext'
import {
  enrichSalesWithPayments,
  summarizeSalesCollection,
  type EnrichedSale,
} from '../../../services/reportService'
import { listCashMovements } from '../../../services/cashMovementService'
import { mergeCurrencyCashTotals } from '../../../utils/salePayments'
import { deleteSale, getSaleItems, getSalePayments, listSales } from '../../../services/saleService'
import { getAppSettings } from '../../../services/settingsService'
import { cashMovementTypeLabels, type CashMovement } from '../../../types/cashMovement'
import type { CartItem, Sale, SaleItem, SalePayment, SalePaymentInput, SaleResult } from '../../../types/sale'
import type { AppSettings } from '../../../types/settings'
import { isOnLocalDate, todayDateInputValue } from '../../../utils/dates'
import { formatBaseMoney, formatMoney } from '../../../utils/formatMoney'
import { userCanViewProfit, userHasAnyMenuPermission } from '../../../utils/menuPermissions'

function formatDate(value: string) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('es', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

const paymentStatusLabels: Record<string, string> = {
  paid: 'Pagada',
  partial: 'Pago parcial',
  pending: 'A crédito',
}

function isSaleInDateRange(createdAt: string, from: string, to: string) {
  if (!createdAt) return false

  const saleDate = new Date(createdAt)
  if (Number.isNaN(saleDate.getTime())) return false

  if (from) {
    const start = new Date(`${from}T00:00:00`)
    if (saleDate < start) return false
  }

  if (to) {
    const end = new Date(`${to}T23:59:59.999`)
    if (saleDate > end) return false
  }

  return true
}

function isDateKeyInRange(dateKey: string, from: string, to: string) {
  if (!dateKey) return false
  if (from && dateKey < from) return false
  if (to && dateKey > to) return false
  return true
}

export function SalesHistoryPage() {
  const { user } = useAuth()
  const confirm = useConfirm()
  const [sales, setSales] = useState<EnrichedSale[]>([])
  const [cashMovements, setCashMovements] = useState<CashMovement[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [search, setSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null)
  const [detailItems, setDetailItems] = useState<SaleItem[]>([])
  const [detailPayments, setDetailPayments] = useState<SalePayment[]>([])
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailPrintingTicket, setDetailPrintingTicket] = useState(false)
  const [detailPrintError, setDetailPrintError] = useState('')

  const canViewProfit = userCanViewProfit(user)
  const canDeleteForTesting = userHasAnyMenuPermission(user, ['settings', 'users'])

  useEffect(() => {
    loadSales()
  }, [])

  async function loadSales() {
    setLoading(true)
    setError('')

    try {
      const [rawSales, movements] = await Promise.all([listSales(), listCashMovements()])
      const enriched = await enrichSalesWithPayments(rawSales)
      setSales(enriched.sales)
      setCashMovements(movements)
    } catch {
      setError('No se pudo cargar el historial de ventas.')
    } finally {
      setLoading(false)
    }
  }

  const hasDateFilter = Boolean(dateFrom || dateTo)
  const todayValue = todayDateInputValue()

  const filteredSales = useMemo(() => {
    const query = search.trim().toLowerCase()

    return sales.filter((sale) => {
      if (hasDateFilter) {
        if (!isSaleInDateRange(sale.createdAt, dateFrom, dateTo)) return false
      } else if (!isOnLocalDate(sale.createdAt, todayValue)) {
        return false
      }

      if (!query) return true

      return (
        sale.number.toLowerCase().includes(query) ||
        sale.cashierName.toLowerCase().includes(query) ||
        sale.clientName?.toLowerCase().includes(query)
      )
    })
  }, [sales, search, dateFrom, dateTo, hasDateFilter, todayValue])

  const filteredCashByCurrency = useMemo(
    () => mergeCurrencyCashTotals(filteredSales.flatMap((sale) => sale.cashByCurrency)),
    [filteredSales],
  )

  const filteredCashMovements = useMemo(() => {
    return cashMovements.filter((movement) => {
      if (hasDateFilter) {
        return isDateKeyInRange(movement.movementDate, dateFrom, dateTo)
      }
      return movement.movementDate === todayValue
    })
  }, [cashMovements, dateFrom, dateTo, hasDateFilter, todayValue])

  const cashMovementStats = useMemo(() => {
    return filteredCashMovements.reduce(
      (acc, movement) => {
        if (movement.type === 'opening') acc.opening += movement.amountInBase
        if (movement.type === 'in') acc.extraIn += movement.amountInBase
        if (movement.type === 'out') acc.extraOut += movement.amountInBase
        return acc
      },
      { opening: 0, extraIn: 0, extraOut: 0 },
    )
  }, [filteredCashMovements])

  const stats = useMemo(
    () => summarizeSalesCollection(filteredSales, canViewProfit),
    [filteredSales, canViewProfit],
  )

  const expectedRegisterCash =
    stats.cashInRegister +
    cashMovementStats.opening +
    cashMovementStats.extraIn -
    cashMovementStats.extraOut

  const pagination = usePagination(filteredSales, 12)

  async function openSaleDetail(sale: Sale) {
    setSelectedSale(sale)
    setDetailOpen(true)
    setDetailLoading(true)
    setDetailPrintError('')
    setDetailItems([])
    setDetailPayments([])

    try {
      const [items, payments] = await Promise.all([
        getSaleItems(sale.id),
        getSalePayments(sale.id),
      ])
      setDetailItems(items)
      setDetailPayments(payments)
    } catch {
      setError('No se pudo cargar el detalle de la venta.')
      setDetailOpen(false)
    } finally {
      setDetailLoading(false)
    }
  }

  async function handleDeleteSale(sale: Sale) {
    if (!canDeleteForTesting) return

    const confirmed = await confirm({
      title: 'Borrar venta (prueba)',
      message: `¿Eliminar la venta ${sale.number}? Esto revierte stock y deudas vinculadas. Uso temporal para pruebas.`,
      confirmLabel: 'Sí, borrar',
      tone: 'danger',
    })
    if (!confirmed) return

    setDeletingId(sale.id)
    setError('')
    setMessage('')

    try {
      await deleteSale(sale.id)
      if (detailOpen && selectedSale?.id === sale.id) {
        setDetailOpen(false)
        setSelectedSale(null)
      }
      setMessage(`Venta ${sale.number} eliminada.`)
      await loadSales()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo borrar la venta.')
    } finally {
      setDeletingId('')
    }
  }

  function buildTicketItems(items: SaleItem[]): CartItem[] {
    return items.map((item) => ({
      key: item.id,
      productId: item.productId,
      productName: item.productName,
      isQuickItem: item.isQuickItem,
      barcode: item.barcode,
      saleMode: item.saleMode,
      soldBy: item.soldBy,
      unitLabel: item.unit,
      unitsPerBundle: item.unitsPerBundle,
      quantity: item.quantity,
      stockQuantity: item.stockQuantity,
      unitCost: item.unitCost,
      unitPrice: item.unitPrice,
      originalUnitPrice: item.originalUnitPrice,
      manualUnitPrice: item.manualUnitPrice,
      saleLossPerUnit: item.saleLossPerUnit,
      enteredAmount: item.enteredAmount,
      offerId: item.offerId,
      offerType: item.offerType,
      offerName: item.offerName,
      discountAmount: item.discountAmount,
      lineCost: item.lineCost,
      lineRevenue: item.lineRevenue,
      lineProfit: item.lineProfit,
      stockAvailable: 0,
      stockCategoryId: item.stockCategoryId,
      stockCategoryName: item.stockCategoryName,
    }))
  }

  function buildTicketPayments(payments: SalePayment[]): SalePaymentInput[] {
    return payments.map((payment) => ({
      methodId: payment.methodId,
      methodName: payment.methodName,
      currencyCode: payment.currencyCode,
      amount: payment.amount,
      amountInBase: payment.amountInBase,
      reference: payment.reference,
      isCredit: payment.isCredit,
      clientId: payment.clientId,
      clientName: payment.clientName,
    }))
  }

  async function handlePrintSelectedSaleTicket() {
    if (!selectedSale || detailLoading || detailItems.length === 0) return

    setDetailPrintingTicket(true)
    setDetailPrintError('')
    setMessage('')

    try {
      const [settings, qz] = await Promise.all([
        getAppSettings().catch<AppSettings>(() => ({
          businessName: 'StockFlow',
          address: '',
          phone: '',
          baseCurrency: selectedSale.baseCurrency,
          taxEnabled: false,
          taxRate: 0,
          lowStockAlertEnabled: true,
        })),
        import('../../../services/qzService'),
      ])
      const saleForTicket: SaleResult & { createdAt?: string } = {
        saleId: selectedSale.id,
        saleNumber: selectedSale.number,
        total: selectedSale.total,
        profitTotal: selectedSale.profitTotal ?? 0,
        createdAt: selectedSale.createdAt,
      }

      await qz.printSaleTicket({
        sale: saleForTicket,
        items: buildTicketItems(detailItems),
        payments: buildTicketPayments(detailPayments),
        settings,
        cashierName: selectedSale.cashierName,
        baseCurrencyCode: selectedSale.baseCurrency,
      })

      setMessage(`Ticket de venta ${selectedSale.number} enviado a impresión.`)
    } catch (err) {
      const { getQzFriendlyError } = await import('../../../services/qzService')
      setDetailPrintError(getQzFriendlyError(err))
    } finally {
      setDetailPrintingTicket(false)
    }
  }

  return (
    <AppLayout title="Historial de ventas" subtitle="Control de caja, crédito y totales">
      <AnimatedPanel className="finance-panel">
        <div className="finance-panel-header">
          <div>
            <h2>Ventas registradas</h2>
            <p>
              {hasDateFilter
                ? 'Ventas del rango de fechas seleccionado.'
                : 'Mostrando las ventas de hoy. Usa las fechas para consultar días anteriores.'}
            </p>
          </div>
          <button type="button" className="finance-btn finance-btn-secondary" onClick={loadSales}>
            Actualizar
          </button>
        </div>

        <div className="finance-stats finance-stats-wide">
          <article>
            <span>Ventas</span>
            <strong>{stats.count}</strong>
          </article>
          <article>
            <span>En caja (COP)</span>
            <strong className="finance-profit">{formatBaseMoney(stats.cashInRegister)}</strong>
          </article>
          <article>
            <span>Base del día (COP)</span>
            <strong>{formatBaseMoney(cashMovementStats.opening)}</strong>
          </article>
          <article>
            <span>Entradas adicionales</span>
            <strong className="finance-profit">{formatBaseMoney(cashMovementStats.extraIn)}</strong>
          </article>
          <article>
            <span>Salidas adicionales</span>
            <strong className="text-danger">{formatBaseMoney(cashMovementStats.extraOut)}</strong>
          </article>
          <article>
            <span>Debe haber en caja</span>
            <strong className="finance-profit">{formatBaseMoney(expectedRegisterCash)}</strong>
          </article>
          <article>
            <span>A crédito (COP)</span>
            <strong>{formatBaseMoney(stats.creditAmount)}</strong>
          </article>
          <article>
            <span>Total vendido (COP)</span>
            <strong>{formatBaseMoney(stats.totalAmount)}</strong>
          </article>
          {canViewProfit && (
            <article>
              <span>Ganancia (COP)</span>
              <strong className="finance-profit">{formatBaseMoney(stats.totalProfit)}</strong>
            </article>
          )}
        </div>

        <CurrencyCashBreakdown items={filteredCashByCurrency} />

        <section className="cash-closure-section">
          <h3 className="finance-detail-title">Base, entradas y salidas del periodo</h3>
          {filteredCashMovements.length === 0 ? (
            <p className="finance-detail-hint">
              No hay base inicial ni movimientos adicionales para este periodo.
            </p>
          ) : (
            <div className="finance-table-wrap">
              <table className="finance-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Tipo</th>
                    <th>Descripción</th>
                    <th>Moneda / forma</th>
                    <th>Monto</th>
                    <th>Equiv. COP</th>
                    <th>Usuario</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCashMovements.map((movement, index) => (
                    <AnimatedTableRow key={movement.id} index={index}>
                      <td>{movement.movementDate}</td>
                      <td>{cashMovementTypeLabels[movement.type]}</td>
                      <td>
                        <strong>{movement.description}</strong>
                        {movement.notes && <small className="expense-note">{movement.notes}</small>}
                      </td>
                      <td>
                        <strong>{movement.currencyCode}</strong>
                        <small className="expense-note">
                          {movement.methodName || 'Caja'}
                          {movement.reference ? ` · Ref. ${movement.reference}` : ''}
                        </small>
                      </td>
                      <td>
                        <strong className={movement.type === 'out' ? 'text-danger' : 'finance-profit'}>
                          {movement.type === 'out' ? '−' : ''}
                          {formatMoney(movement.amount, movement.currencyCode)}
                        </strong>
                      </td>
                      <td>{formatBaseMoney(movement.amountInBase)}</td>
                      <td>{movement.createdByName || '—'}</td>
                    </AnimatedTableRow>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <div className="finance-filters finance-filters-row">
          <label className="finance-filter-field finance-filter-field-grow">
            <span>Buscar</span>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Número, cajero o cliente..."
            />
          </label>
          <label className="finance-filter-field">
            <span>Desde</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(event) => setDateFrom(event.target.value)}
            />
          </label>
          <label className="finance-filter-field">
            <span>Hasta</span>
            <input
              type="date"
              value={dateTo}
              onChange={(event) => setDateTo(event.target.value)}
            />
          </label>
          {hasDateFilter && (
            <button
              type="button"
              className="finance-btn finance-btn-secondary finance-filter-clear"
              onClick={() => {
                setDateFrom('')
                setDateTo('')
              }}
            >
              Ver solo hoy
            </button>
          )}
        </div>

        {error && <div className="alert alert-error">{error}</div>}
        {message && <div className="alert alert-success">{message}</div>}

        {loading ? (
          <div className="finance-empty">Cargando historial...</div>
        ) : filteredSales.length === 0 ? (
          <div className="finance-empty">
            <strong>
              {hasDateFilter ? 'Sin ventas en este filtro' : 'Sin ventas hoy'}
            </strong>
            <p>
              {sales.length === 0
                ? 'Las ventas registradas aparecerán aquí.'
                : hasDateFilter
                  ? 'Prueba otro rango de fechas o término de búsqueda.'
                  : 'Las ventas del día aparecerán aquí. Para ver días anteriores, elige un rango de fechas.'}
            </p>
          </div>
        ) : (
          <div className="finance-table-wrap">
            <table className="finance-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Nº venta</th>
                  <th>Cajero</th>
                  <th>Cliente</th>
                  <th>Total</th>
                  <th>En caja</th>
                  <th>A crédito</th>
                  <th>Estado</th>
                  {canDeleteForTesting && <th className="table-actions-col">Prueba</th>}
                </tr>
              </thead>
              <tbody>
                {pagination.paginatedItems.map((sale, index) => (
                  <AnimatedTableRow
                    key={sale.id}
                    index={index}
                    className="finance-clickable-row"
                    onClick={() => openSaleDetail(sale)}
                  >
                    <td>{formatDate(sale.createdAt)}</td>
                    <td>
                      <strong>{sale.number}</strong>
                    </td>
                    <td>{sale.cashierName || '—'}</td>
                    <td>{sale.clientName ?? '—'}</td>
                    <td>
                      <MoneyText amount={sale.total} />
                    </td>
                    <td>
                      <MoneyText amount={sale.cashPaid ?? 0} />
                    </td>
                    <td>
                      <MoneyText amount={sale.creditPaid ?? 0} />
                    </td>
                    <td>
                      <span
                        className={`finance-badge ${
                          sale.paymentStatus === 'paid' ? 'ok' : 'inactive'
                        }`}
                      >
                        {paymentStatusLabels[sale.paymentStatus] ?? sale.paymentStatus}
                      </span>
                    </td>
                    {canDeleteForTesting && (
                      <td className="table-actions-col" onClick={(event) => event.stopPropagation()}>
                        <TableActions>
                          <TableAction
                            icon="delete"
                            tone="danger"
                            disabled={deletingId === sale.id}
                            onClick={() => handleDeleteSale(sale)}
                          >
                            {deletingId === sale.id ? 'Borrando...' : 'Borrar'}
                          </TableAction>
                        </TableActions>
                      </td>
                    )}
                  </AnimatedTableRow>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && filteredSales.length > 0 && (
          <TablePagination
            page={pagination.page}
            totalPages={pagination.totalPages}
            totalItems={pagination.totalItems}
            pageSize={pagination.pageSize}
            onPageChange={pagination.setPage}
          />
        )}
      </AnimatedPanel>

      <SaleDetailModal
        open={detailOpen}
        sale={selectedSale}
        items={detailItems}
        payments={detailPayments}
        canViewProfit={canViewProfit}
        canDeleteForTesting={canDeleteForTesting}
        deleting={Boolean(selectedSale && deletingId === selectedSale.id)}
        loading={detailLoading}
        printingTicket={detailPrintingTicket}
        printTicketError={detailPrintError}
        onClose={() => {
          setDetailOpen(false)
          setSelectedSale(null)
          setDetailPrintError('')
        }}
        onDelete={
          selectedSale && canDeleteForTesting
            ? () => handleDeleteSale(selectedSale)
            : undefined
        }
        onPrintTicket={handlePrintSelectedSaleTicket}
      />
    </AppLayout>
  )
}
