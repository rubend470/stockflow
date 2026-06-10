import { useEffect, useMemo, useState } from 'react'
import { AppLayout } from '../../../components/layout/AppLayout'
import { PurchaseInvoiceFormModal } from '../../../components/inventory/PurchaseInvoiceFormModal'
import { PurchaseInvoiceSalePriceModal } from '../../../components/inventory/PurchaseInvoiceSalePriceModal'
import { AnimatedPanel, AnimatedTableRow } from '../../../components/ui/motion'
import { TableAction, TableActions } from '../../../components/ui/TableActions'
import { TablePagination } from '../../../components/ui/TablePagination'
import { usePagination } from '../../../hooks/usePagination'
import { useAuth } from '../../../context/AuthContext'
import { listCurrencies } from '../../../services/financeService'
import { createProduct, listAllProducts } from '../../../services/productService'
import {
  applySalePriceUpdates,
  cancelPurchaseInvoice,
  createAndReceivePurchaseInvoice,
  listOpenPurchaseInvoices,
  listPurchaseInvoices,
  receivePurchaseInvoice,
  registerPurchaseInvoicePayment,
} from '../../../services/purchaseInvoiceService'
import { listStockCategories } from '../../../services/stockCategoryService'
import type { Currency } from '../../../types/finance'
import type { Product, ProductFormInput } from '../../../types/product'
import type { CreatePurchaseInvoiceInput, PurchaseInvoice, ReceivedProductLine } from '../../../types/purchaseInvoice'
import { purchaseInvoiceStatusLabels } from '../../../types/purchaseInvoice'
import type { StockCategory } from '../../../types/stockCategory'
import { MoneyInput } from '../../../components/ui/MoneyInput'
import { formatBaseMoney, formatMoney, parseMoneyInput } from '../../../utils/formatMoney'

function formatDate(value: string) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('es', { dateStyle: 'medium' }).format(new Date(value))
}

