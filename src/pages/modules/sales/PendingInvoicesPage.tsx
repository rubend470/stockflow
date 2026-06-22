import { useEffect, useMemo, useState } from 'react'
import { AppLayout } from '../../../components/layout/AppLayout'
import { PurchaseInvoiceDetailModal } from '../../../components/inventory/PurchaseInvoiceDetailModal'
import { PurchaseInvoiceFormModal } from '../../../components/inventory/PurchaseInvoiceFormModal'
import { AnimatedPanel, AnimatedTableRow } from '../../../components/ui/motion'
import { TableAction, TableActions } from '../../../components/ui/TableActions'
import { TablePagination } from '../../../components/ui/TablePagination'
import { usePagination } from '../../../hooks/usePagination'
import { useAuth } from '../../../context/AuthContext'
import { listCurrencies } from '../../../services/financeService'
import { createProduct, listAllProducts } from '../../../services/productService'
import {
  cancelPurchaseInvoice,
  createAndReceivePurchaseInvoice,
  listOpenPurchaseInvoices,
  listPurchaseInvoices,
  listVisiblePurchaseInvoices,
  receivePurchaseInvoice,
  registerPurchaseInvoicePayment,
  updatePurchaseInvoice,
} from '../../../services/purchaseInvoiceService'
import { listStockCategories } from '../../../services/stockCategoryService'
import { listSuppliers } from '../../../services/supplierService'
import type { Supplier } from '../../../types/supplier'
import type { Currency } from '../../../types/finance'
import type { Product, ProductFormInput } from '../../../types/product'
import type {
  CreatePurchaseInvoiceInput,
  PurchaseInvoice,
  UpdatePurchaseInvoiceInput,
} from '../../../types/purchaseInvoice'
import { formatInvoiceListDate } from '../../../utils/invoiceDate'
import { purchaseInvoiceStatusLabels } from '../../../types/purchaseInvoice'
import type { StockCategory } from '../../../types/stockCategory'
import { formatBaseMoney, formatMoney } from '../../../utils/formatMoney'
import { userCanViewCost, userHasMenuPermission } from '../../../utils/menuPermissions'

