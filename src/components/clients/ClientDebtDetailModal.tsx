import { useEffect, useState } from 'react'
import {
  buildClientDebtHistory,
  listDebtPaymentsByClient,
  listDebtsByClient,
} from '../../services/debtService'
import type { ClientDebtAccount, DebtHistoryEntry } from '../../types/debt'
import { formatBaseMoney } from '../../utils/formatMoney'
import { ModalFrame } from '../ui/ModalFrame'

interface ClientDebtDetailModalProps {
  open: boolean
  account: ClientDebtAccount | null
  onClose: () => void
  onCollect?: (account: ClientDebtAccount) => void
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('es', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function movementLabel(entry: DebtHistoryEntry) {
  if (entry.kind === 'payment') {
    return entry.reference
      ? `${entry.methodName} · Ref. ${entry.reference}`
      : entry.methodName
  }

  if (entry.saleId) return 'Venta a crédito'
  if (entry.notes) return entry.notes
  return 'Deuda registrada'
}

function statusLabel(entry: DebtHistoryEntry) {
  if (entry.kind === 'payment') {
    return 'Abono'
  }

  if (entry.status === 'paid') return 'Pagada'
  if (entry.status === 'overdue') return 'Vencida'
  return `Pendiente · ${formatBaseMoney(entry.balance)}`
}

export function ClientDebtDetailModal({
  open,
  account,
  onClose,
  onCollect,
}: ClientDebtDetailModalProps) {
  const [history, setHistory] = useState<DebtHistoryEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open || !account) {
      setHistory([])
      setError('')
      return
    }

    let cancelled = false
    const clientId = account.clientId

    async function loadHistory() {
      setLoading(true)
      setError('')

      try {
        const [debts, payments] = await Promise.all([
          listDebtsByClient(clientId),
          listDebtPaymentsByClient(clientId),
        ])

        if (!cancelled) {
          setHistory(buildClientDebtHistory(debts, payments))
        }
      } catch {
        if (!cancelled) {
          setError('No se pudo cargar el historial del cliente.')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadHistory()

    return () => {
      cancelled = true
    }
  }, [open, account?.clientId, account?.lastActivityAt, account?.balance])

  if (!open || !account) return null

  return (
    <ModalFrame wide onClose={onClose}>
        <div className="finance-modal-header">
          <h2>{account.clientName}</h2>
          <p>
            Saldo pendiente:{' '}
            <strong className={account.balance > 0 ? 'text-danger' : undefined}>
              {formatBaseMoney(account.balance)}
            </strong>
            {account.activeDebtCount > 0 && (
              <>
                {' '}
                · {account.activeDebtCount} deuda(s) activa(s)
              </>
            )}
          </p>
        </div>

        <div className="finance-detail-section">
          <h3>Historial por fecha</h3>
          <p className="finance-detail-hint">
            Incluye deudas registradas, abonos y deudas ya pagadas.
          </p>

          {error && <div className="alert alert-error">{error}</div>}

          {loading ? (
            <div className="finance-empty">Cargando historial...</div>
          ) : history.length === 0 ? (
            <div className="finance-empty">Sin movimientos registrados.</div>
          ) : (
            <div className="finance-table-wrap">
              <table className="finance-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Movimiento</th>
                    <th>Monto</th>
                    <th>Estado</th>
                    <th>Usuario</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((entry) => (
                    <tr key={entry.id}>
                      <td>{formatDateTime(entry.date)}</td>
                      <td>
                        <strong>
                          {entry.kind === 'payment' ? 'Pago / abono' : 'Deuda'}
                        </strong>
                        <span className="inventory-subtext">{movementLabel(entry)}</span>
                      </td>
                      <td
                        className={
                          entry.kind === 'payment' ? 'finance-profit' : 'text-danger'
                        }
                      >
                        {entry.kind === 'payment' ? '-' : '+'}
                        {formatBaseMoney(entry.amount)}
                      </td>
                      <td>
                        <span
                          className={`finance-badge ${
                            entry.kind === 'payment' || entry.status === 'paid'
                              ? 'ok'
                              : entry.status === 'overdue'
                                ? 'inactive'
                                : ''
                          }`}
                        >
                          {statusLabel(entry)}
                        </span>
                      </td>
                      <td>{entry.kind === 'payment' ? entry.createdByName || '—' : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="finance-form-actions">
          <button type="button" className="finance-btn finance-btn-secondary" onClick={onClose}>
            Cerrar
          </button>
          {account.balance > 0 && onCollect && (
            <button
              type="button"
              className="finance-btn finance-btn-primary"
              onClick={() => onCollect(account)}
            >
              Cobrar
            </button>
          )}
        </div>
    </ModalFrame>
  )
}
