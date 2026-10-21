import { useEffect, useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { AppLayout } from '../../../components/layout/AppLayout'
import { AnimatedPanel, AnimatedTableRow } from '../../../components/ui/motion'
import { PanelRefreshOverlay } from '../../../components/ui/PanelRefreshOverlay'
import { useAuth } from '../../../context/AuthContext'
import { usePanelLoader } from '../../../hooks/usePanelLoader'
import {
  createProductType,
  ensureDefaultProductTypes,
  listProductTypes,
  updateProductType,
} from '../../../services/productTypeService'
import {
  emptyProductTypeForm,
  type ProductTypeFormInput,
  type ProductTypeOption,
} from '../../../types/product'
import { userHasMenuPermission } from '../../../utils/menuPermissions'

export function ProductTypesPage() {
  const { user } = useAuth()
  const { loading, refreshing, run } = usePanelLoader()
  const [types, setTypes] = useState<ProductTypeOption[]>([])
  const [formValues, setFormValues] = useState<ProductTypeFormInput>(emptyProductTypeForm())
  const [editingType, setEditingType] = useState<ProductTypeOption | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const canManage = userHasMenuPermission(user, 'product-types')

  useEffect(() => {
    if (canManage) void loadTypes()
  }, [canManage])

  async function loadTypes() {
    if (!user) return
    setError('')
    try {
      await run(async () => {
        await ensureDefaultProductTypes(user.uid)
        setTypes(await listProductTypes())
      })
    } catch {
      setError('No se pudieron cargar los tipos de producto.')
    }
  }

  function editType(type: ProductTypeOption) {
    setEditingType(type)
    setFormValues({ name: type.name, active: type.active })
  }

  function resetForm() {
    setEditingType(null)
    setFormValues(emptyProductTypeForm())
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!user || !canManage) return

    setSubmitting(true)
    setError('')
    setMessage('')
    try {
      if (editingType) {
        await updateProductType(editingType.id, formValues)
        setMessage('Tipo actualizado.')
      } else {
        await createProductType(formValues, user.uid)
        setMessage('Tipo creado.')
      }
      resetForm()
      await loadTypes()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el tipo.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!canManage) return <Navigate to="/" replace />

  return (
    <AppLayout title="Tipos de producto" subtitle="Clasificación visible al crear productos">
      <div className="cash-movements-layout">
        <AnimatedPanel className="finance-panel">
          <div className="finance-panel-header">
            <div>
              <h2>{editingType ? 'Editar tipo' : 'Nuevo tipo'}</h2>
              <p>Ejemplos: Abasto, Charcutería, Lácteos, Bebidas, Limpieza.</p>
            </div>
          </div>

          <form className="expense-form" onSubmit={handleSubmit}>
            <label className="finance-field">
              <span>Nombre</span>
              <input
                type="text"
                value={formValues.name}
                onChange={(event) => setFormValues((current) => ({ ...current, name: event.target.value }))}
                placeholder="Ej. Bebidas"
                required
              />
            </label>
            <label className="finance-check-row">
              <input
                type="checkbox"
                checked={formValues.active}
                onChange={(event) => setFormValues((current) => ({ ...current, active: event.target.checked }))}
              />
              <span>Tipo habilitado</span>
            </label>
            <div className="expense-form-actions">
              {editingType && (
                <button type="button" className="finance-btn finance-btn-secondary" onClick={resetForm}>
                  Cancelar
                </button>
              )}
              <button type="submit" className="finance-btn finance-btn-primary" disabled={submitting}>
                {submitting ? 'Guardando...' : editingType ? 'Actualizar' : 'Crear tipo'}
              </button>
            </div>
          </form>
        </AnimatedPanel>

        <AnimatedPanel className="finance-panel panel-with-overlay">
          <PanelRefreshOverlay show={refreshing} />
          <div className="finance-panel-header">
            <div>
              <h2>Tipos registrados</h2>
              <p>Los tipos activos aparecen al crear o editar un producto.</p>
            </div>
            <button type="button" className="finance-btn finance-btn-secondary" onClick={loadTypes}>
              Actualizar
            </button>
          </div>

          {error && <div className="alert alert-error">{error}</div>}
          {message && <div className="alert alert-success">{message}</div>}

          {loading ? (
            <div className="finance-empty">Cargando tipos...</div>
          ) : (
            <div className="finance-table-wrap">
              <table className="finance-table">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Código</th>
                    <th>Estado</th>
                    <th>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {types.map((type, index) => (
                    <AnimatedTableRow key={type.id} index={index}>
                      <td>
                        <strong>{type.name}</strong>
                      </td>
                      <td>{type.id}</td>
                      <td>
                        <span className={`finance-badge ${type.active ? 'ok' : 'inactive'}`}>
                          {type.active ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td>
                        <button type="button" className="finance-btn finance-btn-secondary" onClick={() => editType(type)}>
                          Editar
                        </button>
                      </td>
                    </AnimatedTableRow>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </AnimatedPanel>
      </div>
    </AppLayout>
  )
}