export function PendingInvoicesPage() {
  const { user } = useAuth()
  const [invoices, setInvoices] = useState<PurchaseInvoice[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [currencies, setCurrencies] = useState<Currency[]>([])
  const [stockCategories, setStockCategories] = useState<StockCategory[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [creatingProduct, setCreatingProduct] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [detailInvoice, setDetailInvoice] = useState<PurchaseInvoice | null>(null)

  const canManage = userHasMenuPermission(user, 'pending-invoices')
  const canViewCost = userCanViewCost(user)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    setError('')

    try {
      const [invoiceList, productList, currencyList, categoryList, supplierList] =
        await Promise.all([
        listPurchaseInvoices(),
        listAllProducts(),
        listCurrencies(),
        listStockCategories(),
        listSuppliers(),
      ])
      setInvoices(invoiceList)
      setProducts(productList.filter((product) => product.active))
      setCurrencies(currencyList)
      setStockCategories(categoryList.filter((category) => category.active))
      setSuppliers(supplierList)
    } catch {
      setError('No se pudieron cargar las facturas de entrada.')
    } finally {
      setLoading(false)
    }
  }

  const visibleInvoices = useMemo(() => listVisiblePurchaseInvoices(invoices), [invoices])
  const openInvoices = useMemo(() => listOpenPurchaseInvoices(invoices), [invoices])

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return visibleInvoices

    return visibleInvoices.filter(
      (invoice) =>
        invoice.number.toLowerCase().includes(query) ||
        invoice.supplierName.toLowerCase().includes(query) ||
        invoice.supplierInvoiceNumber?.toLowerCase().includes(query),
    )
  }, [visibleInvoices, search])

  const pagination = usePagination(filtered, 10)

  const stats = useMemo(() => {
    const pendingEntry = visibleInvoices.filter((invoice) => invoice.status === 'pending').length
    const totalDueInBase = visibleInvoices.reduce((sum, invoice) => {
      if (invoice.amountDue <= 0.01) return sum
      if (invoice.totalAmount <= 0.01) return sum + invoice.amountDue
      return sum + invoice.amountInBase * (invoice.amountDue / invoice.totalAmount)
    }, 0)
    const totalAmountInBase = visibleInvoices.reduce((sum, invoice) => sum + invoice.amountInBase, 0)

    return {
      pendingEntry,
      totalDueInBase,
      totalAmountInBase,
      count: visibleInvoices.length,
      openCount: openInvoices.length,
      paidCount: visibleInvoices.filter((invoice) => invoice.status === 'paid').length,
    }
  }, [visibleInvoices, openInvoices])

  async function handleCreateProduct(values: ProductFormInput): Promise<string | null> {
    if (!user) return null

    setCreatingProduct(true)
    setError('')

    try {
      const productId = await createProduct(values, user.uid)
      const created = await listAllProducts()
      setProducts(created.filter((product) => product.active))
      setMessage('Producto creado y vinculado a la línea.')
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
      setMessage(`Entrada ${result.number} registrada e inventario actualizado.`)
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo registrar la factura.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleSaveDetail(invoiceId: string, values: UpdatePurchaseInvoiceInput) {
    if (!user) return

    setSubmitting(true)
    setError('')
    setMessage('')

    try {
      await updatePurchaseInvoice(invoiceId, values, user.uid, user.name)
      const updated = await listPurchaseInvoices()
      setInvoices(updated)
      const refreshed = updated.find((invoice) => invoice.id === invoiceId) ?? null
      setDetailInvoice(refreshed)
      setMessage('Factura actualizada.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar la factura.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDetailPayment(invoiceId: string, amount: number) {
    setSubmitting(true)
    setError('')
    setMessage('')

    try {
      await registerPurchaseInvoicePayment(invoiceId, amount)
      const updated = await listPurchaseInvoices()
      setInvoices(updated)
      setDetailInvoice(updated.find((invoice) => invoice.id === invoiceId) ?? null)
      setMessage('Abono registrado.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo registrar el abono.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDetailMarkPaid(invoiceId: string) {
    const invoice = invoices.find((entry) => entry.id === invoiceId)
    if (!invoice || invoice.amountDue <= 0) return

    setSubmitting(true)
    setError('')
    setMessage('')

    try {
      await registerPurchaseInvoicePayment(invoiceId, invoice.amountDue)
      const updated = await listPurchaseInvoices()
      setInvoices(updated)
      setDetailInvoice(updated.find((entry) => entry.id === invoiceId) ?? null)
      setMessage('Factura marcada como pagada.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo marcar como pagada.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleReceive(invoice: PurchaseInvoice) {
    if (!user) return

    setSubmitting(true)
    setError('')
    setMessage('')

    try {
      await receivePurchaseInvoice(invoice.id, user.uid, user.name)
      const updated = await listPurchaseInvoices()
      setInvoices(updated)
      setDetailInvoice(updated.find((entry) => entry.id === invoice.id) ?? null)
      setMessage(`Entrada registrada para la factura ${invoice.number}.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo registrar la entrada.')
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
      setDetailInvoice(null)
      await loadData()
      setMessage(`Factura ${invoice.number} anulada.`)
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
              Historial de entradas al inventario. Las pagadas siguen aquí para consultarlas; el
              saldo pendiente es solo lo que falta por pagar al proveedor.
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
            <span>Entradas registradas</span>
            <strong>{stats.count}</strong>
          </article>
          <article>
            <span>Pagadas</span>
            <strong>{stats.paidCount}</strong>
          </article>
          <article>
            <span>Por pagar (facturas)</span>
            <strong>{stats.openCount}</strong>
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
            <strong>Sin entradas registradas</strong>
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
                    <td>{formatInvoiceListDate(invoice)}</td>
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
                      <span
                        className={`finance-badge ${
                          invoice.status === 'paid' ? 'ok' : 'inactive'
                        }`}
                      >
                        {purchaseInvoiceStatusLabels[invoice.status]}
                      </span>
                    </td>
                    <td>
                      <span className="inventory-subtext">{invoice.lines.length} línea(s)</span>
                    </td>
                    {canManage && (
                      <td className="table-actions-col">
                        <TableActions>
                          <TableAction
                            icon="view"
                            disabled={submitting}
                            onClick={() => setDetailInvoice(invoice)}
                          >
                            Ver
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

      <PurchaseInvoiceDetailModal
        open={detailInvoice !== null}
        invoice={detailInvoice}
        products={products}
        suppliers={suppliers}
        stockCategories={stockCategories}
        canViewCost={canViewCost}
        submitting={submitting}
        creatingProduct={creatingProduct}
        onClose={() => setDetailInvoice(null)}
        onSave={handleSaveDetail}
        onPayment={handleDetailPayment}
        onMarkPaid={handleDetailMarkPaid}
        onCreateProduct={handleCreateProduct}
        onReceive={handleReceive}
        onCancel={handleCancel}
      />

      <PurchaseInvoiceFormModal
        open={modalOpen}
        products={products}
        suppliers={suppliers}
        currencies={currencies}
        stockCategories={stockCategories}
        canViewCost={canViewCost}
        submitting={submitting}
        creatingProduct={creatingProduct}
        onClose={() => setModalOpen(false)}
        onSubmit={handleCreate}
        onCreateProduct={handleCreateProduct}
      />
    </AppLayout>
  )
}
