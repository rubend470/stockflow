import { useEffect, useState, type FormEvent } from 'react'
import type { SupplierFormInput } from '../../types/supplier'
import { ModalFrame } from '../ui/ModalFrame'

interface SupplierFormModalProps {
  open: boolean
  mode: 'create' | 'edit'
  initialValues: SupplierFormInput
  submitting: boolean
  onClose: () => void
  onSubmit: (values: SupplierFormInput) => void
}

export function SupplierFormModal({
  open,
  mode,
  initialValues,
  submitting,
  onClose,
  onSubmit,
}: SupplierFormModalProps) {
  const [values, setValues] = useState<SupplierFormInput>(initialValues)
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
    <ModalFrame onClose={onClose} closeDisabled={submitting}>
      <div className="finance-modal-header">
        <h2>{mode === 'create' ? 'Nuevo proveedor' : 'Editar proveedor'}</h2>
        <p>Solo el nombre es obligatorio. El resto es opcional.</p>
      </div>

      <form key={formKey} className="finance-form" onSubmit={handleSubmit}>
        <label className="finance-field finance-field-full">
          <span>Nombre</span>
          <input
            type="text"
            value={values.name}
            onChange={(event) => setValues((current) => ({ ...current, name: event.target.value }))}
            placeholder="Ej. Distribuidora ABC"
            required
          />
        </label>

        <label className="finance-field">
          <span>Teléfono</span>
          <input
            type="text"
            value={values.phone}
            onChange={(event) => setValues((current) => ({ ...current, phone: event.target.value }))}
            placeholder="Opcional"
          />
        </label>

        <label className="finance-field">
          <span>Correo</span>
          <input
            type="email"
            value={values.email}
            onChange={(event) => setValues((current) => ({ ...current, email: event.target.value }))}
            placeholder="Opcional"
          />
        </label>

        <label className="finance-field">
          <span>NIT / RIF</span>
          <input
            type="text"
            value={values.taxId}
            onChange={(event) => setValues((current) => ({ ...current, taxId: event.target.value }))}
            placeholder="Opcional"
          />
        </label>

        <label className="finance-field finance-field-full">
          <span>Notas</span>
          <input
            type="text"
            value={values.notes}
            onChange={(event) => setValues((current) => ({ ...current, notes: event.target.value }))}
            placeholder="Opcional"
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
            Proveedor activo
          </span>
        </label>

        <div className="finance-form-actions">
          <button
            type="button"
            className="finance-btn finance-btn-secondary"
            onClick={onClose}
            disabled={submitting}
          >
            Cancelar
          </button>
          <button type="submit" className="finance-btn finance-btn-primary" disabled={submitting}>
            {submitting ? 'Guardando...' : mode === 'create' ? 'Crear proveedor' : 'Guardar cambios'}
          </button>
        </div>
      </form>
    </ModalFrame>
  )
}
