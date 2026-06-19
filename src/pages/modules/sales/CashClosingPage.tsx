import { useEffect, useState } from 'react'
import { AppLayout } from '../../../components/layout/AppLayout'
import { CashClosureDetail } from '../../../components/sales/CashClosureDetail'
import { CashClosureModal } from '../../../components/sales/CashClosureModal'
import { AnimatedPanel, AnimatedTableRow } from '../../../components/ui/motion'
import { MoneyText } from '../../../components/ui/MoneyText'
import { TableAction, TableActions } from '../../../components/ui/TableActions'
import { useAuth } from '../../../context/AuthContext'
import { useConfirm } from '../../../context/ConfirmContext'
import {
  createCashClosure,
  deleteCashClosure,
  listCashClosures,
} from '../../../services/cashClosureService'
import type { CashClosure } from '../../../types/cashClosure'
import { getExpectedCashInBase } from '../../../utils/cashClosure'
import { formatClosureDate, formatDateTime } from '../../../utils/dates'
import { userHasAnyMenuPermission } from '../../../utils/menuPermissions'

export function CashClosingPage() {
  const { user } = useAuth()
  const confirm = useConfirm()
  const [closures, setClosures] = useState<CashClosure[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedClosure, setSelectedClosure] = useState<CashClosure | null>(null)

  const canDelete = userHasAnyMenuPermission(user, ['settings', 'users'])

  useEffect(() => {
    loadClosures()
  }, [])

  async function loadClosures() {
    setLoading(true)
    setError('')

    try {
      const items = await listCashClosures()
      setClosures(items)
      setSelectedClosure((current) => {
        if (!current) return items[0] ?? null
        return items.find((item) => item.id === current.id) ?? items[0] ?? null
      })
    } catch {
      setError('No se pudieron cargar los cierres de caja.')
    } finally {
      setLoading(false)
    }
  }

  async function handleCreateClosure(closureDate: string) {
    if (!user) return

    setSubmitting(true)
    setError('')
    setMessage('')

    try {
      const created = await createCashClosure(closureDate, user.uid, user.name)
      setMessage(`Cierre del ${formatClosureDate(closureDate)} registrado.`)
      setModalOpen(false)
      await loadClosures()
      setSelectedClosure(created)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo generar el cierre.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDeleteClosure(closure: CashClosure) {
    if (!canDelete) return

    const confirmed = await confirm({
      title: 'Borrar cierre de caja',
      message: `¿Eliminar el cierre del ${formatClosureDate(closure.closureDate)}? Podrás generarlo de nuevo para esa fecha.`,
      confirmLabel: 'Sí, borrar',
      tone: 'danger',
    })
    if (!confirmed) return

    setDeletingId(closure.id)
    setError('')
    setMessage('')

    try {
      await deleteCashClosure(closure.id)
      setMessage(`Cierre del ${formatClosureDate(closure.closureDate)} eliminado.`)
      if (selectedClosure?.id === closure.id) {
        setSelectedClosure(null)
      }
      await loadClosures()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo borrar el cierre.')
    } finally {
      setDeletingId('')
    }
  }

  return (
    <AppLayout title="Cierre de caja" subtitle="Cuánto debe quedar en caja al final del día">
      <AnimatedPanel className="finance-panel">
        <div className="finance-panel-header">
          <div>
            <h2>Cierres registrados</h2>
            <p>
              Genera el cierre por fecha. El total <strong>Debe en caja</strong> descuenta
              préstamos y cambio de moneda del día.
            </p>
          </div>
          <div className="finance-panel-actions">
            <button type="button" className="finance-btn finance-btn-secondary" onClick={loadClosures}>
              Actualizar
            </button>
            <button type="button" className="finance-btn finance-btn-primary" onClick={() => setModalOpen(true)}>
              Hacer cierre
            </button>
          </div>
        </div>

        {error && <div className="alert alert-error">{error}</div>}
        {message && <div className="alert alert-success">{message}</div>}

        {loading ? (
          <div className="finance-empty">Cargando cierres...</div>
        ) : closures.length === 0 ? (
          <div className="finance-empty">
            <strong>Sin cierres registrados</strong>
            <p>Pulsa <strong>Hacer cierre</strong> para generar el primero.</p>
          </div>
        ) : (
          <div className="cash-closure-layout">
            <div className="finance-table-wrap cash-closure-list">
              <table className="finance-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Debe en caja</th>
                    <th>Ventas</th>
                    <th>Cambios</th>
                    <th>Registrado</th>
                    {canDelete && <th className="table-actions-col">Acciones</th>}
                  </tr>
                </thead>
                <tbody>
                  {closures.map((closure, index) => (
                    <AnimatedTableRow
                      key={closure.id}
                      index={index}
                      className={
                        selectedClosure?.id === closure.id
                          ? 'finance-clickable-row selected'
                          : 'finance-clickable-row'
                      }
                      onClick={() => setSelectedClosure(closure)}
                    >
                      <td>
                        <strong>{formatClosureDate(closure.closureDate)}</strong>
                      </td>
                      <td>
                        <MoneyText amount={getExpectedCashInBase(closure.report)} />
                      </td>
                      <td>{closure.report.salesCount}</td>
                      <td>{closure.report.exchangesCount ?? closure.report.exchanges?.length ?? 0}</td>
                      <td>
                        {formatDateTime(closure.createdAt)}
                        <small className="cash-closure-meta"> · {closure.createdByName}</small>
                      </td>
                      {canDelete && (
                        <td className="table-actions-col" onClick={(event) => event.stopPropagation()}>
                          <TableActions>
                            <TableAction
                              icon="delete"
                              tone="danger"
                              disabled={deletingId === closure.id}
                              onClick={() => handleDeleteClosure(closure)}
                            >
                              {deletingId === closure.id ? 'Borrando...' : 'Borrar'}
                            </TableAction>
                          </TableActions>
                        </td>
                      )}
                    </AnimatedTableRow>
                  ))}
                </tbody>
              </table>
            </div>

            {selectedClosure && (
              <div className="cash-closure-detail-panel">
                <CashClosureDetail
                  report={selectedClosure.report}
                  createdAt={selectedClosure.createdAt}
                  createdByName={selectedClosure.createdByName}
                  canDelete={canDelete}
                  deleting={deletingId === selectedClosure.id}
                  onDelete={() => handleDeleteClosure(selectedClosure)}
                />
              </div>
            )}
          </div>
        )}
      </AnimatedPanel>

      <CashClosureModal
        open={modalOpen}
        submitting={submitting}
        onClose={() => setModalOpen(false)}
        onConfirm={handleCreateClosure}
      />
    </AppLayout>
  )
}
