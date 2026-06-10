import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { AppLayout } from '../../../components/layout/AppLayout'
import { ProductForm } from '../../../components/inventory/ProductForm'
import { useAuth } from '../../../context/AuthContext'
import { ensureFinanceDefaults } from '../../../services/financeService'
import { createProduct } from '../../../services/productService'
import { listStockCategories } from '../../../services/stockCategoryService'
import { emptyProductForm, type ProductFormInput } from '../../../types/product'
import type { StockCategory } from '../../../types/stockCategory'

export function AddProductPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [formKey, setFormKey] = useState(0)
  const [stockCategories, setStockCategories] = useState<StockCategory[]>([])

  const canManage = user?.role === 'super_admin' || user?.role === 'admin'

  useEffect(() => {
    if (user) {
      ensureFinanceDefaults(user.uid).catch(() => undefined)
    }
    listStockCategories().then(setStockCategories).catch(() => undefined)
  }, [user])
  const canViewCost = user?.role !== 'cashier'

  if (!canManage) {
    return <Navigate to="/inventario/productos" replace />
  }

  async function saveProduct(values: ProductFormInput) {
    if (!user) throw new Error('Sesión no válida.')
    await createProduct(values, user.uid)
  }

  async function handleSubmit(values: ProductFormInput) {
    setSubmitting(true)
    setError('')
    setMessage('')

    try {
      await saveProduct(values)
      navigate('/inventario/productos')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el producto.')
      setSubmitting(false)
    }
  }

  async function handleSaveAndAnother(values: ProductFormInput) {
    setSubmitting(true)
    setError('')
    setMessage('')

    try {
      await saveProduct(values)
      setMessage(`Producto "${values.name}" guardado. Puedes ingresar otro.`)
      setFormKey((current) => current + 1)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el producto.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AppLayout title="Ingresar producto" subtitle="Registra un nuevo producto en el inventario">
      <div className="inventory-add-layout">
        <section className="inventory-panel inventory-add-panel">
          <div className="inventory-panel-header">
            <div>
              <h2>Nuevo producto</h2>
              <p>
                Los productos que registres aquí aparecerán en ventas y en el stock.
              </p>
            </div>
            <Link to="/inventario/productos" className="inventory-btn inventory-btn-secondary">
              Ver catálogo
            </Link>
          </div>

          {error && <div className="alert alert-error">{error}</div>}
          {message && <div className="alert alert-success">{message}</div>}

          <ProductForm
            key={formKey}
            initialValues={emptyProductForm()}
            stockCategories={stockCategories}
            canViewCost={canViewCost}
            submitting={submitting}
            submitLabel="Guardar producto"
            secondaryLabel="Guardar y agregar otro"
            onCancel={() => navigate('/inventario/productos')}
            onSubmit={handleSubmit}
            onSecondarySubmit={handleSaveAndAnother}
          />
        </section>

        <aside className="inventory-help-card">
          <h3>Consejos rápidos</h3>
          <ul>
            <li><strong>Abasto</strong>: productos por unidad (arroz, aceite, harina).</li>
            <li><strong>Charcutería</strong>: carnes, quesos y embutidos por peso (kg).</li>
            <li>El <strong>código de barras</strong> permite escanear al vender.</li>
            <li>
              <strong>Al mayor</strong>: indica cuántas unidades trae (ej. 10 und). Al cargar stock puedes
              ingresar por unidades o al mayor (3 al mayor = 30 und).
            </li>
            <li>
              Los <strong>precios</strong> se guardan en COP; en venta eliges otra moneda y se convierte
              automáticamente.
            </li>
            <li>El <strong>stock mínimo</strong> avisa cuando quede poco producto.</li>
          </ul>
        </aside>
      </div>
    </AppLayout>
  )
}
