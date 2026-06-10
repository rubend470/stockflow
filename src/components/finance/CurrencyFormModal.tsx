import { useEffect, useState, type FormEvent } from 'react'
import type { CurrencyFormInput } from '../../types/finance'
import { ModalFrame } from '../ui/ModalFrame'

interface CurrencyFormModalProps {
  open: boolean
  mode: 'create' | 'edit'
  initialValues: CurrencyFormInput
  submitting: boolean
  onClose: () => void
  onSubmit: (values: CurrencyFormInput) => void
}

export function CurrencyFormModal({
  open,
  mode,
  initialValues,
  submitting,
  onClose,
  onSubmit,
}: CurrencyFormModalProps) {
  const [values, setValues] = useState(initialValues)
  const [formKey, setFormKey] = useState(0)

  useEffect(() => {
    if (open) {
      setValues(initialValues)
      setFormKey((current) => current + 1)
    }
  }, [open, initialValues])

  if (!open) return null

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    onSubmit(values)
  }

  return (
    <ModalFrame onClose={onClose}>
        <div className="finance-modal-header">
          <h2>{mode === 'create' ? 'Nueva moneda' : 'Editar moneda'}</h2>
          <p>Define el código, símbolo y si será la moneda principal del sistema.</p>
        </div>

        <form key={formKey} className="finance-form" onSubmit={handleSubmit}>
          <div className="finance-form-grid">
            <label className="finance-field">
              <span>Código</span>
              <input
                type="text"
                value={values.code}
                onChange={(event) =>
                  setValues((current) => ({ ...current, code: event.target.value.toUpperCase() }))
                }
                placeholder="COP"
                maxLength={6}
                required
              />
            </label>

            <label className="finance-field">
              <span>Símbolo</span>
              <input
                type="text"
                value={values.symbol}
                onChange={(event) => setValues((current) => ({ ...current, symbol: event.target.value }))}
                placeholder="$"
                required
              />
            </label>

            <label className="finance-field finance-field-full">
              <span>Nombre</span>
              <input
                type="text"
                value={values.name}
                onChange={(event) => setValues((current) => ({ ...current, name: event.target.value }))}
                placeholder="Dólar estadounidense"
                required
              />
            </label>

            <label className="finance-field finance-field-full">
              <span className="finance-checkbox-label">
                <input
                  type="checkbox"
                  checked={values.isBase}
                  onChange={(event) =>
                    setValues((current) => ({ ...current, isBase: event.target.checked }))
                  }
                />
                Moneda principal (base para conversiones)
              </span>
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
                Activa en el sistema
              </span>
            </label>
          </div>

          <div className="finance-form-actions">
            <button type="button" className="finance-btn finance-btn-secondary" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="finance-btn finance-btn-primary" disabled={submitting}>
              {submitting ? 'Guardando...' : mode === 'create' ? 'Crear moneda' : 'Guardar cambios'}
            </button>
          </div>
        </form>
    </ModalFrame>
  )
}
