import type { MouseEvent, ReactNode } from 'react'
import { ModalBackdrop, ModalCard, ModalCardWide } from './motion'

interface ModalCloseButtonProps {
  onClick: () => void
  disabled?: boolean
  label?: string
}

export function ModalCloseButton({
  onClick,
  disabled = false,
  label = 'Cerrar',
}: ModalCloseButtonProps) {
  return (
    <button
      type="button"
      className="modal-close-btn"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
    >
      ×
    </button>
  )
}

export interface ModalFrameProps {
  open?: boolean
  onClose?: () => void
  closeDisabled?: boolean
  wide?: boolean
  className?: string
  children: ReactNode
}

export function ModalFrame({
  open = true,
  onClose,
  closeDisabled = false,
  wide = false,
  className,
  children,
}: ModalFrameProps) {
  if (!open) return null

  const Card = wide ? ModalCardWide : ModalCard
  const cardClassName = ['modal-has-close', className].filter(Boolean).join(' ')

  return (
    <ModalBackdrop onClick={closeDisabled || !onClose ? undefined : onClose}>
      <Card className={cardClassName} onClick={(event: MouseEvent) => event.stopPropagation()}>
        {onClose ? <ModalCloseButton onClick={onClose} disabled={closeDisabled} /> : null}
        {children}
      </Card>
    </ModalBackdrop>
  )
}
