import { useEffect, useState, type FormEvent } from 'react'
import { MoneyInput } from '../ui/MoneyInput'
import type { ClientFormInput } from '../../types/client'
import { ModalFrame } from '../ui/ModalFrame'

interface ClientFormModalProps {
  open: boolean
  mode: 'create' | 'edit'
  initialValues: ClientFormInput
  submitting: boolean
  onClose: () => void
  onSubmit: (values: ClientFormInput) => void
}

export function ClientFormModal({
  open,
  mode,
  initialValues,
  submitting,
  onClose,
  onSubmit,
}: ClientFormModalProps) {
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
          <h2>{mode === 'create' ? 'Nuevo cliente' : 'Editar cliente'}</h2>
          <p>Datos de contacto y límite de crédito.</p>
        </div>

        <form key={formKey} className="finance-form" onSubmit={handleSubmit}>
          <div className="finance-form-grid">
            <label className="finance-field finance-field-full">
              <span>Nombre</span>
              <input
                type="text"
                value={values.name}
                onChange={(event) => setValues((current) => ({ ...current, name: event.target.value }))}
                required
              />
            </label>

            <label className="finance-field">
              <span>Teléfono</span>
              <input
                type="text"
                value={values.phone}
                onChange={(event) => setValues((current) => ({ ...current, phone: event.target.value }))}
              />
            </label>

            <label className="finance-field">
              <span>Documento</span>
              <input
                type="text"
                value={values.documentId}
                onChange={(event) =>
                  setValues((current) => ({ ...current, documentId: event.target.value }))
                }
              />
            </label>

            <label className="finance-field finance-field-full">
              <span>Correo</span>
              <input
                type="email"
                value={values.email}
                onChange={(event) => setValues((current) => ({ ...current, email: event.target.value }))}
              />
            </label>

            <label className="finance-field">
              <span>Límite de crédito (COP)</span>
              <MoneyInput
                showCurrencyPrefix
                min="0"
                value={values.creditLimit}
                onChange={(next) => {
                  const parsed = next.trim() === '' ? 0 : Number(next)
                  setValues((current) => ({
                    ...current,
                    creditLimit: Number.isFinite(parsed) ? parsed : current.creditLimit,
                  }))
                }}
              />
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
                Cliente activo
              </span>
            </label>
          </div>

          <div className="finance-form-actions">
            <button type="button" className="finance-btn finance-btn-secondary" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="finance-btn finance-btn-primary" disabled={submitting}>
              {submitting ? 'Guardando...' : mode === 'create' ? 'Crear cliente' : 'Guardar cambios'}
            </button>
          </div>
        </form>
    </ModalFrame>
  )
}
