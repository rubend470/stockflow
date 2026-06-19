import { useEffect, useMemo, useState } from 'react'
import { AppLayout } from '../../../components/layout/AppLayout'
import { PurchaseInvoiceDetailModal } from '../../../components/inventory/PurchaseInvoiceDetailModal'
import { SupplierDetailModal } from '../../../components/suppliers/SupplierDetailModal'
import { SupplierFormModal } from '../../../components/suppliers/SupplierFormModal'
import { AnimatedPanel, AnimatedTableRow } from '../../../components/ui/motion'
import { TableAction, TableActions } from '../../../components/ui/TableActions'
import { TablePagination } from '../../../components/ui/TablePagination'
import { usePagination } from '../../../hooks/usePagination'
import { useAuth } from '../../../context/AuthContext'
import { useConfirm } from '../../../context/ConfirmContext'
import { createProduct, listAllProducts } from '../../../services/productService'
import {
  cancelPurchaseInvoice,
  listPurchaseInvoices,
  receivePurchaseInvoice,
  registerPurchaseInvoicePayment,
  updatePurchaseInvoice,
} from '../../../services/purchaseInvoiceService'
import { listStockCategories } from '../../../services/stockCategoryService'
import {
  createSupplier,
  deleteSupplier,
  listAllSuppliers,
  updateSupplier,
} from '../../../services/supplierService'
import type { Product, ProductFormInput } from '../../../types/product'
import type { PurchaseInvoice, UpdatePurchaseInvoiceInput } from '../../../types/purchaseInvoice'
import type { StockCategory } from '../../../types/stockCategory'
import {
  emptySupplierForm,
  supplierFormFromSupplier,
  type Supplier,
  type SupplierFormInput,
} from '../../../types/supplier'
import { listInvoicesForSupplier } from '../../../utils/supplierInvoices'
import { userCanViewCost, userHasMenuPermission } from '../../../utils/menuPermissions'

