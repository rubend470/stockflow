import { useEffect, useState, type FormEvent } from 'react'
import type { Currency, PaymentMethodFormInput } from '../../types/finance'
import { ModalFrame } from '../ui/ModalFrame'

interface PaymentMethodFormModalProps {
  open: boolean
  mode: 'create' | 'edit'
  initialValues: PaymentMethodFormInput
  currencies: Currency[]
  submitting: boolean
  onClose: () => void
  onSubmit: (values: PaymentMethodFormInput) => void
}

export function PaymentMethodFormModal({
  open,
  mode,
  initialValues,
  currencies,
  submitting,
  onClose,
  onSubmit,
}: PaymentMethodFormModalProps) {
  const [values, setValues] = useState(initialValues)
  const [formKey, setFormKey] = useState(0)

  useEffect(() => {
    if (open) {
      setValues(initialValues)
      setFormKey((current) => current + 1)
    }
  }, [open, initialValues])

  if (!open) return null

  function toggleCurrency(code: string) {
    setValues((current) => {
      const exists = current.allowedCurrencies.includes(code)
      return {
        ...current,
        allowedCurrencies: exists
          ? current.allowedCurrencies.filter((item) => item !== code)
          : [...current.allowedCurrencies, code],
      }
    })
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    onSubmit(values)
  }

  const activeCurrencies = currencies.filter((currency) => currency.active)

  return (
    <ModalFrame onClose={onClose}>
        <div className="finance-modal-header">
          <h2>{mode === 'create' ? 'Nueva forma de pago' : 'Editar forma de pago'}</h2>
          <p>Configura el método, monedas aceptadas y si requiere referencia.</p>
        </div>

        <form key={formKey} className="finance-form" onSubmit={handleSubmit}>
          <div className="finance-form-grid">
            <label className="finance-field finance-field-full">
              <span>Nombre</span>
              <input
                type="text"
                value={values.name}
                onChange={(event) => setValues((current) => ({ ...current, name: event.target.value }))}
                placeholder="Efectivo"
                required
              />
            </label>

            <div className="finance-field finance-field-full">
              <span>Monedas permitidas</span>
              <div className="finance-chip-group">
                {activeCurrencies.map((currency) => {
                  const selected = values.allowedCurrencies.includes(currency.code)
                  return (
                    <button
                      key={currency.id}
                      type="button"
                      className={`finance-chip ${selected ? 'selected' : ''}`}
                      onClick={() => toggleCurrency(currency.code)}
                    >
                      {currency.code} · {currency.symbol}
                    </button>
                  )
                })}
              </div>
            </div>

            <label className="finance-field finance-field-full">
              <span className="finance-checkbox-label">
                <input
                  type="checkbox"
                  checked={values.requiresReference}
                  onChange={(event) =>
                    setValues((current) => ({ ...current, requiresReference: event.target.checked }))
                  }
                />
                Requiere referencia (pago móvil, transferencia, etc.)
              </span>
            </label>

            <label className="finance-field finance-field-full">
              <span className="finance-checkbox-label">
                <input
                  type="checkbox"
                  checked={values.isDefaultForSales}
                  onChange={(event) =>
                    setValues((current) => ({
                      ...current,
                      isDefaultForSales: event.target.checked,
                    }))
                  }
                />
                Por defecto en ventas
              </span>
              <small className="finance-detail-hint">
                Se preselecciona al abrir la venta. Solo puede haber una forma de pago por defecto.
              </small>
            </label>

            <label className="finance-field finance-field-full">
              <span className="finance-checkbox-label">
                <input
                  type="checkbox"
                  checked={values.active}
                  onChange={(event) =>
                    setValues((current) => ({ ...current, active: event.target.checked }))
                  }
                />
                Activa en caja
              </span>
            </label>
          </div>

          <div className="finance-form-actions">
            <button type="button" className="finance-btn finance-btn-secondary" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="finance-btn finance-btn-primary" disabled={submitting}>
              {submitting ? 'Guardando...' : mode === 'create' ? 'Crear método' : 'Guardar cambios'}
            </button>
          </div>
        </form>
    </ModalFrame>
  )
}
