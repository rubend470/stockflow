import { ModalBackdrop, ModalCard } from '../ui/motion'
import { ModalCloseButton } from '../ui/ModalFrame'

export type PostSaleHardwareAction = 'print-ticket' | 'open-drawer' | 'skip'

interface PostSaleHardwareDialogProps {
  open: boolean
  saleNumber?: string
  totalLabel?: string
  busy?: boolean
  error?: string
  onSelect: (action: PostSaleHardwareAction) => void
}

export function PostSaleHardwareDialog({
  open,
  saleNumber,
  totalLabel,
  busy = false,
  error,
  onSelect,
}: PostSaleHardwareDialogProps) {
  if (!open) return null

  return (
    <ModalBackdrop onClick={() => !busy && onSelect('skip')}>
      <ModalCard
        className="post-sale-dialog modal-has-close"
        onClick={(event) => event.stopPropagation()}
      >
        <ModalCloseButton onClick={() => !busy && onSelect('skip')} />
        <div className="post-sale-dialog-icon" aria-hidden>
          ✓
        </div>
        <h2>Venta registrada</h2>
        <p>
          {saleNumber ? `Venta ${saleNumber}` : 'Venta lista'}
          {totalLabel ? ` por ${totalLabel}` : ''}. La gaveta se abre automáticamente; el ticket es opcional.
        </p>

        {error && <div className="alert alert-error post-sale-error">{error}</div>}

        <div className="post-sale-actions">
          <button
            type="button"
            className="pos-btn pos-btn-success post-sale-action-primary"
            onClick={() => onSelect('print-ticket')}
            disabled={busy}
          >
            {busy ? 'Procesando...' : 'Imprimir ticket'}
          </button>
          <button
            type="button"
            className="pos-link-btn post-sale-skip"
            onClick={() => onSelect('skip')}
            disabled={busy}
          >
            Omitir
          </button>
        </div>
      </ModalCard>
    </ModalBackdrop>
  )
}
