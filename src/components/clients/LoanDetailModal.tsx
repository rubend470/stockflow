import { useEffect, useState } from 'react'
import {
  buildLoanHistory,
  listLoanPaymentsByBorrower,
  listLoansByBorrower,
} from '../../services/loanService'
import type { LoanBorrowerAccount, LoanHistoryEntry } from '../../types/loan'
import { formatBaseMoney } from '../../utils/formatMoney'
import { MoneyText } from '../ui/MoneyText'
import { ModalFrame } from '../ui/ModalFrame'

interface LoanDetailModalProps {
  open: boolean
  account: LoanBorrowerAccount | null
  onClose: () => void
  onCollect?: (account: LoanBorrowerAccount) => void
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('es', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function movementLabel(entry: LoanHistoryEntry) {
  if (entry.kind === 'payment') {
    return entry.reference
      ? `${entry.methodName} · Ref. ${entry.reference}`
      : entry.methodName
  }

  if (entry.notes) return entry.notes
  return 'Préstamo otorgado'
}

function statusLabel(entry: LoanHistoryEntry) {
  if (entry.kind === 'payment') {
    return entry.createdByName ? `Por ${entry.createdByName}` : 'Abono'
  }

  if (entry.status === 'paid') return 'Pagado'
  return `Pendiente · ${formatBaseMoney(entry.balanceInBase)}`
}

export function LoanDetailModal({
  open,
  account,
  onClose,
  onCollect,
}: LoanDetailModalProps) {
  const [history, setHistory] = useState<LoanHistoryEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open || !account) {
      setHistory([])
      setError('')
      return
    }

    let cancelled = false
    const borrowerPhone = account.borrowerPhone
    const borrowerName = account.borrowerName

    async function loadHistory() {
      setLoading(true)
      setError('')

      try {
        const [loans, payments] = await Promise.all([
          listLoansByBorrower(borrowerPhone, borrowerName),
          listLoanPaymentsByBorrower(borrowerPhone),
        ])

        if (!cancelled) {
          setHistory(buildLoanHistory(loans, payments))
        }
      } catch {
        if (!cancelled) {
          setError('No se pudo cargar el historial del prestatario.')
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
  }, [open, account?.borrowerKey, account?.lastActivityAt, account?.balanceInBase])

  if (!open || !account) return null

  return (
    <ModalFrame wide onClose={onClose}>
        <div className="finance-modal-header">
          <h2>{account.borrowerName}</h2>
          <p>
            Teléfono: <strong>{account.borrowerPhone}</strong>
          </p>
          <p>
            Saldo pendiente:{' '}
            <strong className={account.balanceInBase > 0 ? 'text-danger' : undefined}>
              {formatBaseMoney(account.balanceInBase)}
            </strong>
            {account.activeLoanCount > 0 && (
              <>
                {' '}
                · {account.activeLoanCount} préstamo(s) activo(s)
              </>
            )}
          </p>
        </div>

        <div className="finance-detail-section">
          <h3>Historial por fecha</h3>
          <p className="finance-detail-hint">
            Incluye préstamos otorgados, abonos y préstamos ya pagados.
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
                  </tr>
                </thead>
                <tbody>
                  {history.map((entry) => (
                    <tr key={entry.id}>
                      <td>{formatDateTime(entry.date)}</td>
                      <td>
                        <strong>
                          {entry.kind === 'payment' ? 'Pago / abono' : 'Préstamo'}
                        </strong>
                        <span className="inventory-subtext">{movementLabel(entry)}</span>
                      </td>
                      <td
                        className={
                          entry.kind === 'payment' ? 'finance-profit' : 'text-danger'
                        }
                      >
                        {entry.kind === 'payment' ? '-' : '+'}
                        {entry.kind === 'payment' ? (
                          <MoneyText amount={entry.amount} currencyCode={entry.currencyCode} />
                        ) : (
                          <MoneyText amount={entry.amount} currencyCode={entry.currencyCode} />
                        )}
                        {entry.kind === 'loan' && entry.currencyCode !== 'COP' && (
                          <span className="inventory-subtext">
                            {' '}
                            ({formatBaseMoney(entry.amountInBase)})
                          </span>
                        )}
                      </td>
                      <td>
                        <span
                          className={`finance-badge ${
                            entry.kind === 'payment' || entry.status === 'paid' ? 'ok' : ''
                          }`}
                        >
                          {statusLabel(entry)}
                        </span>
                      </td>
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
          {account.balanceInBase > 0 && onCollect && (
            <button
              type="button"
              className="finance-btn finance-btn-primary"
              onClick={() => onCollect(account)}
            >
              Cobrar abono
            </button>
          )}
        </div>
    </ModalFrame>
  )
}
