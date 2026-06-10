import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { AppLayout } from '../../../components/layout/AppLayout'
import { AnimatedPanel } from '../../../components/ui/motion'
import { ModalCloseButton } from '../../../components/ui/ModalFrame'
import { useAuth } from '../../../context/AuthContext'
import { listAllProducts } from '../../../services/productService'
import {
  createCategoryMovement,
  createStockCategory,
  listAllStockCategories,
  setStockCategoryActive,
  updateStockCategory,
} from '../../../services/stockCategoryService'
import type { Product } from '../../../types/product'
import {
  emptyStockCategoryForm,
  getCategoryStockStatus,
  getCategoryStockStatusLabel,
  type StockCategory,
  type StockCategoryFormInput,
} from '../../../types/stockCategory'

function categoryFormFromCategory(category: StockCategory): StockCategoryFormInput {
  return {
    name: category.name,
    unitLabel: category.unitLabel,
    stock: category.stock,
    minStock: category.minStock,
  }
}

export function CategoriesPage() {
  const { user } = useAuth()
  const [categories, setCategories] = useState<StockCategory[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [search, setSearch] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [entryOpen, setEntryOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<StockCategory | null>(null)
  const [entryCategory, setEntryCategory] = useState<StockCategory | null>(null)
  const [formValues, setFormValues] = useState<StockCategoryFormInput>(emptyStockCategoryForm())
  const [entryQuantity, setEntryQuantity] = useState('50')
  const [entryNotes, setEntryNotes] = useState('')

  const canManage = user?.role === 'super_admin' || user?.role === 'admin'

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    setError('')

    try {
      const [categoryList, productList] = await Promise.all([
        listAllStockCategories(),
        listAllProducts(),
      ])
      setCategories(categoryList)
      setProducts(productList)
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
                    <strong>{category.stock}</strong>
                    <span>{category.unitLabel} disponibles</span>
                  </div>

                  <p className="inventory-hint">
                    Mínimo: {category.minStock} {category.unitLabel}
                  </p>

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

              {!editingCategory && (
                <label className="inventory-field">
                  <span>Stock inicial ({formValues.unitLabel})</span>
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
                </label>
              )}

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
              <p>Actual: {entryCategory.stock} {entryCategory.unitLabel}</p>
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
    </AppLayout>
  )
}
