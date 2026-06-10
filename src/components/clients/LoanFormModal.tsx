import { useEffect, useMemo, useState } from 'react'
import { DEFAULT_BASE_CURRENCY_CODE } from '../../constants/currency'
import { convertToBase } from '../../utils/exchangeRates'
import type { Currency, ExchangeRate } from '../../types/finance'
import type { LoanBorrowerAccount } from '../../types/loan'
import { MoneyInput } from '../ui/MoneyInput'
import { MoneyText } from '../ui/MoneyText'
import { isValidPhone } from '../../utils/phone'
import { parseMoneyInput } from '../../utils/formatMoney'
import { ModalFrame } from '../ui/ModalFrame'

export interface LoanFormConfirmInput {
  borrowerName: string
  borrowerPhone: string
  amount: number
  currencyCode: string
  amountInBase: number
  notes?: string
}

interface LoanFormModalProps {
  open: boolean
  currencies: Currency[]
  exchangeRates: ExchangeRate[]
  frequentBorrowers: LoanBorrowerAccount[]
  submitting?: boolean
  onClose: () => void
  onConfirm: (input: LoanFormConfirmInput) => void
}

export function LoanFormModal({
  open,
  currencies,
  exchangeRates,
  frequentBorrowers,
  submitting = false,
  onClose,
  onConfirm,
}: LoanFormModalProps) {
  const [borrowerName, setBorrowerName] = useState('')
  const [borrowerPhone, setBorrowerPhone] = useState('')
  const [currencyCode, setCurrencyCode] = useState(DEFAULT_BASE_CURRENCY_CODE)
  const [amount, setAmount] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')

  const baseCurrencyCode =
    currencies.find((currency) => currency.isBase)?.code ?? DEFAULT_BASE_CURRENCY_CODE

  useEffect(() => {
    if (!open) return

    setBorrowerName('')
    setBorrowerPhone('')
    setAmount('')
    setNotes('')
    setError('')
    setCurrencyCode(baseCurrencyCode)
  }, [open, baseCurrencyCode])

  const amountInBase = useMemo(() => {
    const value = parseMoneyInput(amount)
    if (!value || value <= 0) return 0

    try {
      return convertToBase(value, currencyCode, baseCurrencyCode, exchangeRates)
    } catch {
      return 0
    }
  }, [amount, currencyCode, baseCurrencyCode, exchangeRates])

  if (!open) return null

  function selectBorrower(account: LoanBorrowerAccount) {
    setBorrowerName(account.borrowerName)
    setBorrowerPhone(account.borrowerPhone)
    setError('')
  }

  function handleConfirm() {
    const trimmedName = borrowerName.trim()
    const trimmedPhone = borrowerPhone.trim()
    const value = parseMoneyInput(amount)

    if (!trimmedName) {
      setError('El nombre es obligatorio.')
      return
    }

    if (!isValidPhone(trimmedPhone)) {
      setError('Ingresa un teléfono válido.')
      return
    }

    if (!value || value <= 0) {
      setError('Ingresa un monto mayor a cero.')
      return
    }

    let converted = 0
    try {
      converted = convertToBase(value, currencyCode, baseCurrencyCode, exchangeRates)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo convertir el monto.')
      return
    }

    if (converted <= 0) {
      setError('El monto en moneda base debe ser mayor a cero.')
      return
    }

    setError('')
    onConfirm({
      borrowerName: trimmedName,
      borrowerPhone: trimmedPhone,
      amount: value,
      currencyCode,
      amountInBase: converted,
      notes: notes.trim() || undefined,
    })
  }

  return (
    <ModalFrame onClose={onClose} closeDisabled={submitting}>
        <div className="finance-modal-header">
          <h2>Registrar préstamo</h2>
          <p>El monto sale de caja y queda registrado como deuda del prestatario.</p>
        </div>

        {frequentBorrowers.length > 0 && (
          <label className="finance-field finance-field-full">
            <span>Frecuentes</span>
            <div className="finance-chip-group">
              {frequentBorrowers.map((account) => (
                <button
                  key={account.borrowerKey}
                  type="button"
                  className={`finance-chip ${
                    borrowerName === account.borrowerName &&
                    borrowerPhone === account.borrowerPhone
                      ? 'selected'
                      : ''
                  }`}
                  onClick={() => selectBorrower(account)}
                  disabled={submitting}
                >
                  {account.borrowerName}
                </button>
              ))}
            </div>
          </label>
        )}

        <div className="finance-form-grid">
          <label className="finance-field">
            <span>Nombre</span>
            <input
              type="text"
              value={borrowerName}
              onChange={(event) => setBorrowerName(event.target.value)}
              disabled={submitting}
              autoFocus
            />
          </label>

          <label className="finance-field">
            <span>Teléfono</span>
            <input
              type="tel"
              value={borrowerPhone}
              onChange={(event) => setBorrowerPhone(event.target.value)}
              disabled={submitting}
            />
          </label>

          <label className="finance-field">
            <span>Moneda</span>
            <select
              value={currencyCode}
              onChange={(event) => setCurrencyCode(event.target.value)}
              disabled={submitting || currencies.length === 0}
            >
              {currencies.map((currency) => (
                <option key={currency.id} value={currency.code}>
                  {currency.code} · {currency.name}
                </option>
              ))}
            </select>
          </label>

          <label className="finance-field">
            <span>Monto</span>
            <MoneyInput value={amount} onChange={setAmount} disabled={submitting} />
          </label>

          <label className="finance-field finance-field-full">
            <span>Notas (opcional)</span>
            <input
              type="text"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              disabled={submitting}
            />
          </label>
        </div>

        {amountInBase > 0 && currencyCode !== baseCurrencyCode && (
          <p className="pos-credit-hint">
            Equivalente en caja: <MoneyText amount={amountInBase} />
          </p>
        )}

        {error && <div className="alert alert-error">{error}</div>}

        <div className="finance-form-actions">
          <button
            type="button"
            className="finance-btn finance-btn-secondary"
            onClick={onClose}
            disabled={submitting}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="finance-btn finance-btn-primary"
            onClick={handleConfirm}
            disabled={submitting || currencies.length === 0}
          >
            {submitting ? 'Guardando...' : 'Registrar préstamo'}
          </button>
        </div>
    </ModalFrame>
  )
}
