import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AppLayout } from '../../../components/layout/AppLayout'
import { PanelRefreshOverlay } from '../../../components/ui/PanelRefreshOverlay'
import { TableAction, TableActions } from '../../../components/ui/TableActions'
import { TablePagination } from '../../../components/ui/TablePagination'
import { usePagination } from '../../../hooks/usePagination'
import { usePanelLoader } from '../../../hooks/usePanelLoader'
import { ProductFormModal } from '../../../components/inventory/ProductFormModal'
import { useAuth } from '../../../context/AuthContext'
import { useConfirm } from '../../../context/ConfirmContext'
import {
  deleteProduct,
  listAllProducts,
  setProductActive,
  updateProduct,
} from '../../../services/productService'
import { listStockCategories } from '../../../services/stockCategoryService'
import type { StockCategory } from '../../../types/stockCategory'
import { enrichProductsWithCategoryStock } from '../../../utils/stockCategory'
import {
  emptyProductForm,
  getStockStatus,
  getStockStatusLabel,
  productFormFromProduct,
  type Product,
  type ProductFormInput,
} from '../../../types/product'
import { formatBaseMoney } from '../../../utils/formatMoney'
import { formatProductPrices, formatStockSummary, getProductSaleSummary } from '../../../utils/productUnits'

const typeLabels = {
  abasto: 'Abasto',
  charcuteria: 'Charcutería',
}

