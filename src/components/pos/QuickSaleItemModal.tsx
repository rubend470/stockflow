import { MoneyInput } from '../ui/MoneyInput'
import { ModalCloseButton } from '../ui/ModalFrame'

interface QuickSaleItemModalProps {
  open: boolean
  name: string
  price: string
  error?: string
  onNameChange: (value: string) => void
  onPriceChange: (value: string) => void
  onConfirm: () => void
  onClose: () => void
}

export function QuickSaleItemModal({
  open,
  name,
  price,
  error,
  onNameChange,
  onPriceChange,
  onConfirm,
  onClose,
}: QuickSaleItemModalProps) {
  if (!open) return null

  return (
    <div className="pos-modal-backdrop" onClick={onClose}>
      <div className="pos-modal" onClick={(event) => event.stopPropagation()}>
        <ModalCloseButton onClick={onClose} />
        <h3>Producto rápido</h3>
        <p>Agrega una venta manual sin descontar inventario.</p>

        <label className="pos-field">
          <span>Nombre del producto</span>
          <input
            type="text"
            value={name}
            autoFocus
            placeholder="Ej. Pan campesino"
            onChange={(event) => onNameChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                onConfirm()
              }
            }}
          />
        </label>

        <label className="pos-field">
          <span>Precio final</span>
          <MoneyInput
            min="0"
            value={price}
            onChange={onPriceChange}
            showCurrencyPrefix
            currencyCode="COP"
            blankWhenZero
          />
        </label>

        <p className="pos-modal-hint">Esta línea queda marcada como producto rápido y no mueve stock.</p>

        {error && <div className="alert alert-error">{error}</div>}

        <div className="pos-modal-actions">
          <button type="button" className="pos-btn pos-btn-secondary" onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className="pos-btn pos-btn-primary" onClick={onConfirm}>
            Agregar al carrito
          </button>
        </div>
      </div>
    </div>
  )
}
