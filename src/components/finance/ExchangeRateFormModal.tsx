import { useEffect, useState } from 'react'
import { MoneyInput } from '../ui/MoneyInput'
import type { Currency, ExchangeRateFormInput } from '../../types/finance'
import { ModalFrame } from '../ui/ModalFrame'
import { formatDecimalColombian, parseMoneyInput } from '../../utils/formatMoney'

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
    onSubmit({ ...values, fromAmount: 1 })
  }

  const rateValue = values.toAmount > 0 ? values.toAmount : 0
  const operationLabel = values.operation === 'divide' ? 'divide entre' : 'multiplica por'
  const operationSymbol = values.operation === 'divide' ? '÷' : '×'

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
            <span>Tipo de cálculo</span>
            <select
              value={values.operation}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  operation: event.target.value === 'divide' ? 'divide' : 'multiply',
                }))
              }
              disabled={submitting}
            >
              <option value="multiply">Multiplicar por la tasa</option>
              <option value="divide">Dividir entre la tasa</option>
            </select>
          </label>

          <label className="finance-field">
            <span>Tasa</span>
            <MoneyInput
              min="0.01"
              value={values.toAmount}
              onChange={(next) => {
                const parsed = parseMoneyInput(next)
                setValues((current) => ({
                  ...current,
                  toAmount: Number.isFinite(parsed) ? parsed : current.toAmount,
                }))
              }}
              disabled={submitting}
            />
          </label>

          <div className="finance-field finance-field-full finance-rate-preview">
            {values.fromCurrency && values.toCurrency && values.toAmount > 0 ? (
              <span>
                Monto en <strong>{values.fromCurrency}</strong> se {operationLabel}{' '}
                <strong>{formatDecimalColombian(rateValue)}</strong> para obtener{' '}
                <strong>{values.toCurrency}</strong>. Formula: monto {operationSymbol}{' '}
                {formatDecimalColombian(rateValue)}.
              </span>
            ) : (
              <span>Completa ambas monedas y la tasa.</span>
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
