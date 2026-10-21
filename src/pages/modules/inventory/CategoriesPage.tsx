import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { AppLayout } from '../../../components/layout/AppLayout'
import { AnimatedPanel } from '../../../components/ui/motion'
import { MoneyInput } from '../../../components/ui/MoneyInput'
import { MoneyText } from '../../../components/ui/MoneyText'
import { ModalCloseButton } from '../../../components/ui/ModalFrame'
import { useAuth } from '../../../context/AuthContext'
import { listAllProducts } from '../../../services/productService'
import { listWasteMovements } from '../../../services/inventoryMovementService'
import { getSaleItems, listSales } from '../../../services/saleService'
import {
  createCategoryLoss,
  createCategoryMovement,
  createStockCategory,
  listAllStockCategories,
  setStockCategoryActive,
  updateStockCategory,
} from '../../../services/stockCategoryService'
import type { Product } from '../../../types/product'
import type { SaleItem } from '../../../types/sale'
import {
  emptyStockCategoryForm,
  getCategoryStockStatus,
  getCategoryStockStatusLabel,
  type StockCategory,
  type StockCategoryFormInput,
} from '../../../types/stockCategory'
import { userHasMenuPermission } from '../../../utils/menuPermissions'
import { parseMoneyInput, roundMoney } from '../../../utils/formatMoney'

function categoryFormFromCategory(category: StockCategory): StockCategoryFormInput {
  return {
    name: category.name,
    unitLabel: category.unitLabel,
    costPrice: category.costPrice,
    stock: category.stock,
    minStock: category.minStock,
  }
}

function formatQuantity(value: number) {
  return Number(value.toFixed(3))
}

interface CategorySalesStats {
  soldQuantity: number
  revenue: number
  profit: number
  wasteQuantity: number
  wasteCost: number
}

