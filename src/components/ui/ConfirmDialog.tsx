import { ModalBackdrop, ModalCard } from './motion'
import { ModalCloseButton } from './ModalFrame'

export type ConfirmTone = 'default' | 'danger' | 'success'

export interface ConfirmDialogProps {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  tone?: ConfirmTone
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  tone = 'default',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null

  return (
    <ModalBackdrop onClick={onCancel}>
      <ModalCard
        className={`confirm-dialog confirm-dialog-${tone} modal-has-close`}
        onClick={(event) => event.stopPropagation()}
      >
        <ModalCloseButton onClick={onCancel} />
        <div className="confirm-dialog-icon" aria-hidden>
          {tone === 'danger' ? '!' : tone === 'success' ? '✓' : '?'}
        </div>
        <h2 className="confirm-dialog-title">{title}</h2>
        <p className="confirm-dialog-message">{message}</p>
        <div className="confirm-dialog-actions">
          <button type="button" className="finance-btn finance-btn-secondary" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`finance-btn confirm-dialog-btn-${tone}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </ModalCard>
    </ModalBackdrop>
  )
}
