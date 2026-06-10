import { useCallback, useEffect, useMemo, useState } from 'react'
import { DEFAULT_BASE_CURRENCY_CODE } from '../../constants/currency'
import {
  buildClientDebtHistory,
  listDebtPaymentsByClient,
  listDebtsByClient,
} from '../../services/debtService'
import type { DebtHistoryEntry } from '../../types/debt'
import { pickDefaultPaymentMethod, type PaymentMethod } from '../../types/finance'
import { MoneyInput } from '../ui/MoneyInput'
import { formatBaseMoney, formatMoneyInputValue, parseMoneyInput } from '../../utils/formatMoney'
import { ModalFrame } from '../ui/ModalFrame'

type PaymentTarget =
  | { type: 'total'; balance: number }
  | { type: 'debt'; debtId: string; balance: number; label: string }

interface DebtPaymentModalProps {
  open: boolean
  clientId: string
  clientName: string
  balance: number
  paymentMethods: PaymentMethod[]
  submitting?: boolean
  onClose: () => void
  onConfirm: (input: {
    amount: number
    methodName: string
    reference?: string
    debtId?: string
    targetBalance: number
  }) => boolean | Promise<boolean>
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
    return entry.createdByName ? `Por ${entry.createdByName}` : 'Abono'
  }

  if (entry.status === 'paid') return 'Pagada'
  if (entry.status === 'overdue') return 'Vencida'
  return `Pendiente · ${formatBaseMoney(entry.balance)}`
}

function isCollectableDebt(entry: DebtHistoryEntry) {
  return entry.kind === 'debt' && entry.status === 'active' && entry.balance > 0
}