export function CategoriesPage() {
  const { user } = useAuth()
  const [categories, setCategories] = useState<StockCategory[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [categorySalesStats, setCategorySalesStats] = useState<Map<string, CategorySalesStats>>(
    () => new Map(),
  )
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [search, setSearch] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [entryOpen, setEntryOpen] = useState(false)
  const [lossOpen, setLossOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<StockCategory | null>(null)
  const [entryCategory, setEntryCategory] = useState<StockCategory | null>(null)
  const [lossCategory, setLossCategory] = useState<StockCategory | null>(null)
  const [formValues, setFormValues] = useState<StockCategoryFormInput>(emptyStockCategoryForm())
  const [entryQuantity, setEntryQuantity] = useState('50')
  const [entryNotes, setEntryNotes] = useState('')
  const [lossQuantity, setLossQuantity] = useState('')
  const [lossNotes, setLossNotes] = useState('')

  const canManage = userHasMenuPermission(user, 'categories')

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    setError('')

    try {
      const [categoryList, productList, sales, wasteMovements] = await Promise.all([
        listAllStockCategories(),
        listAllProducts(),
        listSales(2000),
        listWasteMovements(2000),
      ])
      const activeSales = sales.filter((sale) => sale.status !== 'cancelled')
      const itemsBySale = await Promise.all(activeSales.map((sale) => getSaleItems(sale.id)))
      const productCategoryMap = new Map(
        productList
          .filter((product) => product.stockCategoryId)
          .map((product) => [product.id, product.stockCategoryId as string]),
      )
      const stats = new Map<string, CategorySalesStats>()

      itemsBySale.flat().forEach((item: SaleItem) => {
        const categoryId = item.stockCategoryId ?? productCategoryMap.get(item.productId)
        if (!categoryId) return

        const current = stats.get(categoryId) ?? {
          soldQuantity: 0,
          revenue: 0,
          profit: 0,
          wasteQuantity: 0,
          wasteCost: 0,
        }
        current.soldQuantity = roundMoney(current.soldQuantity + item.stockQuantity)
        current.revenue = roundMoney(current.revenue + item.lineRevenue)
        current.profit = roundMoney(current.profit + item.lineProfit)
        stats.set(categoryId, current)
      })

      wasteMovements.forEach((movement) => {
        if (!movement.stockCategoryId) return
        const current = stats.get(movement.stockCategoryId) ?? {
          soldQuantity: 0,
          revenue: 0,
          profit: 0,
          wasteQuantity: 0,
          wasteCost: 0,
        }
        current.wasteQuantity = roundMoney(current.wasteQuantity + Math.abs(movement.quantity))
        current.wasteCost = roundMoney(current.wasteCost + (movement.lineCost ?? 0))
        stats.set(movement.stockCategoryId, current)
      })

      setCategories(categoryList)
      setProducts(productList)
      setCategorySalesStats(stats)
    } catch {
      setError('No se pudieron cargar las categorías.')
    } finally {
      setLoading(false)
    }
  }

  const productsByCategory = useMemo(() => {
    const map = new Map<string, Product[]>()
    products.forEach((product) => {
      if (!product.stockCategoryId) return
      const list = map.get(product.stockCategoryId) ?? []
      list.push(product)
      map.set(product.stockCategoryId, list)
    })
    return map
  }, [products])

  const inventoryTotals = useMemo(() => {
    return categories.reduce(
      (acc, category) => {
        const value = roundMoney(category.stock * category.costPrice)
        return {
          stock: roundMoney(acc.stock + category.stock),
          investment: roundMoney(acc.investment + value),
        }
      },
      { stock: 0, investment: 0 },
    )
  }, [categories])

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return categories
    return categories.filter((category) => category.name.toLowerCase().includes(query))
  }, [categories, search])

  function openCreateForm() {
    setEditingCategory(null)
    setFormValues(emptyStockCategoryForm())
    setFormOpen(true)
  }

  function openEditForm(category: StockCategory) {
    setEditingCategory(category)
    setFormValues(categoryFormFromCategory(category))
    setFormOpen(true)
  }

  function openEntryForm(category: StockCategory) {
    setEntryCategory(category)
    setEntryQuantity('50')
    setEntryNotes('')
    setEntryOpen(true)
  }

  function openLossForm(category: StockCategory) {
    setLossCategory(category)
    setLossQuantity('')
    setLossNotes('')
    setLossOpen(true)
  }

  async function handleSaveCategory(event: FormEvent) {
    event.preventDefault()
    if (!user || !canManage) return

    setSubmitting(true)
    setError('')
    setMessage('')

    try {
      if (editingCategory) {
        await updateStockCategory(editingCategory.id, formValues)
        setMessage('Categoría actualizada.')
      } else {
        await createStockCategory(formValues, user.uid)
        setMessage('Categoría creada.')
      }
      setFormOpen(false)
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar la categoría.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleRegisterEntry(event: FormEvent) {
    event.preventDefault()
    if (!user || !canManage || !entryCategory) return

    const quantity = Number(entryQuantity)
    if (quantity <= 0) {
      setError('La cantidad debe ser mayor a cero.')
      return
    }

    setSubmitting(true)
    setError('')
    setMessage('')

    try {
      await createCategoryMovement(
        {
          stockCategoryId: entryCategory.id,
          type: 'purchase',
          quantity,
          notes: entryNotes,
        },
        user.uid,
        user.name,
      )
      setMessage(`Entrada registrada: +${quantity} ${entryCategory.unitLabel} de ${entryCategory.name}.`)
      setEntryOpen(false)
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo registrar la entrada.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleRegisterLoss(event: FormEvent) {
    event.preventDefault()
    if (!user || !canManage || !lossCategory) return

    const quantity = Number(lossQuantity)
    if (quantity <= 0) {
      setError('La cantidad perdida debe ser mayor a cero.')
      return
    }

    setSubmitting(true)
    setError('')
    setMessage('')

    try {
      await createCategoryLoss(
        {
          stockCategoryId: lossCategory.id,
          quantity,
          notes: lossNotes,
        },
        user.uid,
        user.name,
      )
      setMessage(
        `Pérdida registrada: -${quantity} ${lossCategory.unitLabel} de ${lossCategory.name}.`,
      )
      setLossOpen(false)
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo registrar la pérdida.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleToggleActive(category: StockCategory) {
    if (!canManage) return

    setError('')
    setMessage('')

    try {
      await setStockCategoryActive(category.id, !category.active)
      setMessage(category.active ? 'Categoría desactivada.' : 'Categoría activada.')
      await loadData()
    } catch {
      setError('No se pudo cambiar el estado de la categoría.')
    }
  }

  return (
    <AppLayout
      title="Categorías de inventario"
      subtitle="Stock compartido para productos derivados (pollo, res, cerdo…)"
    >
      <section className="inventory-panel">
        <div className="inventory-panel-header">
          <div>
            <h2>Categorías</h2>
            <p>
              Registra el total disponible (ej. 50 kg de pollo). Los productos derivados restan de
              ese total al venderse.
            </p>
          </div>

          <div className="inventory-panel-actions">
            <button type="button" className="inventory-btn inventory-btn-secondary" onClick={loadData}>
              Actualizar
            </button>
            {canManage && (
              <button type="button" className="inventory-btn inventory-btn-primary" onClick={openCreateForm}>
                Nueva categoría
              </button>
            )}
          </div>
        </div>

        <div className="inventory-filters">
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar categoría..."
          />
        </div>

        {error && <div className="alert alert-error">{error}</div>}
        {message && <div className="alert alert-success">{message}</div>}

        <div className="inventory-stats-grid">
          <article>
            <span>Categorías</span>
            <strong>{categories.length}</strong>
          </article>
          <article>
            <span>Stock compartido</span>
            <strong>{inventoryTotals.stock}</strong>
          </article>
          <article>
            <span>Inversión en categorías</span>
            <strong>
              <MoneyText amount={inventoryTotals.investment} />
            </strong>
          </article>
        </div>

        {loading ? (
          <div className="inventory-empty">Cargando categorías...</div>
        ) : filtered.length === 0 ? (
          <div className="inventory-empty">
            <strong>No hay categorías registradas</strong>
            <p>Crea una categoría como Pollo y luego vincula productos derivados (patas, pulpa…).</p>
            {canManage && (
              <button type="button" className="inventory-btn inventory-btn-primary" onClick={openCreateForm}>
                Crear categoría Pollo
              </button>
            )}
          </div>
        ) : (
          <div className="category-grid">
            {filtered.map((category, index) => {
              const derived = productsByCategory.get(category.id) ?? []
              const salesStats = categorySalesStats.get(category.id) ?? {
                soldQuantity: 0,
                revenue: 0,
                profit: 0,
                wasteQuantity: 0,
                wasteCost: 0,
              }
              const adjustedProfit = roundMoney(salesStats.profit - salesStats.wasteCost)
              const status = getCategoryStockStatus(category)

              return (
                <AnimatedPanel key={category.id} delay={index + 1} className="category-card">
                  <div className="category-card-header">
                    <div>
                      <h3>{category.name}</h3>
                      {!category.active && <span className="inventory-badge">Inactiva</span>}
                    </div>
                    <span className={`inventory-stock-badge ${status}`}>
                      {getCategoryStockStatusLabel(status)}
                    </span>
                  </div>

                  <div className="category-stock-display">
                    <strong>{formatQuantity(category.stock)}</strong>
                    <span>{category.unitLabel} disponibles</span>
                  </div>

                  <p className="inventory-hint">
                    Mínimo: {category.minStock} {category.unitLabel}
                  </p>

                  <div className="category-metrics">
                    <article>
                      <span>Costo</span>
                      <strong>
                        <MoneyText amount={category.costPrice} />/{category.unitLabel}
                      </strong>
                    </article>
                    <article>
                      <span>Inversión</span>
                      <strong>
                        <MoneyText amount={roundMoney(category.stock * category.costPrice)} />
                      </strong>
                    </article>
                  </div>

                  <div className="category-metrics">
                    <article>
                      <span>Vendido</span>
                      <strong>
                        {formatQuantity(salesStats.soldQuantity)} {category.unitLabel}
                      </strong>
                    </article>
                    <article>
                      <span>Ventas</span>
                      <strong>
                        <MoneyText amount={salesStats.revenue} />
                      </strong>
                    </article>
                    <article>
                      <span>Ganancia</span>
                      <strong className="finance-profit">
                        <MoneyText amount={salesStats.profit} />
                      </strong>
                    </article>
                    <article>
                      <span>Pérdida</span>
                      <strong className="text-danger">
                        {formatQuantity(salesStats.wasteQuantity)} {category.unitLabel}
                      </strong>
                    </article>
                    <article>
                      <span>Costo pérdida estimado</span>
                      <strong className="text-danger">
                        <MoneyText amount={salesStats.wasteCost} />
                      </strong>
                    </article>
                    <article>
                      <span>Ganancia aprox.</span>
                      <strong className={adjustedProfit >= 0 ? 'finance-profit' : 'text-danger'}>
                        <MoneyText amount={adjustedProfit} />
                      </strong>
                    </article>
                  </div>

                  <div className="category-derived">
                    <h4>Productos derivados ({derived.length})</h4>
                    {derived.length === 0 ? (
                      <p className="inventory-hint">
                        Sin derivados.{' '}
                        {canManage && (
                          <Link to="/inventario/productos/nuevo">Crea un producto</Link>
                        )}{' '}
                        y asígnalo a esta categoría.
                      </p>
                    ) : (
                      <ul>
                        {derived.map((product) => (
                          <li key={product.id}>
                            {product.name}
                            {!product.active && ' (inactivo)'}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {canManage && (
                    <div className="category-card-actions">
                      <button
                        type="button"
                        className="inventory-btn inventory-btn-primary"
                        onClick={() => openEntryForm(category)}
                      >
                        Registrar entrada
                      </button>
                      <button
                        type="button"
                        className="inventory-btn inventory-btn-secondary"
                        onClick={() => openLossForm(category)}
                      >
                        Registrar pérdida
                      </button>
                      <button
                        type="button"
                        className="inventory-link-btn"
                        onClick={() => openEditForm(category)}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        className="inventory-link-btn"
                        onClick={() => handleToggleActive(category)}
                      >
                        {category.active ? 'Desactivar' : 'Activar'}
                      </button>
                    </div>
                  )}
                </AnimatedPanel>
              )
            })}
          </div>
        )}
      </section>

      {formOpen && (
        <div className="inventory-modal-backdrop" onClick={() => setFormOpen(false)}>
          <div className="inventory-modal" onClick={(event) => event.stopPropagation()}>
            <ModalCloseButton onClick={() => setFormOpen(false)} />
            <div className="inventory-modal-header">
              <h2>{editingCategory ? 'Editar categoría' : 'Nueva categoría'}</h2>
            </div>

            <form className="inventory-form" onSubmit={handleSaveCategory}>
              <label className="inventory-field">
                <span>Nombre</span>
                <input
                  type="text"
                  value={formValues.name}
                  onChange={(event) =>
                    setFormValues((current) => ({ ...current, name: event.target.value }))
                  }
                  placeholder="Ej. Pollo"
                  required
                />
              </label>

              <label className="inventory-field">
                <span>Unidad</span>
                <select
                  value={formValues.unitLabel}
                  onChange={(event) =>
                    setFormValues((current) => ({ ...current, unitLabel: event.target.value }))
                  }
                >
                  <option value="kg">Kilogramo (kg)</option>
                  <option value="lb">Libra (lb)</option>
                </select>
              </label>

              <label className="inventory-field">
                <span>Costo por {formValues.unitLabel}</span>
                <MoneyInput
                  showCurrencyPrefix
                  value={formValues.costPrice}
                  min="0"
                  onChange={(next) =>
                    setFormValues((current) => ({
                      ...current,
                      costPrice: parseMoneyInput(next),
                    }))
                  }
                />
              </label>

              <label className="inventory-field">
                <span>
                  {editingCategory ? 'Cantidad disponible' : 'Stock inicial'} ({formValues.unitLabel})
                </span>
                <input
                  type="number"
                  min="0"
                  step="0.001"
                  value={formValues.stock}
                  onChange={(event) =>
                    setFormValues((current) => ({ ...current, stock: Number(event.target.value) }))
                  }
                  required
                />
                {editingCategory && (
                  <small className="inventory-field-hint">
                    Ajusta aquí los kilos o la cantidad disponible actual.
                  </small>
                )}
              </label>

              <label className="inventory-field">
                <span>Stock mínimo ({formValues.unitLabel})</span>
                <input
                  type="number"
                  min="0"
                  step="0.001"
                  value={formValues.minStock}
                  onChange={(event) =>
                    setFormValues((current) => ({ ...current, minStock: Number(event.target.value) }))
                  }
                  required
                />
              </label>

              <div className="inventory-form-actions">
                <button
                  type="button"
                  className="inventory-btn inventory-btn-secondary"
                  onClick={() => setFormOpen(false)}
                >
                  Cancelar
                </button>
                <button type="submit" className="inventory-btn inventory-btn-primary" disabled={submitting}>
                  {submitting ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {entryOpen && entryCategory && (
        <div className="inventory-modal-backdrop" onClick={() => setEntryOpen(false)}>
          <div className="inventory-modal" onClick={(event) => event.stopPropagation()}>
            <ModalCloseButton onClick={() => setEntryOpen(false)} />
            <div className="inventory-modal-header">
              <h2>Registrar entrada — {entryCategory.name}</h2>
              <p>Actual: {formatQuantity(entryCategory.stock)} {entryCategory.unitLabel}</p>
            </div>

            <form className="inventory-form" onSubmit={handleRegisterEntry}>
              <label className="inventory-field">
                <span>Cantidad ({entryCategory.unitLabel})</span>
                <input
                  type="number"
                  min="0.001"
                  step="0.001"
                  value={entryQuantity}
                  onChange={(event) => setEntryQuantity(event.target.value)}
                  required
                />
              </label>

              <label className="inventory-field">
                <span>Notas (opcional)</span>
                <input
                  type="text"
                  value={entryNotes}
                  onChange={(event) => setEntryNotes(event.target.value)}
                  placeholder="Ej. Compra del martes"
                />
              </label>

              <div className="inventory-form-actions">
                <button
                  type="button"
                  className="inventory-btn inventory-btn-secondary"
                  onClick={() => setEntryOpen(false)}
                >
                  Cancelar
                </button>
                <button type="submit" className="inventory-btn inventory-btn-primary" disabled={submitting}>
                  {submitting ? 'Registrando...' : 'Registrar entrada'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {lossOpen && lossCategory && (
        <div className="inventory-modal-backdrop" onClick={() => setLossOpen(false)}>
          <div className="inventory-modal" onClick={(event) => event.stopPropagation()}>
            <ModalCloseButton onClick={() => setLossOpen(false)} />
            <div className="inventory-modal-header">
              <h2>Registrar pérdida — {lossCategory.name}</h2>
              <p>
                Actual: {formatQuantity(lossCategory.stock)} {lossCategory.unitLabel}. No se
                ingresa precio de venta; el costo se estima con el costo interno de la categoría.
              </p>
            </div>

            <form className="inventory-form" onSubmit={handleRegisterLoss}>
              <label className="inventory-field">
                <span>Cantidad perdida ({lossCategory.unitLabel})</span>
                <input
                  type="number"
                  min="0.001"
                  step="0.001"
                  value={lossQuantity}
                  onChange={(event) => setLossQuantity(event.target.value)}
                  placeholder="Ej. 2.5"
                  required
                />
              </label>

              <label className="inventory-field">
                <span>Notas (opcional)</span>
                <input
                  type="text"
                  value={lossNotes}
                  onChange={(event) => setLossNotes(event.target.value)}
                  placeholder="Ej. pellejo y hueso pesado al cierre"
                />
              </label>

              <div className="inventory-stats-grid inventory-form-full">
                <article>
                  <span>Costo interno estimado</span>
                  <strong>
                    <MoneyText
                      amount={roundMoney(
                        Math.max(Number(lossQuantity) || 0, 0) * lossCategory.costPrice,
                      )}
                    />
                  </strong>
                </article>
              </div>

              <div className="inventory-form-actions">
                <button
                  type="button"
                  className="inventory-btn inventory-btn-secondary"
                  onClick={() => setLossOpen(false)}
                >
                  Cancelar
                </button>
                <button type="submit" className="inventory-btn inventory-btn-primary" disabled={submitting}>
                  {submitting ? 'Registrando...' : 'Registrar pérdida'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppLayout>
  )
}
