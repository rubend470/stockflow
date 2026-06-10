import { useCallback, useEffect, useMemo, useState } from 'react'
import { DEFAULT_BASE_CURRENCY_CODE } from '../../constants/currency'
import {
  buildLoanHistory,
  listLoanPaymentsByBorrower,
  listLoansByBorrower,
} from '../../services/loanService'
import type { LoanHistoryEntry } from '../../types/loan'
import { convertToBase } from '../../utils/exchangeRates'
import type { Currency, ExchangeRate, PaymentMethod } from '../../types/finance'
import { pickDefaultPaymentMethod } from '../../types/finance'
import { MoneyInput } from '../ui/MoneyInput'
import { MoneyText } from '../ui/MoneyText'
import {
  formatBaseMoney,
  formatMoneyInputValue,
  parseMoneyInput,
  roundMoney,
} from '../../utils/formatMoney'
import { ModalFrame } from '../ui/ModalFrame'

type PaymentTarget =
  | { type: 'total'; balanceInBase: number }
  | {
      type: 'loan'
      loanId: string
      balanceInBase: number
      currencyCode: string
      label: string
    }

interface LoanPaymentModalProps {
  open: boolean
  borrowerName: string
  borrowerPhone: string
  balanceInBase: number
  currencies: Currency[]
  exchangeRates: ExchangeRate[]
  paymentMethods: PaymentMethod[]
  submitting?: boolean
  onClose: () => void
  onConfirm: (input: {
    amount: number
    currencyCode: string
    amountInBase: number
    methodName: string
    reference?: string
    loanId?: string
    targetBalanceInBase: number
  }) => boolean | Promise<boolean>
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

function isCollectableLoan(entry: LoanHistoryEntry) {
  return entry.kind === 'loan' && entry.status === 'active' && entry.balanceInBase > 0
}

export function LoanPaymentModal({
  open,
  borrowerName,
  borrowerPhone,
  balanceInBase,
  currencies,
  exchangeRates,
  paymentMethods,
  submitting = false,
  onClose,
  onConfirm,
}: LoanPaymentModalProps) {
  const [history, setHistory] = useState<LoanHistoryEntry[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [historyError, setHistoryError] = useState('')
  const [paymentTarget, setPaymentTarget] = useState<PaymentTarget>({
    type: 'total',
    balanceInBase: 0,
  })
  const [amount, setAmount] = useState('')
  const [currencyCode, setCurrencyCode] = useState(DEFAULT_BASE_CURRENCY_CODE)
  const [methodId, setMethodId] = useState('')
  const [reference, setReference] = useState('')
  const [formError, setFormError] = useState('')

  const baseCurrencyCode =
    currencies.find((currency) => currency.isBase)?.code ?? DEFAULT_BASE_CURRENCY_CODE

  const defaultMethodId = useMemo(
    () => pickDefaultPaymentMethod(paymentMethods)?.id ?? '',
    [paymentMethods],
  )

  const selectedMethod = useMemo(
    () => paymentMethods.find((method) => method.id === methodId) ?? null,
    [paymentMethods, methodId],
  )

  const effectiveBalanceInBase = paymentTarget.balanceInBase

  const maxInSelectedCurrency = useMemo(() => {
    if (effectiveBalanceInBase <= 0) return 0
    if (currencyCode === baseCurrencyCode) return effectiveBalanceInBase

    try {
      const factor =
        effectiveBalanceInBase / convertToBase(1, currencyCode, baseCurrencyCode, exchangeRates)
      return roundMoney(factor)
    } catch {
      return effectiveBalanceInBase
    }
  }, [effectiveBalanceInBase, currencyCode, baseCurrencyCode, exchangeRates])

  const amountInBase = useMemo(() => {
    const value = parseMoneyInput(amount)
    if (!value || value <= 0) return 0

    try {
      return convertToBase(value, currencyCode, baseCurrencyCode, exchangeRates)
    } catch {
      return 0
    }
  }, [amount, currencyCode, baseCurrencyCode, exchangeRates])

  const isFullPayment =
    amountInBase > 0 && Math.abs(amountInBase - effectiveBalanceInBase) <= 0.01
  const newBalance =
    amountInBase > 0
      ? Math.max(effectiveBalanceInBase - amountInBase, 0)
      : effectiveBalanceInBase

  const loadHistory = useCallback(async () => {
    if (!borrowerPhone) return

    setLoadingHistory(true)
    setHistoryError('')

    try {
      const [loans, payments] = await Promise.all([
        listLoansByBorrower(borrowerPhone, borrowerName),
        listLoanPaymentsByBorrower(borrowerPhone),
      ])
      setHistory(buildLoanHistory(loans, payments))
    } catch {
      setHistoryError('No se pudo cargar el historial del prestatario.')
      setHistory([])
    } finally {
      setLoadingHistory(false)
    }
  }, [borrowerPhone, borrowerName])

  useEffect(() => {
    if (!open || !borrowerPhone || balanceInBase <= 0) return
    setPaymentTarget({ type: 'total', balanceInBase })
    setFormError('')
    setCurrencyCode(baseCurrencyCode)
    setMethodId(defaultMethodId)
    void loadHistory()
  }, [open, borrowerPhone, balanceInBase, baseCurrencyCode, defaultMethodId, loadHistory])

  useEffect(() => {
    if (!open) return
    setCurrencyCode(
      paymentTarget.type === 'loan' ? paymentTarget.currencyCode : baseCurrencyCode,
    )
    setReference('')
    setFormError('')
  }, [open, paymentTarget, baseCurrencyCode])

  useEffect(() => {
    if (!open || effectiveBalanceInBase <= 0) return
    setAmount(formatMoneyInputValue(maxInSelectedCurrency))
  }, [open, paymentTarget, maxInSelectedCurrency, currencyCode])

  if (!open || balanceInBase <= 0) return null

  function openTotalPayment() {
    setPaymentTarget({ type: 'total', balanceInBase })
  }

  function openLoanPayment(entry: LoanHistoryEntry) {
    if (entry.kind !== 'loan' || entry.status !== 'active' || entry.balanceInBase <= 0) return

    setPaymentTarget({
      type: 'loan',
      loanId: entry.loanId,
      balanceInBase: entry.balanceInBase,
      currencyCode: entry.currencyCode,
      label: movementLabel(entry),
    })
  }

  async function handleConfirm() {
    const value = parseMoneyInput(amount)

    if (!value || value <= 0) {
      setFormError('Ingresa un monto válido.')
      return
    }

    let converted = 0
    try {
      converted = convertToBase(value, currencyCode, baseCurrencyCode, exchangeRates)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'No se pudo convertir el monto.')
      return
    }

    if (converted > effectiveBalanceInBase + 0.01) {
      setFormError(`El abono no puede superar ${formatBaseMoney(effectiveBalanceInBase)}.`)
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
      currencyCode,
      amountInBase: converted,
      methodName: selectedMethod.name,
      reference: reference.trim() || undefined,
      loanId: paymentTarget.type === 'loan' ? paymentTarget.loanId : undefined,
      targetBalanceInBase: effectiveBalanceInBase,
    })
    if (!success) return

    setPaymentTarget({ type: 'total', balanceInBase })
    await loadHistory()
  }

