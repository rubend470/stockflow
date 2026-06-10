import { useEffect, useMemo, useState } from 'react'
import { AppLayout } from '../../../components/layout/AppLayout'
import { MovementFormModal } from '../../../components/inventory/MovementFormModal'
import { AnimatedPanel, AnimatedTableRow } from '../../../components/ui/motion'
import { TablePagination } from '../../../components/ui/TablePagination'
import { usePagination } from '../../../hooks/usePagination'
import { useAuth } from '../../../context/AuthContext'
import { createMovement, listMovements } from '../../../services/inventoryMovementService'
import { listAllProducts } from '../../../services/productService'
import { movementTypeLabels, type CreateMovementInput, type InventoryMovement } from '../../../types/inventory'
import type { Product } from '../../../types/product'

function formatDate(value: string) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('es', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

export function MovementsPage() {
  const { user } = useAuth()
  const [movements, setMovements] = useState<InventoryMovement[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | InventoryMovement['type']>('all')
  const [modalOpen, setModalOpen] = useState(false)

  const canManage = user?.role === 'super_admin' || user?.role === 'admin'

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    setError('')

    try {
      const [movementList, productList] = await Promise.all([listMovements(), listAllProducts()])
      setMovements(movementList)
      setProducts(productList.filter((product) => product.active))
    } catch {
      setError('No se pudieron cargar los movimientos.')
    } finally {
      setLoading(false)
    }
  }

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()

    return movements.filter((movement) => {
      if (typeFilter !== 'all' && movement.type !== typeFilter) return false
      if (!query) return true
      return (
        movement.productName.toLowerCase().includes(query) ||
        movement.notes?.toLowerCase().includes(query) ||
        movement.createdByName?.toLowerCase().includes(query)
      )
    })
  }, [movements, search, typeFilter])

  const pagination = usePagination(filtered, 15)

  async function handleSubmit(values: CreateMovementInput) {
    if (!user) return

    setSubmitting(true)
    setError('')
    setMessage('')

    try {
      await createMovement(values, user.uid, user.name)
      setMessage('Movimiento registrado correctamente.')
      setModalOpen(false)
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo registrar el movimiento.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AppLayout title="Entradas y salidas" subtitle="Movimientos de inventario">
      <AnimatedPanel className="finance-panel">
        <div className="finance-panel-header">
          <div>
            <h2>Historial de movimientos</h2>
            <p>Compras, ajustes, mermas, devoluciones y ventas.</p>
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
                disabled={products.length === 0}
              >
                Nuevo movimiento
              </button>
            )}
          </div>
        </div>

        <div className="finance-filters finance-filters-row">
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar producto o nota..."
          />
          <select
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value as typeof typeFilter)}
          >
            <option value="all">Todos los tipos</option>
            {Object.entries(movementTypeLabels).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {error && <div className="alert alert-error">{error}</div>}
        {message && <div className="alert alert-success">{message}</div>}

        {loading ? (
          <div className="finance-empty">Cargando movimientos...</div>
        ) : filtered.length === 0 ? (
          <div className="finance-empty">
            <strong>Sin movimientos</strong>
            <p>Registra entradas o ajustes para ver el historial.</p>
          </div>
        ) : (
          <div className="finance-table-wrap">
            <table className="finance-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Producto</th>
                  <th>Tipo</th>
                  <th>Cantidad</th>
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
                    <td>{movementTypeLabels[movement.type]}</td>
                    <td className={movement.quantity < 0 ? 'text-danger' : 'text-success'}>
                      {movement.quantity > 0 ? '+' : ''}
                      {movement.quantity}
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

      <MovementFormModal
        open={modalOpen}
        products={products}
        submitting={submitting}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmit}
      />
    </AppLayout>
  )
}
