import { useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { AppLayout } from '../../../components/layout/AppLayout'
import { WasteFormModal } from '../../../components/inventory/WasteFormModal'
import { AnimatedPanel, AnimatedTableRow } from '../../../components/ui/motion'
import { TablePagination } from '../../../components/ui/TablePagination'
import { usePagination } from '../../../hooks/usePagination'
import { useAuth } from '../../../context/AuthContext'
import { createWaste, listWasteMovements } from '../../../services/inventoryMovementService'
import { listAllProducts } from '../../../services/productService'
import { listStockCategories } from '../../../services/stockCategoryService'
import type { CreateWasteInput, InventoryMovement } from '../../../types/inventory'
import { wasteReasonLabels } from '../../../types/inventory'
import type { Product } from '../../../types/product'
import type { StockCategory } from '../../../types/stockCategory'
import { userHasMenuPermission } from '../../../utils/menuPermissions'
import { formatBaseMoney } from '../../../utils/formatMoney'
import { getMovementWasteCost } from '../../../utils/wasteCost'

function formatDate(value: string) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('es', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function formatQuantity(value: number) {
  const abs = Math.abs(value)
  return Number.isInteger(abs) ? String(abs) : abs.toFixed(3).replace(/\.?0+$/, '')
}

export function WastePage() {
  const { user } = useAuth()
  const [movements, setMovements] = useState<InventoryMovement[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<StockCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)

  const canAccess = userHasMenuPermission(user, 'waste')
  const canManage = user?.role === 'super_admin' || user?.role === 'admin'

  useEffect(() => {
    if (canAccess) loadData()
  }, [canAccess])

  async function loadData() {
    setLoading(true)
    setError('')

    try {
      const [movementList, productList, categoryList] = await Promise.all([
        listWasteMovements(),
        listAllProducts(),
        listStockCategories(),
      ])
      setMovements(movementList)
      setProducts(productList.filter((product) => product.active))
      setCategories(categoryList)
    } catch {
      setError('No se pudieron cargar las mermas.')
    } finally {
      setLoading(false)
    }
  }

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()

    return movements.filter((movement) => {
      if (!query) return true
      return (
        movement.productName.toLowerCase().includes(query) ||
        movement.notes?.toLowerCase().includes(query) ||
        movement.createdByName?.toLowerCase().includes(query) ||
        (movement.wasteReason && wasteReasonLabels[movement.wasteReason].toLowerCase().includes(query))
      )
    })
  }, [movements, search])

  const monthSummary = useMemo(() => {
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

    const thisMonth = movements.filter((movement) => new Date(movement.createdAt) >= monthStart)

    return {
      count: thisMonth.length,
      totalQuantity: thisMonth.reduce((sum, movement) => sum + Math.abs(movement.quantity), 0),
      totalCost: thisMonth.reduce((sum, movement) => sum + getMovementWasteCost(movement), 0),
    }
  }, [movements])

  const pagination = usePagination(filtered, 15)

  async function handleSubmit(values: CreateWasteInput) {
    if (!user) return

    setSubmitting(true)
    setError('')
    setMessage('')

    try {
      await createWaste(values, user.uid, user.name)
      setMessage('Merma registrada correctamente.')
      setModalOpen(false)
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo registrar la merma.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!canAccess) {
    return <Navigate to="/" replace />
  }

  const standaloneProducts = useMemo(
    () => products.filter((product) => !product.stockCategoryId),
    [products],
  )

  const canRegister =
    canManage && (standaloneProducts.length > 0 || categories.length > 0)

  return (
    <AppLayout title="Mermas y pérdidas" subtitle="Registro de inventario perdido">
      <AnimatedPanel className="finance-panel">
        <div className="expense-metrics">
          <article>
            <span>Mermas este mes</span>
            <strong>{monthSummary.count}</strong>
          </article>
          <article>
            <span>Cantidad total perdida</span>
            <strong className="expense-negative">{formatQuantity(monthSummary.totalQuantity)}</strong>
            <small>Unidades mixtas (kg, und, lb)</small>
          </article>
          <article>
            <span>Valor perdido este mes</span>
            <strong className="expense-negative">{formatBaseMoney(monthSummary.totalCost)}</strong>
            <small>Costo congelado al registrar cada merma</small>
          </article>
        </div>
      </AnimatedPanel>

      <AnimatedPanel className="finance-panel">
        <div className="finance-panel-header">
          <div>
            <h2>Historial de mermas</h2>
            <p>Pérdidas por vencimiento, deterioro, rotura u otros motivos.</p>
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
                disabled={!canRegister}
              >
                Registrar merma
              </button>
            )}
          </div>
        </div>

        <div className="finance-filters finance-filters-row">
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar producto, motivo o nota..."
          />
        </div>

        {error && <div className="alert alert-error">{error}</div>}
        {message && <div className="alert alert-success">{message}</div>}

        {loading ? (
          <div className="finance-empty">Cargando mermas...</div>
        ) : filtered.length === 0 ? (
          <div className="finance-empty">
            <strong>Sin mermas registradas</strong>
            <p>Registra pérdidas de productos o categorías compartidas para llevar trazabilidad.</p>
          </div>
        ) : (
          <div className="finance-table-wrap">
            <table className="finance-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Origen</th>
                  <th>Tipo</th>
                  <th>Cantidad</th>
                  <th>Costo unit.</th>
                  <th>Valor perdido</th>
                  <th>Motivo</th>
                  <th>Usuario</th>
                  <th>Notas</th>
                </tr>
              </thead>
              <tbody>
                {pagination.paginatedItems.map((movement, index) => (
                  <AnimatedTableRow key={movement.id} index={index}>
                    <td>{formatDate(movement.createdAt)}</td>
                    <td>
                      <strong>{movement.productName}</strong>
                    </td>
                    <td>{movement.stockCategoryId ? 'Categoría' : 'Producto'}</td>
                    <td className="text-danger">−{formatQuantity(movement.quantity)}</td>
                    <td>
                      {movement.unitCost ? formatBaseMoney(movement.unitCost) : '—'}
                    </td>
                    <td className="text-danger">
                      {getMovementWasteCost(movement) > 0
                        ? formatBaseMoney(getMovementWasteCost(movement))
                        : '—'}
                    </td>
                    <td>
                      {movement.wasteReason ? wasteReasonLabels[movement.wasteReason] : '—'}
                    </td>
                    <td>{movement.createdByName ?? '—'}</td>
                    <td>{movement.notes || '—'}</td>
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

      <WasteFormModal
        open={modalOpen}
        products={products}
        categories={categories}
        submitting={submitting}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmit}
      />
    </AppLayout>
  )
}