  const targetLabel =
    paymentTarget.type === 'total'
      ? `Saldo total · máx. ${formatBaseMoney(balanceInBase)}`
      : `${paymentTarget.label} · máx. ${formatBaseMoney(paymentTarget.balanceInBase)}`

  return (
    <ModalFrame wide onClose={onClose} closeDisabled={submitting}>
      <div className="finance-modal-header">
        <h2>{borrowerName}</h2>
        <p>
          Teléfono: <strong>{borrowerPhone}</strong>
        </p>
        <p>
          Saldo pendiente:{' '}
          <strong className="text-danger">{formatBaseMoney(balanceInBase)}</strong>
        </p>
      </div>

      <button
        type="button"
        className="collect-total-btn"
        onClick={openTotalPayment}
        disabled={submitting}
      >
        <span>Pagar deuda total</span>
        <strong>{formatBaseMoney(balanceInBase)}</strong>
      </button>

      <div className="collect-form-compact">
        <p className="collect-target-label">Cobrando: {targetLabel}</p>

        <div className="finance-form-grid">
          <label className="finance-field">
            <span>Moneda</span>
            <select
              className="finance-select"
              value={currencyCode}
              onChange={(event) => setCurrencyCode(event.target.value)}
              disabled={submitting || currencies.length === 0}
            >
              {currencies.map((currency) => (
                <option key={currency.id} value={currency.code}>
                  {currency.code}
                </option>
              ))}
            </select>
          </label>

          <label className="finance-field finance-field-full">
            <span>Monto</span>
            <div className="pos-amount-row">
              <MoneyInput
                value={amount}
                onChange={setAmount}
                disabled={submitting}
              />
              <button
                type="button"
                className="pos-btn pos-btn-secondary"
                onClick={() => setAmount(formatMoneyInputValue(maxInSelectedCurrency))}
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

        {amountInBase > 0 && amountInBase <= effectiveBalanceInBase + 0.01 && (
          <div className="pos-credit-hint">
            {isFullPayment ? (
              <>
                Se marcará como <strong>pagado</strong>
                {paymentTarget.type === 'loan' ? ' este préstamo' : ' el saldo pendiente'}.
              </>
            ) : (
              <>
                Abono de <MoneyText amount={amountInBase} /> · Nuevo saldo:{' '}
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
          Préstamos otorgados y abonos registrados.
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
                      <strong>{entry.kind === 'payment' ? 'Pago / abono' : 'Préstamo'}</strong>
                      <span className="inventory-subtext">{movementLabel(entry)}</span>
                    </td>
                    <td className={entry.kind === 'payment' ? 'finance-profit' : 'text-danger'}>
                      {entry.kind === 'payment' ? '-' : '+'}
                      <MoneyText amount={entry.amount} currencyCode={entry.currencyCode} />
                      {entry.kind === 'loan' && entry.currencyCode !== baseCurrencyCode && (
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
                    <td className="table-actions-col">
                      {isCollectableLoan(entry) ? (
                        <button
                          type="button"
                          className="finance-btn finance-btn-primary collect-row-btn"
                          onClick={() => openLoanPayment(entry)}
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
