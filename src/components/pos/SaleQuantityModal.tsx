import type { Product, SaleMode } from '../../types/product'
import { ModalCloseButton } from '../ui/ModalFrame'
import { MoneyText } from '../ui/MoneyText'
import {
  getDefaultQuantity,
  getQuantityStep,
  getUnitsPerBundle,
  productAllowsBundle,
} from '../../utils/productUnits'

interface SaleQuantityModalProps {
  product: Product
  open: boolean
  saleMode: SaleMode
  quantity: string
  error?: string
  onSaleModeChange: (mode: SaleMode) => void
  onQuantityChange: (value: string) => void
  onConfirm: () => void
  onClose: () => void
}

export function SaleQuantityModal({
  product,
  open,
  saleMode,
  quantity,
  error,
  onSaleModeChange,
  onQuantityChange,
  onConfirm,
  onClose,
}: SaleQuantityModalProps) {
  if (!open) return null

  const allowsBundle = productAllowsBundle(product)
  const isBundle = saleMode === 'bundle'
  const unitPrice = isBundle ? product.bundleSalePrice ?? 0 : product.salePrice
  const priceLabel = isBundle ? 'al mayor' : product.unitLabel
  const quantityLabel = isBundle ? 'al mayor' : product.unitLabel
  const step = getQuantityStep(product.soldBy, saleMode)
  const min = isBundle ? 1 : product.soldBy === 'weight' ? 0.001 : 1

  function handleModeChange(mode: SaleMode) {
    onSaleModeChange(mode)
    onQuantityChange(getDefaultQuantity(product, mode))
  }

  return (
    <div className="pos-modal-backdrop" onClick={onClose}>
      <div className="pos-modal" onClick={(event) => event.stopPropagation()}>
        <ModalCloseButton onClick={onClose} />
        <h3>{product.name}</h3>
        <p>Indica cómo se vende y la cantidad.</p>

        {allowsBundle && (
          <div className="pos-sale-mode-toggle">
            <button
              type="button"
              className={saleMode === 'retail' ? 'active' : undefined}
              onClick={() => handleModeChange('retail')}
            >
              Detal
            </button>
            <button
              type="button"
              className={saleMode === 'bundle' ? 'active' : undefined}
              onClick={() => handleModeChange('bundle')}
            >
              Al mayor
            </button>
          </div>
        )}

        <p className="pos-modal-price">
          Precio: <MoneyText amount={unitPrice} /> / {priceLabel}
        </p>

        {isBundle && (
          <p className="pos-modal-hint">
            1 al mayor = {getUnitsPerBundle(product)} {product.unitLabel}
          </p>
        )}

        <label className="pos-field">
          <span>Cantidad ({quantityLabel})</span>
          <input
            type="number"
            min={min}
            step={step}
            value={quantity}
            autoFocus
            onChange={(event) => onQuantityChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                onConfirm()
              }
            }}
          />
        </label>

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