export function PendingInvoicesPage() {
  const { user } = useAuth()
  const [invoices, setInvoices] = useState<PurchaseInvoice[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [currencies, setCurrencies] = useState<Currency[]>([])
  const [stockCategories, setStockCategories] = useState<StockCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [creatingProduct, setCreatingProduct] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [paymentAmounts, setPaymentAmounts] = useState<Record<string, string>>({})
  const [salePriceModalOpen, setSalePriceModalOpen] = useState(false)
  const [salePriceLines, setSalePriceLines] = useState<ReceivedProductLine[]>([])
  const [lastInvoiceNumber, setLastInvoiceNumber] = useState('')

  const canManage = user?.role === 'super_admin' || user?.role === 'admin'
  const canViewCost = user?.role !== 'cashier'

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    setError('')

    try {
      const [invoiceList, productList, currencyList, categoryList] = await Promise.all([
        listPurchaseInvoices(),
        listAllProducts(),
        listCurrencies(),
        listStockCategories(),
      ])
      setInvoices(invoiceList)
      setProducts(productList.filter((product) => product.active))
      setCurrencies(currencyList)
      setStockCategories(categoryList.filter((category) => category.active))
    } catch {
      setError('No se pudieron cargar las facturas de entrada.')
    } finally {
      setLoading(false)
    }
  }

  const openInvoices = useMemo(() => listOpenPurchaseInvoices(invoices), [invoices])

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return openInvoices

    return openInvoices.filter(
      (invoice) =>
        invoice.number.toLowerCase().includes(query) ||
        invoice.supplierName.toLowerCase().includes(query) ||
        invoice.supplierInvoiceNumber?.toLowerCase().includes(query),
    )
  }, [openInvoices, search])

  const pagination = usePagination(filtered, 10)

  const stats = useMemo(() => {
    const pendingEntry = openInvoices.filter((invoice) => invoice.status === 'pending').length
    const totalDueInBase = openInvoices.reduce((sum, invoice) => {
      if (invoice.totalAmount <= 0.01) return sum + invoice.amountDue
      return sum + invoice.amountInBase * (invoice.amountDue / invoice.totalAmount)
    }, 0)
    const totalAmountInBase = openInvoices.reduce((sum, invoice) => sum + invoice.amountInBase, 0)

    return {
      pendingEntry,
      totalDueInBase,
      totalAmountInBase,
      count: openInvoices.length,
    }
  }, [openInvoices])

  async function handleCreateProduct(values: ProductFormInput): Promise<string | null> {
    if (!user) return null

    setCreatingProduct(true)
    setError('')

    try {
      const productId = await createProduct(values, user.uid)
      const created = await listAllProducts()
      setProducts(created.filter((product) => product.active))
      setMessage('Producto creado. Selecciónalo en la línea de la factura.')
      return productId
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear el producto.')
      return null
    } finally {
      setCreatingProduct(false)
    }
  }

  async function handleCreate(values: CreatePurchaseInvoiceInput) {
    if (!user) return

    setSubmitting(true)
    setError('')
    setMessage('')

    try {
      const result = await createAndReceivePurchaseInvoice(values, user.uid, user.name)
      setModalOpen(false)
      setLastInvoiceNumber(result.number)
      setSalePriceLines(result.receivedLines)
      setSalePriceModalOpen(result.receivedLines.length > 0)
      if (result.receivedLines.length === 0) {
        setMessage(`Entrada ${result.number} registrada e inventario actualizado.`)
      }
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo registrar la factura.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleApplySalePrices(updates: Array<{ productId: string; salePrice: number }>) {
    setSubmitting(true)
    setError('')

    try {
      await applySalePriceUpdates(updates)
      setMessage(
        `Entrada ${lastInvoiceNumber} registrada. Se actualizaron ${updates.length} precio(s) de venta.`,
      )
      setSalePriceModalOpen(false)
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron actualizar los precios.')
    } finally {
      setSubmitting(false)
    }
  }

  function handleSkipSalePrices() {
    setSalePriceModalOpen(false)
    setMessage(`Entrada ${lastInvoiceNumber} registrada e inventario actualizado.`)
  }

  async function handleReceive(invoice: PurchaseInvoice) {
    if (!user) return

    setSubmitting(true)
    setError('')
    setMessage('')

    try {
      await receivePurchaseInvoice(invoice.id, user.uid, user.name)
      setMessage(`Entrada registrada para la factura ${invoice.number}.`)
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo registrar la entrada.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handlePayment(invoice: PurchaseInvoice) {
    const amount = parseMoneyInput(paymentAmounts[invoice.id] ?? '')
    if (!amount || amount <= 0) {
      setError('Ingresa un monto válido para el pago.')
      return
    }

    setSubmitting(true)
    setError('')
    setMessage('')

    try {
      await registerPurchaseInvoicePayment(invoice.id, amount)
      setMessage(`Pago registrado en factura ${invoice.number}.`)
      setPaymentAmounts((current) => ({ ...current, [invoice.id]: '' }))
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo registrar el pago.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleCancel(invoice: PurchaseInvoice) {
    setSubmitting(true)
    setError('')
    setMessage('')

    try {
      await cancelPurchaseInvoice(invoice.id)
      setMessage(`Factura ${invoice.number} anulada.`)
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo anular la factura.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AppLayout
      title="Entradas de mercancía"
      subtitle="Registra lo que llega del proveedor y actualiza inventario"
    >
      <AnimatedPanel className="finance-panel">
        <div className="finance-panel-header">
          <div>
            <h2>Facturas de proveedor</h2>
            <p>
              Al registrar una entrada, el stock y el costo se actualizan de inmediato. Aquí ves
              también lo que falta por pagar al proveedor.
            </p>
          </div>
          <div className="finance-panel-actions">
            <button type="button" className="finance-btn finance-btn-secondary" onClick={loadData}>
              Actualizar
            </button>
            {canManage && (
              <button
                type="button"
                className="finance-btn finance-btn-primary"
                onClick={() => setModalOpen(true)}
              >
                Registrar entrada
              </button>
            )}
          </div>
        </div>

        <div className="finance-stats">
          <article>
            <span>Facturas abiertas</span>
            <strong>{stats.count}</strong>
          </article>
          {stats.pendingEntry > 0 && (
            <article>
              <span>Legacy sin entrada</span>
              <strong>{stats.pendingEntry}</strong>
            </article>
          )}
          <article>
            <span>Total (equiv. COP)</span>
            <strong>{formatBaseMoney(stats.totalAmountInBase)}</strong>
          </article>
          <article>
            <span>Por pagar (aprox. COP)</span>
            <strong>{formatBaseMoney(stats.totalDueInBase)}</strong>
          </article>
        </div>

        <div className="finance-filters">
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por número, proveedor o factura..."
          />
        </div>

        {error && <div className="alert alert-error">{error}</div>}
        {message && <div className="alert alert-success">{message}</div>}

        {loading ? (
          <div className="finance-empty">Cargando facturas...</div>
        ) : filtered.length === 0 ? (
          <div className="finance-empty">
            <strong>Sin facturas abiertas</strong>
            <p>
              Registra la mercancía que llegue del proveedor. El inventario se actualiza al guardar.
            </p>
            {canManage && (
              <button
                type="button"
                className="finance-btn finance-btn-primary"
                onClick={() => setModalOpen(true)}
              >
                Registrar entrada
              </button>
            )}
          </div>
        ) : (
          <div className="finance-table-wrap">
            <table className="finance-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Nº interno</th>
                  <th>Proveedor</th>
                  <th>Moneda</th>
                  <th>Total</th>
                  <th>Pagado</th>
                  <th>Por pagar</th>
                  <th>Estado</th>
                  <th>Productos</th>
                  {canManage && <th className="table-actions-col">Acciones</th>}
                </tr>
              </thead>
              <tbody>
                {pagination.paginatedItems.map((invoice, index) => (
                  <AnimatedTableRow key={invoice.id} index={index}>
                    <td>{formatDate(invoice.createdAt)}</td>
                    <td>
                      <strong>{invoice.number}</strong>
                      {invoice.supplierInvoiceNumber && (
                        <small className="exchange-method-hint">
                          Prov. {invoice.supplierInvoiceNumber}
                        </small>
                      )}
                    </td>
                    <td>{invoice.supplierName}</td>
                    <td>{invoice.currencyCode}</td>
                    <td>{formatMoney(invoice.totalAmount, invoice.currencyCode)}</td>
                    <td>{formatMoney(invoice.amountPaid, invoice.currencyCode)}</td>
                    <td>{formatMoney(invoice.amountDue, invoice.currencyCode)}</td>
                    <td>
                      <span className="finance-badge inactive">
                        {purchaseInvoiceStatusLabels[invoice.status]}
                      </span>
                    </td>
                    <td>
                      <span className="inventory-subtext">{invoice.lines.length} línea(s)</span>
                    </td>
                    {canManage && (
                      <td className="table-actions-col">
                        <div className="purchase-invoice-actions">
                          {invoice.status === 'pending' && (
                            <TableActions>
                              <TableAction
                                icon="receive"
                                tone="primary"
                                disabled={submitting}
                                onClick={() => handleReceive(invoice)}
                              >
                                Entrada
                              </TableAction>
                              <TableAction
                                icon="cancel"
                                tone="danger"
                                disabled={submitting}
                                onClick={() => handleCancel(invoice)}
                              >
                                Anular
                              </TableAction>
                            </TableActions>
                          )}
                          {invoice.amountDue > 0.01 && invoice.status !== 'pending' && (
                            <div className="purchase-invoice-pay-row">
                              <MoneyInput
                                placeholder="Monto"
                                value={paymentAmounts[invoice.id] ?? ''}
                                onChange={(next) =>
                                  setPaymentAmounts((current) => ({
                                    ...current,
                                    [invoice.id]: next,
                                  }))
                                }
                              />
                              <TableAction
                                icon="pay"
                                tone="primary"
                                disabled={submitting}
                                onClick={() => handlePayment(invoice)}
                              >
                                Pagar
                              </TableAction>
                            </div>
                          )}
                        </div>
                      </td>
                    )}
                  </AnimatedTableRow>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <TablePagination
            page={pagination.page}
            totalPages={pagination.totalPages}
            totalItems={pagination.totalItems}
            pageSize={pagination.pageSize}
            onPageChange={pagination.setPage}
          />
        )}
      </AnimatedPanel>

      <PurchaseInvoiceFormModal
        open={modalOpen}
        products={products}
        currencies={currencies}
        stockCategories={stockCategories}
        canViewCost={canViewCost}
        submitting={submitting}
        creatingProduct={creatingProduct}
        onClose={() => setModalOpen(false)}
        onSubmit={handleCreate}
        onCreateProduct={handleCreateProduct}
      />

      <PurchaseInvoiceSalePriceModal
        open={salePriceModalOpen}
        invoiceNumber={lastInvoiceNumber}
        lines={salePriceLines}
        submitting={submitting}
        onClose={handleSkipSalePrices}
        onSkip={handleSkipSalePrices}
        onApply={handleApplySalePrices}
      />
    </AppLayout>
  )
}
