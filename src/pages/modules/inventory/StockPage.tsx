import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AppLayout } from '../../../components/layout/AppLayout'
import { TablePagination } from '../../../components/ui/TablePagination'
import { usePagination } from '../../../hooks/usePagination'
import { useAuth } from '../../../context/AuthContext'
import { listAllProducts } from '../../../services/productService'
import { listStockCategories } from '../../../services/stockCategoryService'
import { enrichProductsWithCategoryStock } from '../../../utils/stockCategory'
import {
  getStockStatus,
  getStockStatusLabel,
  type Product,
} from '../../../types/product'
import {
  formatMinStockSummary,
  formatProductPrices,
  formatStockSummary,
  getProductSaleSummary,
} from '../../../utils/productUnits'

const typeLabels = {
  abasto: 'Abasto',
  charcuteria: 'Charcutería',
}

export function StockPage() {
  const { user } = useAuth()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'ok' | 'low' | 'out'>('all')
  const [search, setSearch] = useState('')

  const canManage = user?.role === 'super_admin' || user?.role === 'admin'

  useEffect(() => {
    loadStock()
  }, [])

  async function loadStock() {
    setLoading(true)
    setError('')

    try {
      const [data, categories] = await Promise.all([listAllProducts(), listStockCategories()])
      const activeProducts = data.filter((product) => product.active)
      setProducts(enrichProductsWithCategoryStock(activeProducts, categories))
    } catch {
      setError('No se pudo cargar el stock.')
    } finally {
      setLoading(false)
    }
  }

  const stats = useMemo(() => {
    const activeProducts = products.filter((product) => product.active)
    return {
      total: activeProducts.length,
      low: activeProducts.filter((product) => getStockStatus(product) === 'low').length,
      out: activeProducts.filter((product) => getStockStatus(product) === 'out').length,
    }
  }, [products])

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase()

    return products.filter((product) => {
      const status = getStockStatus(product)
      if (statusFilter !== 'all' && status !== statusFilter) return false
      if (!query) return true

      return (
        product.name.toLowerCase().includes(query) ||
        product.barcode?.toLowerCase().includes(query)
      )
    })
  }, [products, search, statusFilter])

  const pagination = usePagination(filteredProducts, 12)

  return (
    <AppLayout title="Stock actual" subtitle="Existencias en tiempo real">
      <section className="inventory-panel">
        <div className="inventory-panel-header">
          <div>
            <h2>Inventario disponible</h2>
            <p>Consulta existencias y detecta productos con stock bajo o agotado.</p>
          </div>
          <button type="button" className="inventory-btn inventory-btn-secondary" onClick={loadStock}>
            Actualizar
          </button>
        </div>

        <div className="inventory-stats">
          <article>
            <span>Productos activos</span>
            <strong>{stats.total}</strong>
          </article>
          <article className="warning">
            <span>Stock bajo</span>
            <strong>{stats.low}</strong>
          </article>
          <article className="danger">
            <span>Agotados</span>
            <strong>{stats.out}</strong>
          </article>
        </div>

        <div className="inventory-filters">
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar producto..."
          />
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
          >
            <option value="all">Todos los estados</option>
            <option value="ok">Disponible</option>
            <option value="low">Stock bajo</option>
            <option value="out">Agotado</option>
          </select>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        {loading ? (
          <div className="inventory-empty">Cargando stock...</div>
        ) : filteredProducts.length === 0 ? (
          <div className="inventory-empty">
            <strong>Sin resultados</strong>
            <p>No hay productos que coincidan con el filtro.</p>
            {canManage && (
              <Link to="/inventario/productos" className="inventory-btn inventory-btn-primary">
                Agregar productos
              </Link>
            )}
          </div>
        ) : (
          <div className="inventory-table-wrap">
            <table className="inventory-table">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Categoría</th>
                  <th>Venta por</th>
                  <th>Stock</th>
                  <th>Mínimo</th>
                  <th>Precio</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {pagination.paginatedItems.map((product) => {
                  const stockStatus = getStockStatus(product)

                  return (
                    <tr key={product.id}>
                      <td>
                        <strong>{product.name}</strong>
                        {product.barcode && <span className="inventory-subtext">{product.barcode}</span>}
                      </td>
                      <td>{typeLabels[product.type]}</td>
                      <td>{getProductSaleSummary(product)}</td>
                      <td>{formatStockSummary(product)}</td>
                      <td>{formatMinStockSummary(product)}</td>
                      <td>{formatProductPrices(product)}</td>
                      <td>
                        <span className={`inventory-stock-badge ${stockStatus}`}>
                          {getStockStatusLabel(stockStatus)}
                        </span>
                      </td>
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
      </section>
    </AppLayout>
  )
}
