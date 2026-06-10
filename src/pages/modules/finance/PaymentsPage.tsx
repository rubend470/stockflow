import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { AppLayout } from '../../../components/layout/AppLayout'
import { PaymentMethodFormModal } from '../../../components/finance/PaymentMethodFormModal'
import { AnimatedPanel, AnimatedTableRow } from '../../../components/ui/motion'
import { PanelRefreshOverlay } from '../../../components/ui/PanelRefreshOverlay'
import { TableAction, TableActions } from '../../../components/ui/TableActions'
import { useAuth } from '../../../context/AuthContext'
import { usePanelLoader } from '../../../hooks/usePanelLoader'
import { useConfirm } from '../../../context/ConfirmContext'
import {
  createPaymentMethod,
  deletePaymentMethod,
  listAllCurrencies,
  listAllPaymentMethods,
  updatePaymentMethod,
} from '../../../services/financeService'
import {
  emptyPaymentMethodForm,
  paymentMethodFormFromMethod,
  type Currency,
  type PaymentMethod,
  type PaymentMethodFormInput,
} from '../../../types/finance'

export function PaymentsPage() {
  const { user } = useAuth()
  const confirm = useConfirm()
  const [methods, setMethods] = useState<PaymentMethod[]>([])
  const [currencies, setCurrencies] = useState<Currency[]>([])
  const { loading, refreshing, run } = usePanelLoader()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create')
  const [formValues, setFormValues] = useState<PaymentMethodFormInput>(emptyPaymentMethodForm())
  const [editingMethod, setEditingMethod] = useState<PaymentMethod | null>(null)

  const canManage = user?.role === 'super_admin' || user?.role === 'admin'

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setError('')

    try {
      await run(async () => {
        const [methodList, currencyList] = await Promise.all([
          listAllPaymentMethods(),
          listAllCurrencies(),
        ])
        setMethods(methodList)
        setCurrencies(currencyList)
      })
    } catch {
      setError('No se pudieron cargar las formas de pago.')
    }
  }

  function openCreateModal() {
    setModalMode('create')
    setEditingMethod(null)
    setFormValues(emptyPaymentMethodForm())
    setModalOpen(true)
  }

  function openEditModal(method: PaymentMethod) {
    setModalMode('edit')
    setEditingMethod(method)
    setFormValues(paymentMethodFormFromMethod(method))
    setModalOpen(true)
  }

  async function handleSubmit(values: PaymentMethodFormInput) {
    if (!user || !canManage) return

    setSubmitting(true)
    setError('')
    setMessage('')

    try {
      if (modalMode === 'create') {
        await createPaymentMethod(values, user.uid)
        setMessage('Forma de pago creada correctamente.')
      } else if (editingMethod) {
        await updatePaymentMethod(editingMethod.id, values)
        setMessage('Forma de pago actualizada correctamente.')
      }

      setModalOpen(false)
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar la forma de pago.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(method: PaymentMethod) {
    if (!canManage) return
    const confirmed = await confirm({
      title: 'Eliminar forma de pago',
      message: `¿Eliminar "${method.name}"? Esta acción no se puede deshacer.`,
      confirmLabel: 'Sí, eliminar',
      tone: 'danger',
    })
    if (!confirmed) return

    setError('')
    setMessage('')

    try {
      await deletePaymentMethod(method.id)
      setMethods((current) => current.filter((item) => item.id !== method.id))
      setMessage(`Forma de pago "${method.name}" eliminada.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar la forma de pago.')
    }
  }

  if (!canManage) {
    return <Navigate to="/" replace />
  }

  return (
    <AppLayout title="Formas de pago" subtitle="Métodos aceptados en caja">
      <AnimatedPanel className="finance-panel panel-with-overlay">
        <PanelRefreshOverlay show={refreshing} />
        <div className="finance-panel-header">
          <div>
            <h2>Métodos de pago</h2>
            <p>Configura efectivo, transferencias, pago móvil y otros métodos para ventas.</p>
          </div>
          <div className="finance-panel-actions">
            <button type="button" className="finance-btn finance-btn-secondary" onClick={loadData}>
              Actualizar
            </button>
            <button type="button" className="finance-btn finance-btn-primary" onClick={openCreateModal}>
              Nueva forma de pago
            </button>
          </div>
        </div>

        {error && <div className="alert alert-error">{error}</div>}
        {message && <div className="alert alert-success">{message}</div>}

        {loading ? (
          <div className="finance-empty">Cargando formas de pago...</div>
        ) : methods.length === 0 ? (
          <div className="finance-empty">
            <strong>Sin formas de pago</strong>
            <p>Crea la primera forma de pago para usarla al vender.</p>
            <button type="button" className="finance-btn finance-btn-primary" onClick={openCreateModal}>
              Nueva forma de pago
            </button>
          </div>
        ) : (
          <div className="finance-table-wrap">
            <table className="finance-table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Monedas</th>
                  <th>Referencia</th>
                  <th>Por defecto</th>
                  <th>Estado</th>
                  <th className="table-actions-col">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {methods.map((method, index) => (
                  <AnimatedTableRow key={method.id} index={index}>
                    <td>
                      <strong>{method.name}</strong>
                    </td>
                    <td>{method.allowedCurrencies.join(', ') || '—'}</td>
                    <td>{method.requiresReference ? 'Sí' : 'No'}</td>
                    <td>{method.isDefaultForSales ? 'Sí' : '—'}</td>
                    <td>
                      <span className={`finance-badge ${method.active ? 'ok' : 'inactive'}`}>
                        {method.active ? 'Activa' : 'Inactiva'}
                      </span>
                    </td>
                    <td className="table-actions-col">
                      <TableActions>
                        <TableAction icon="edit" onClick={() => openEditModal(method)}>
                          Editar
                        </TableAction>
                        <TableAction icon="delete" tone="danger" onClick={() => handleDelete(method)}>
                          Eliminar
                        </TableAction>
                      </TableActions>
                    </td>
                  </AnimatedTableRow>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AnimatedPanel>

      <PaymentMethodFormModal
        open={modalOpen}
        mode={modalMode}
        initialValues={formValues}
        currencies={currencies}
        submitting={submitting}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmit}
      />
    </AppLayout>
  )
}