export function SuppliersPage() {
  const { user } = useAuth()
  const confirm = useConfirm()
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [invoices, setInvoices] = useState<PurchaseInvoice[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [search, setSearch] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create')
  const [formValues, setFormValues] = useState<SupplierFormInput>(emptySupplierForm())
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null)
  const [detailSupplier, setDetailSupplier] = useState<Supplier | null>(null)
  const [detailInvoice, setDetailInvoice] = useState<PurchaseInvoice | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [stockCategories, setStockCategories] = useState<StockCategory[]>([])
  const [creatingProduct, setCreatingProduct] = useState(false)

  const canManage = userHasMenuPermission(user, 'suppliers')
  const canViewCost = userCanViewCost(user)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    setError('')

    const [suppliersResult, invoicesResult, productsResult, categoriesResult] =
      await Promise.allSettled([
        listAllSuppliers(),
        listPurchaseInvoices(),
        listAllProducts(),
        listStockCategories(),
      ])

    if (suppliersResult.status === 'fulfilled') {
      setSuppliers(suppliersResult.value)
    } else {
      const detail =
        suppliersResult.reason instanceof Error
          ? suppliersResult.reason.message
          : 'Error desconocido'
      setError(`No se pudieron cargar los proveedores. ${detail}`)
      console.error('SuppliersPage loadData suppliers:', suppliersResult.reason)
    }

    if (invoicesResult.status === 'fulfilled') {
      setInvoices(invoicesResult.value)
    } else {
      console.error('SuppliersPage loadData invoices:', invoicesResult.reason)
      if (suppliersResult.status === 'fulfilled') {
        setError('Proveedores cargados, pero no se pudo obtener el historial de facturas.')
      }
    }

    if (productsResult.status === 'fulfilled') {
      setProducts(productsResult.value.filter((product) => product.active))
    }

    if (categoriesResult.status === 'fulfilled') {
      setStockCategories(categoriesResult.value.filter((category) => category.active))
    }

    setLoading(false)
  }

  async function refreshInvoices(invoiceId?: string) {
    const updated = await listPurchaseInvoices()
    setInvoices(updated)
    if (invoiceId) {
      setDetailInvoice(updated.find((invoice) => invoice.id === invoiceId) ?? null)
    }
    return updated
  }

  async function handleCreateProduct(values: ProductFormInput): Promise<string | null> {
    if (!user) return null

    setCreatingProduct(true)
    setError('')

    try {
      const productId = await createProduct(values, user.uid)
      const productList = await listAllProducts()
      setProducts(productList.filter((product) => product.active))
      return productId
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear el producto.')
      return null
    } finally {
      setCreatingProduct(false)
    }
  }

  async function handleSaveDetail(invoiceId: string, values: UpdatePurchaseInvoiceInput) {
    if (!user) return

    setSubmitting(true)
    setError('')
    setMessage('')

    try {
      await updatePurchaseInvoice(invoiceId, values, user.uid, user.name)
      await refreshInvoices(invoiceId)
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
      await refreshInvoices(invoiceId)
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
      await refreshInvoices(invoiceId)
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
      await refreshInvoices(invoice.id)
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

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return suppliers

    return suppliers.filter(
      (supplier) =>
        supplier.name.toLowerCase().includes(query) ||
        supplier.phone?.includes(query) ||
        supplier.taxId?.toLowerCase().includes(query) ||
        supplier.email?.toLowerCase().includes(query),
    )
  }, [suppliers, search])

  const pagination = usePagination(filtered, 12)

  const detailInvoices = useMemo(() => {
    if (!detailSupplier) return []
    return listInvoicesForSupplier(invoices, detailSupplier)
  }, [detailSupplier, invoices])

  function openCreate() {
    setFormMode('create')
    setEditingSupplier(null)
    setFormValues(emptySupplierForm())
    setFormOpen(true)
  }

  function openEdit(supplier: Supplier) {
    setFormMode('edit')
    setEditingSupplier(supplier)
    setFormValues(supplierFormFromSupplier(supplier))
    setDetailSupplier(null)
    setFormOpen(true)
  }

  async function handleSubmit(values: SupplierFormInput) {
    setSubmitting(true)
    setError('')
    setMessage('')

    try {
      if (formMode === 'create') {
        await createSupplier(values)
        setMessage('Proveedor creado.')
      } else if (editingSupplier) {
        await updateSupplier(editingSupplier.id, values)
        setMessage('Proveedor actualizado.')
      }

      setFormOpen(false)
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el proveedor.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(supplier: Supplier) {
    const related = listInvoicesForSupplier(invoices, supplier)
    if (related.length > 0) {
      setError('No puedes eliminar un proveedor con facturas registradas.')
      return
    }

    const confirmed = await confirm({
      title: 'Eliminar proveedor',
      message: `¿Eliminar a ${supplier.name}?`,
      confirmLabel: 'Eliminar',
      tone: 'danger',
    })
    if (!confirmed) return

    setSubmitting(true)
    setError('')

    try {
      await deleteSupplier(supplier.id)
      setMessage('Proveedor eliminado.')
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar el proveedor.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AppLayout
      title="Proveedores"
      subtitle="Directorio de proveedores y historial de entradas de mercancía"
    >
      <AnimatedPanel className="finance-panel">
        <div className="finance-panel-header">
          <div>
            <h2>Proveedores</h2>
            <p>
              Al registrar una entrada puedes escribir el nombre y, si no existe, se crea solo con
              ese dato.
            </p>
          </div>
          {canManage && (
            <div className="finance-panel-actions">
              <button
                type="button"
                className="finance-btn finance-btn-secondary"
                onClick={loadData}
              >
                Actualizar
              </button>
              <button type="button" className="finance-btn finance-btn-primary" onClick={openCreate}>
                Nuevo proveedor
              </button>
            </div>
          )}
        </div>

        <div className="finance-filters">
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por nombre, teléfono o NIT..."
          />
        </div>

        {error && <div className="alert alert-error">{error}</div>}
        {message && <div className="alert alert-success">{message}</div>}

        {loading ? (
          <div className="finance-empty">Cargando proveedores...</div>
        ) : filtered.length === 0 ? (
          <div className="finance-empty">
            <strong>Sin proveedores</strong>
            <p>Se crearán automáticamente al registrar entradas de mercancía.</p>
            {canManage && (
              <button type="button" className="finance-btn finance-btn-primary" onClick={openCreate}>
                Nuevo proveedor
              </button>
            )}
          </div>
        ) : (
          <div className="finance-table-wrap">
            <table className="finance-table">
              <thead>
                <tr>
                  <th>Proveedor</th>
                  <th>Teléfono</th>
                  <th>NIT / RIF</th>
                  <th>Facturas</th>
                  <th>Estado</th>
                  <th className="table-actions-col">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {pagination.paginatedItems.map((supplier, index) => {
                  const invoiceCount = listInvoicesForSupplier(invoices, supplier).length
                  return (
                    <AnimatedTableRow key={supplier.id} index={index}>
                      <td>
                        <strong>{supplier.name}</strong>
                        {supplier.email && (
                          <small className="exchange-method-hint">{supplier.email}</small>
                        )}
                      </td>
                      <td>{supplier.phone || '—'}</td>
                      <td>{supplier.taxId || '—'}</td>
                      <td>{invoiceCount}</td>
                      <td>
                        <span className={`finance-badge ${supplier.active ? 'ok' : 'inactive'}`}>
                          {supplier.active ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td className="table-actions-col">
                        <TableActions>
                          <TableAction icon="view" onClick={() => setDetailSupplier(supplier)}>
                            Ver
                          </TableAction>
                          {canManage && (
                            <>
                              <TableAction icon="edit" onClick={() => openEdit(supplier)}>
                                Editar
                              </TableAction>
                              <TableAction
                                icon="delete"
                                tone="danger"
                                disabled={submitting}
                                onClick={() => handleDelete(supplier)}
                              >
                                Eliminar
                              </TableAction>
                            </>
                          )}
                        </TableActions>
                      </td>
                    </AnimatedTableRow>
                  )
                })}
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

      <SupplierFormModal
        open={formOpen}
        mode={formMode}
        initialValues={formValues}
        submitting={submitting}
        onClose={() => setFormOpen(false)}
        onSubmit={handleSubmit}
      />

      <SupplierDetailModal
        open={detailSupplier !== null}
        supplier={detailSupplier}
        invoices={detailInvoices}
        onClose={() => setDetailSupplier(null)}
        onEdit={openEdit}
        onViewInvoice={setDetailInvoice}
      />

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
        onReceive={canManage ? handleReceive : undefined}
        onCancel={canManage ? handleCancel : undefined}
      />
    </AppLayout>
  )
}