export function ProductsPage() {
  const { user } = useAuth()
  const confirm = useConfirm()
  const [products, setProducts] = useState<Product[]>([])
  const [stockCategories, setStockCategories] = useState<StockCategory[]>([])
  const { loading, refreshing, run } = usePanelLoader()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | Product['type']>('all')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [formValues, setFormValues] = useState<ProductFormInput>(emptyProductForm())

  const canManage = user?.role === 'super_admin' || user?.role === 'admin'
  const canViewCost = user?.role !== 'cashier'

  useEffect(() => {
    loadProducts()
  }, [])

  async function loadProducts() {
    setError('')

    try {
      await run(async () => {
        const [data, categories] = await Promise.all([listAllProducts(), listStockCategories()])
        setStockCategories(categories)
        setProducts(enrichProductsWithCategoryStock(data, categories))
      })
    } catch {
      setError('No se pudieron cargar los productos. Verifica las reglas de Firestore.')
    }
  }

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase()

    return products.filter((product) => {
      if (typeFilter !== 'all' && product.type !== typeFilter) return false
      if (!query) return true

      return (
        product.name.toLowerCase().includes(query) ||
        product.barcode?.toLowerCase().includes(query) ||
        product.sku?.toLowerCase().includes(query)
      )
    })
  }, [products, search, typeFilter])

  const pagination = usePagination(filteredProducts, 12)

  function openEditModal(product: Product) {
    setEditingProduct(product)
    setFormValues(productFormFromProduct(product))
    setModalOpen(true)
  }

  async function handleSubmit(values: ProductFormInput) {
    if (!user || !canManage || !editingProduct) return

    setSubmitting(true)
    setError('')
    setMessage('')

    try {
      await updateProduct(editingProduct.id, values)
      setMessage('Producto actualizado correctamente.')
      setModalOpen(false)
      await loadProducts()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el producto.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleToggleActive(product: Product) {
    if (!canManage) return

    setError('')
    setMessage('')

    try {
      await setProductActive(product.id, !product.active)
      setProducts((current) =>
        current.map((item) =>
          item.id === product.id ? { ...item, active: !product.active } : item,
        ),
      )
      setMessage(product.active ? 'Producto desactivado.' : 'Producto activado.')
    } catch {
      setError('No se pudo cambiar el estado del producto.')
    }
  }

  async function handleDelete(product: Product) {
    if (!canManage) return

    const confirmed = await confirm({
      title: 'Eliminar producto',
      message: `¿Eliminar "${product.name}" del inventario? Esta acción no se puede deshacer.`,
      confirmLabel: 'Sí, eliminar',
      tone: 'danger',
    })
    if (!confirmed) return

    setError('')
    setMessage('')

    try {
      await deleteProduct(product.id)
      setProducts((current) => current.filter((item) => item.id !== product.id))
      setMessage(`Producto "${product.name}" eliminado.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar el producto.')
    }
  }

  return (
    <AppLayout title="Productos" subtitle="Catálogo de abasto y charcutería">
      <section className="inventory-panel" style={{ position: 'relative' }}>
        <PanelRefreshOverlay show={refreshing} />
        <div className="inventory-panel-header">
          <div>
            <h2>Catálogo de productos</h2>
            <p>Administra precios, stock y códigos de barras para ventas.</p>
          </div>

          <div className="inventory-panel-actions">
            <button type="button" className="inventory-btn inventory-btn-secondary" onClick={loadProducts}>
              Actualizar
            </button>
            {canManage && (
              <Link to="/inventario/productos/nuevo" className="inventory-btn inventory-btn-primary">
                Ingresar producto
              </Link>
            )}
          </div>
        </div>

        <div className="inventory-filters">
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por nombre o código..."
          />
          <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as typeof typeFilter)}>
            <option value="all">Todos los tipos</option>
            <option value="abasto">Abasto</option>
            <option value="charcuteria">Charcutería</option>
          </select>
        </div>

        {error && <div className="alert alert-error">{error}</div>}
        {message && <div className="alert alert-success">{message}</div>}

        {loading ? (
          <div className="inventory-empty">Cargando productos...</div>
        ) : filteredProducts.length === 0 ? (
          <div className="inventory-empty">
            <strong>No hay productos para mostrar</strong>
            <p>
              {canManage
                ? 'Crea tu primer producto para empezar a vender.'
                : 'Aún no hay productos registrados.'}
            </p>
            {canManage && (
              <Link to="/inventario/productos/nuevo" className="inventory-btn inventory-btn-primary">
                Ingresar producto
              </Link>
            )}
          </div>
        ) : (
          <div className="inventory-table-wrap">
            <table className="inventory-table">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Código</th>
                  <th>Tipo</th>
                  <th>Venta</th>
                  {canViewCost && <th>Costo</th>}
                  <th>Precio</th>
                  <th>Stock</th>
                  <th>Estado</th>
                  {canManage && <th className="table-actions-col">Acciones</th>}
                </tr>
              </thead>
              <tbody>
                {pagination.paginatedItems.map((product) => {
                  const stockStatus = getStockStatus(product)

                  return (
                    <tr key={product.id} className={!product.active ? 'inventory-row-inactive' : undefined}>
                      <td>
                        <strong>{product.name}</strong>
                        {!product.active && <span className="inventory-badge">Inactivo</span>}
                      </td>
                      <td>{product.barcode || '—'}</td>
                      <td>{typeLabels[product.type]}</td>
                      <td>{getProductSaleSummary(product)}</td>
                      {canViewCost && (
                        <td>
                          {product.stockCategoryId ? (
                            <span className="inventory-subtext">En categoría</span>
                          ) : (
                            <>
                              {formatBaseMoney(product.costPrice)}/{product.unitLabel}
                              {product.allowsBundle && product.bundleCostPrice !== undefined && (
                                <span className="inventory-subtext">
                                  {' '}
                                  · Al mayor: {formatBaseMoney(product.bundleCostPrice)}
                                </span>
                              )}
                            </>
                          )}
                        </td>
                      )}
                      <td>{formatProductPrices(product)}</td>
                      <td>
                        {formatStockSummary(product)}
                        {product.stockCategoryId && (
                          <span className="inventory-subtext">
                            {' '}
                            · de{' '}
                            {stockCategories.find((c) => c.id === product.stockCategoryId)?.name ??
                              'categoría'}
                          </span>
                        )}
                      </td>
                      <td>
                        <span className={`inventory-stock-badge ${stockStatus}`}>
                          {getStockStatusLabel(stockStatus)}
                        </span>
                      </td>
                      {canManage && (
                        <td className="table-actions-col">
                          <TableActions>
                            <TableAction icon="edit" onClick={() => openEditModal(product)}>
                              Editar
                            </TableAction>
                            <TableAction
                              icon="toggle"
                              tone="muted"
                              onClick={() => handleToggleActive(product)}
                            >
                              {product.active ? 'Desactivar' : 'Activar'}
                            </TableAction>
                            <TableAction
                              icon="delete"
                              tone="danger"
                              onClick={() => handleDelete(product)}
                            >
                              Eliminar
                            </TableAction>
                          </TableActions>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {!loading && filteredProducts.length > 0 && (
          <TablePagination
            page={pagination.page}
            totalPages={pagination.totalPages}
            totalItems={pagination.totalItems}
            pageSize={pagination.pageSize}
            onPageChange={pagination.setPage}
          />
        )}

        {!canManage && (
          <p className="inventory-note">
            Tu rol solo permite consultar productos. Para crear o editar, inicia sesión como Admin o Super Admin.
          </p>
        )}
      </section>

      <ProductFormModal
        open={modalOpen}
        mode="edit"
        initialValues={formValues}
        stockCategories={stockCategories}
        canViewCost={canViewCost}
        submitting={submitting}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmit}
      />
    </AppLayout>
  )
}