export function DebtPaymentModal({
  open,
  clientId,
  clientName,
  balance,
  paymentMethods,
  submitting = false,
  onClose,
  onConfirm,
}: DebtPaymentModalProps) {
  const [history, setHistory] = useState<DebtHistoryEntry[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [historyError, setHistoryError] = useState('')
  const [paymentTarget, setPaymentTarget] = useState<PaymentTarget>({
    type: 'total',
    balance: 0,
  })
  const [amount, setAmount] = useState('')
  const [methodId, setMethodId] = useState('')
  const [reference, setReference] = useState('')
  const [formError, setFormError] = useState('')

  const defaultMethodId = useMemo(
    () => pickDefaultPaymentMethod(paymentMethods)?.id ?? '',
    [paymentMethods],
  )

  const selectedMethod = useMemo(
    () => paymentMethods.find((method) => method.id === methodId) ?? null,
    [paymentMethods, methodId],
  )

  const effectiveBalance = paymentTarget.balance

  const parsedAmount = parseMoneyInput(amount)
  const isFullPayment =
    effectiveBalance > 0 &&
    parsedAmount > 0 &&
    Math.abs(parsedAmount - effectiveBalance) <= 0.01
  const newBalance =
    parsedAmount > 0 ? Math.max(effectiveBalance - parsedAmount, 0) : effectiveBalance

  const loadHistory = useCallback(async () => {
    if (!clientId) return

    setLoadingHistory(true)
    setHistoryError('')

    try {
      const [debts, payments] = await Promise.all([
        listDebtsByClient(clientId),
        listDebtPaymentsByClient(clientId),
      ])
      setHistory(buildClientDebtHistory(debts, payments))
    } catch {
      setHistoryError('No se pudo cargar el historial del cliente.')
      setHistory([])
    } finally {
      setLoadingHistory(false)
    }
  }, [clientId])

  useEffect(() => {
    if (!open || !clientId || balance <= 0) return
    setPaymentTarget({ type: 'total', balance })
    setAmount(formatMoneyInputValue(balance))
    setFormError('')
    setMethodId(defaultMethodId)
    void loadHistory()
  }, [open, clientId, balance, defaultMethodId, loadHistory])

  useEffect(() => {
    if (!open) return
    setAmount(formatMoneyInputValue(paymentTarget.balance))
    setReference('')
    setFormError('')
  }, [open, paymentTarget])

  if (!open || balance <= 0) return null

  function openTotalPayment() {
    setPaymentTarget({ type: 'total', balance })
  }

  function openDebtPayment(entry: DebtHistoryEntry) {
    if (entry.kind !== 'debt' || entry.status !== 'active' || entry.balance <= 0) return

    setPaymentTarget({
      type: 'debt',
      debtId: entry.debtId,
      balance: entry.balance,
      label: movementLabel(entry),
    })
  }

  async function handleConfirm() {
    const value = parseMoneyInput(amount)

    if (!value || value <= 0) {
      setFormError('Ingresa un monto válido.')
      return
    }

    if (value > effectiveBalance + 0.01) {
      setFormError(`El pago no puede superar ${formatBaseMoney(effectiveBalance)}.`)
      return
    }

    if (!selectedMethod) {
      setFormError('Selecciona una forma de pago.')
      return
    }

    if (selectedMethod.requiresReference && !reference.trim()) {
      setFormError('Esta forma de pago requiere referencia.')
      return
    }

    setFormError('')
    const success = await onConfirm({
      amount: value,
      methodName: selectedMethod.name,
      reference: reference.trim() || undefined,
      debtId: paymentTarget.type === 'debt' ? paymentTarget.debtId : undefined,
      targetBalance: effectiveBalance,
    })
    if (!success) return

    setPaymentTarget({ type: 'total', balance })
    await loadHistory()
  }

  const targetLabel =
    paymentTarget.type === 'total'
      ? `Saldo total · máx. ${formatBaseMoney(balance)}`
      : `${paymentTarget.label} · máx. ${formatBaseMoney(paymentTarget.balance)}`

  return (
    <ModalFrame wide onClose={onClose} closeDisabled={submitting}>
      <div className="finance-modal-header">
        <h2>{clientName}</h2>
        <p>
          Saldo pendiente:{' '}
          <strong className="text-danger">{formatBaseMoney(balance)}</strong>
        </p>
      </div>

      <button
        type="button"
        className="collect-total-btn"
        onClick={openTotalPayment}
        disabled={submitting}
      >
        <span>Pagar deuda total</span>
        <strong>{formatBaseMoney(balance)}</strong>
      </button>

      <div className="collect-form-compact">
        <p className="collect-target-label">Cobrando: {targetLabel}</p>

        <div className="finance-form-grid">
          <label className="finance-field finance-field-full">
            <span>Monto ({DEFAULT_BASE_CURRENCY_CODE})</span>
            <div className="pos-amount-row">
              <MoneyInput
                max={effectiveBalance}
                value={amount}
                onChange={setAmount}
                disabled={submitting}
              />
              <button
                type="button"
                className="pos-btn pos-btn-secondary"
                onClick={() => setAmount(formatMoneyInputValue(effectiveBalance))}
                disabled={submitting}
              >
                Pagar todo
              </button>
            </div>
          </label>

          <label className="finance-field finance-field-full">
            <span>Forma de pago</span>
            <select
              className="finance-select"
              value={methodId}
              onChange={(event) => setMethodId(event.target.value)}
              disabled={submitting || paymentMethods.length === 0}
            >
              {paymentMethods.length === 0 ? (
                <option value="">Sin formas de pago configuradas</option>
              ) : (
                <>
                  {!methodId && <option value="">Selecciona forma de pago</option>}
                  {paymentMethods.map((method) => (
                    <option key={method.id} value={method.id}>
                      {method.name}
                    </option>
                  ))}
                </>
              )}
            </select>
          </label>

          {selectedMethod?.requiresReference && (
            <label className="finance-field finance-field-full">
              <span>Referencia</span>
              <input
                type="text"
                value={reference}
                onChange={(event) => setReference(event.target.value)}
                disabled={submitting}
                placeholder="Nº de referencia o comprobante"
              />
            </label>
          )}
        </div>

        {parsedAmount > 0 && parsedAmount <= effectiveBalance + 0.01 && (
          <div className="pos-credit-hint">
            {isFullPayment ? (
              <>
                Se marcará como <strong>pagada</strong>
                {paymentTarget.type === 'debt' ? ' esta deuda' : ' el saldo pendiente'}.
              </>
            ) : (
              <>
                Abono de {formatBaseMoney(parsedAmount)} · Nuevo saldo:{' '}
                <strong>{formatBaseMoney(newBalance)}</strong>
              </>
            )}
          </div>
        )}

        {formError && <div className="alert alert-error">{formError}</div>}

        <div className="finance-form-actions collect-form-actions">
          <button
            type="button"
            className="finance-btn finance-btn-primary"
            onClick={handleConfirm}
            disabled={submitting || paymentMethods.length === 0}
          >
            {submitting
              ? 'Guardando...'
              : isFullPayment
                ? 'Confirmar pago'
                : 'Registrar abono'}
          </button>
        </div>
      </div>

      <div className="finance-detail-section">
        <h3>Historial</h3>
        <p className="finance-detail-hint">
          Ventas a crédito, deudas manuales y abonos registrados.
        </p>

        {historyError && <div className="alert alert-error">{historyError}</div>}

        {loadingHistory ? (
          <div className="finance-empty">Cargando historial...</div>
        ) : history.length === 0 ? (
          <div className="finance-empty">Sin movimientos registrados.</div>
        ) : (
          <div className="finance-table-wrap collect-history-table">
            <table className="finance-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Movimiento</th>
                  <th>Monto</th>
                  <th>Estado</th>
                  <th className="table-actions-col">Acción</th>
                </tr>
              </thead>
              <tbody>
                {history.map((entry) => (
                  <tr key={entry.id}>
                    <td>{formatDateTime(entry.date)}</td>
                    <td>
                      <strong>{entry.kind === 'payment' ? 'Pago / abono' : 'Deuda'}</strong>
                      <span className="inventory-subtext">{movementLabel(entry)}</span>
                    </td>
                    <td className={entry.kind === 'payment' ? 'finance-profit' : 'text-danger'}>
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
                    <td className="table-actions-col">
                      {isCollectableDebt(entry) ? (
                        <button
                          type="button"
                          className="finance-btn finance-btn-primary collect-row-btn"
                          onClick={() => openDebtPayment(entry)}
                          disabled={submitting}
                        >
                          Abonar
                        </button>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="finance-form-actions">
        <button
          type="button"
          className="finance-btn finance-btn-secondary"
          onClick={onClose}
          disabled={submitting}
        >
          Cerrar
        </button>
      </div>
    </ModalFrame>
  )
}
