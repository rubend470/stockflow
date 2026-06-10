import { useEffect, useState, type FormEvent } from 'react'
import { todayDateInputValue } from '../../utils/dates'
import { ModalFrame } from '../ui/ModalFrame'

interface CashClosureModalProps {
  open: boolean
  submitting?: boolean
  onClose: () => void
  onConfirm: (closureDate: string) => void
}

export function CashClosureModal({
  open,
  submitting = false,
  onClose,
  onConfirm,
}: CashClosureModalProps) {
  const [closureDate, setClosureDate] = useState(todayDateInputValue())

  useEffect(() => {
    if (open) {
      setClosureDate(todayDateInputValue())
    }
  }, [open])

  if (!open) return null

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!closureDate) return
    onConfirm(closureDate)
  }

  return (
    <ModalFrame onClose={onClose} closeDisabled={submitting}>
        <div className="finance-modal-header">
          <h2>Hacer cierre de caja</h2>
          <p>Selecciona el día a cerrar. Por defecto se usa la fecha de hoy.</p>
        </div>

        <form className="finance-form" onSubmit={handleSubmit}>
          <label className="finance-field finance-field-full">
            <span>Fecha del cierre</span>
            <input
              type="date"
              value={closureDate}
              onChange={(event) => setClosureDate(event.target.value)}
              required
            />
          </label>

          <div className="finance-form-actions">
            <button type="button" className="finance-btn finance-btn-secondary" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="finance-btn finance-btn-primary" disabled={submitting}>
              {submitting ? 'Generando cierre...' : 'Generar cierre'}
            </button>
          </div>
        </form>
    </ModalFrame>
  )
}
