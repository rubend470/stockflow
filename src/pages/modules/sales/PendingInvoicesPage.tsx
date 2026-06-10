import { useEffect, useMemo, useState } from 'react'
import { AppLayout } from '../../../components/layout/AppLayout'
import { PurchaseInvoiceFormModal } from '../../../components/inventory/PurchaseInvoiceFormModal'
import { AnimatedPanel, AnimatedTableRow } from '../../../components/ui/motion'
import { TableAction, TableActions } from '../../../components/ui/TableActions'
import { TablePagination } from '../../../components/ui/TablePagination'
import { usePagination } from '../../../hooks/usePagination'
import { useAuth } from '../../../context/AuthContext'
import { listAllProducts } from '../../../services/productService'
import {
  cancelPurchaseInvoice,
  createPurchaseInvoice,
  listOpenPurchaseInvoices,
  listPurchaseInvoices,
  receivePurchaseInvoice,
  registerPurchaseInvoicePayment,
} from '../../../services/purchaseInvoiceService'
import type { Product } from '../../../types/product'
import type { CreatePurchaseInvoiceInput, PurchaseInvoice } from '../../../types/purchaseInvoice'
import { purchaseInvoiceStatusLabels } from '../../../types/purchaseInvoice'
import { MoneyInput } from '../../../components/ui/MoneyInput'
import { formatBaseMoney, parseMoneyInput } from '../../../utils/formatMoney'

function formatDate(value: string) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('es', { dateStyle: 'medium' }).format(new Date(value))
}

export function PendingInvoicesPage() {
  const { user } = useAuth()
  const [invoices, setInvoices] = useState<PurchaseInvoice[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [paymentAmounts, setPaymentAmounts] = useState<Record<string, string>>({})

  const canManage = user?.role === 'super_admin' || user?.role === 'admin'

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    setError('')

    try {
      const [invoiceList, productList] = await Promise.all([
        listPurchaseInvoices(),
        listAllProducts(),
      ])
      setInvoices(invoiceList)
      setProducts(productList.filter((product) => product.active))
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
        invoice.supplierName.toLowerCase().includes(query),
    )
  }, [openInvoices, search])

  const pagination = usePagination(filtered, 10)

  const stats = useMemo(() => {
    const pendingEntry = openInvoices.filter((invoice) => invoice.status === 'pending').length
    const totalDue = openInvoices.reduce((sum, invoice) => sum + invoice.amountDue, 0)
    const totalAmount = openInvoices.reduce((sum, invoice) => sum + invoice.totalAmount, 0)

    return { pendingEntry, totalDue, totalAmount, count: openInvoices.length }
  }, [openInvoices])

  async function handleCreate(values: CreatePurchaseInvoiceInput) {
    if (!user) return

    setSubmitting(true)
    setError('')
    setMessage('')

    try {
      await createPurchaseInvoice(values, user.uid)
      setMessage('Factura de entrada registrada.')
      setModalOpen(false)
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo registrar la factura.')
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
      title="Facturas pendientes"
      subtitle="Entradas de mercancía por proveedor"
    >
      <AnimatedPanel className="finance-panel">
        <div className="finance-panel-header">
          <div>
            <h2>Facturas de entrada</h2>
            <p>
              Mercancía que aún no ha ingresado al inventario o facturas de proveedor por pagar.
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
                Nueva factura
              </button>
            )}
          </div>
        </div>

        <div className="finance-stats">
          <article>
            <span>Facturas abiertas</span>
            <strong>{stats.count}</strong>
          </article>
          <article>
            <span>Pendientes de entrada</span>
            <strong>{stats.pendingEntry}</strong>
          </article>
          <article>
            <span>Total facturado</span>
            <strong>{formatBaseMoney(stats.totalAmount)}</strong>
          </article>
          <article>
            <span>Por pagar</span>
            <strong>{formatBaseMoney(stats.totalDue)}</strong>
          </article>
        </div>

        <div className="finance-filters">
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por número o proveedor..."
          />
        </div>

        {error && <div className="alert alert-error">{error}</div>}
        {message && <div className="alert alert-success">{message}</div>}

        {loading ? (
          <div className="finance-empty">Cargando facturas...</div>
        ) : filtered.length === 0 ? (
          <div className="finance-empty">
            <strong>Sin facturas pendientes</strong>
            <p>
              Aquí verás las compras a proveedores que aún no han entrado al inventario o que faltan
              por pagar.
            </p>
            {canManage && (
              <button
                type="button"
                className="finance-btn finance-btn-primary"
                onClick={() => setModalOpen(true)}
              >
                Registrar factura de entrada
              </button>
            )}
          </div>
        ) : (
          <div className="finance-table-wrap">
            <table className="finance-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Nº factura</th>
                  <th>Proveedor</th>
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
                    </td>
                    <td>{invoice.supplierName}</td>
                    <td>{formatBaseMoney(invoice.totalAmount)}</td>
                    <td>{formatBaseMoney(invoice.amountPaid)}</td>
                    <td>{formatBaseMoney(invoice.amountDue)}</td>
                    <td>
                      <span className="finance-badge inactive">
                        {purchaseInvoiceStatusLabels[invoice.status]}
                      </span>
                    </td>
                    <td>
                      <span className="inventory-subtext">
                        {invoice.lines.length} línea(s)
                        {invoice.expectedDate ? ` · Esperada ${formatDate(invoice.expectedDate)}` : ''}
                      </span>
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
        submitting={submitting}
        onClose={() => setModalOpen(false)}
        onSubmit={handleCreate}
      />
    </AppLayout>
  )
}
