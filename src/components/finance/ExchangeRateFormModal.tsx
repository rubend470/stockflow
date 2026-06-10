import { useEffect, useState } from 'react'
import { MoneyInput } from '../ui/MoneyInput'
import type { Currency, ExchangeRateFormInput } from '../../types/finance'
import { ModalFrame } from '../ui/ModalFrame'

interface ExchangeRateFormModalProps {
  open: boolean
  mode: 'create' | 'edit'
  currencies: Currency[]
  baseCurrencyCode: string
  initialValues: ExchangeRateFormInput
  submitting: boolean
  onClose: () => void
  onSubmit: (values: ExchangeRateFormInput) => void
}

export function ExchangeRateFormModal({
  open,
  mode,
  currencies,
  baseCurrencyCode,
  initialValues,
  submitting,
  onClose,
  onSubmit,
}: ExchangeRateFormModalProps) {
  const [values, setValues] = useState<ExchangeRateFormInput>(initialValues)

  useEffect(() => {
    if (open) setValues(initialValues)
  }, [open, initialValues])

  if (!open) return null

  const activeCurrencies = currencies.filter((currency) => currency.active)

  function handleSubmit() {
    onSubmit(values)
  }

  return (
    <ModalFrame onClose={onClose} closeDisabled={submitting}>
        <div className="finance-modal-header">
          <h2>{mode === 'create' ? 'Nueva tasa de conversión' : 'Editar tasa'}</h2>
          <p>
            {mode === 'create'
              ? 'Define cuánto equivale un monto en una moneda respecto a otra.'
              : 'Actualiza los montos cuando cambie la tasa del día.'}{' '}
            La moneda principal del sistema es <strong>{baseCurrencyCode}</strong>.
          </p>
        </div>

        <div className="finance-form-grid">
          <label className="finance-field">
            <span>Desde</span>
            <select
              value={values.fromCurrency}
              onChange={(event) =>
                setValues((current) => ({ ...current, fromCurrency: event.target.value }))
              }
              disabled={submitting || mode === 'edit'}
            >
              <option value="">Seleccionar...</option>
              {activeCurrencies.map((currency) => (
                <option key={currency.id} value={currency.code}>
                  {currency.code} · {currency.name}
                </option>
              ))}
            </select>
          </label>

          <label className="finance-field">
            <span>Hasta</span>
            <select
              value={values.toCurrency}
              onChange={(event) =>
                setValues((current) => ({ ...current, toCurrency: event.target.value }))
              }
              disabled={submitting || mode === 'edit'}
            >
              <option value="">Seleccionar...</option>
              {activeCurrencies.map((currency) => (
                <option key={currency.id} value={currency.code}>
                  {currency.code} · {currency.name}
                </option>
              ))}
            </select>
          </label>

          <label className="finance-field">
            <span>Monto origen</span>
            <MoneyInput
              min="0.01"
              value={values.fromAmount}
              onChange={(next) => {
                const parsed = next.trim() === '' ? 0 : Number(next)
                setValues((current) => ({
                  ...current,
                  fromAmount: Number.isFinite(parsed) ? parsed : current.fromAmount,
                }))
              }}
              disabled={submitting}
            />
          </label>

          <label className="finance-field">
            <span>Monto destino</span>
            <MoneyInput
              min="0.01"
              value={values.toAmount}
              onChange={(next) => {
                const parsed = next.trim() === '' ? 0 : Number(next)
                setValues((current) => ({
                  ...current,
                  toAmount: Number.isFinite(parsed) ? parsed : current.toAmount,
                }))
              }}
              disabled={submitting}
            />
          </label>

          <div className="finance-field finance-field-full finance-rate-preview">
            {values.fromCurrency && values.toCurrency && values.fromAmount > 0 && values.toAmount > 0 ? (
              <span>
                <strong>
                  {values.fromAmount} {values.fromCurrency}
                </strong>{' '}
                ={' '}
                <strong>
                  {values.toAmount} {values.toCurrency}
                </strong>
              </span>
            ) : (
              <span>Completa ambas monedas y los montos.</span>
            )}
          </div>
        </div>

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
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? 'Guardando...' : mode === 'create' ? 'Guardar tasa' : 'Actualizar tasa'}
          </button>
        </div>
    </ModalFrame>
  )
}
