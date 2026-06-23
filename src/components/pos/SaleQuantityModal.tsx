import type { Product, SaleMode } from '../../types/product'
import { ModalCloseButton } from '../ui/ModalFrame'
import { MoneyText } from '../ui/MoneyText'
import { formatBaseMoney, formatQuantity, parseMoneyInput } from '../../utils/formatMoney'
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
  entryMode: 'quantity' | 'amount'
  quantity: string
  amount: string
  error?: string
  onSaleModeChange: (mode: SaleMode) => void
  onEntryModeChange: (mode: 'quantity' | 'amount') => void
  onQuantityChange: (value: string) => void
  onAmountChange: (value: string) => void
  onConfirm: () => void
  onClose: () => void
}

export function SaleQuantityModal({
  product,
  open,
  saleMode,
  entryMode,
  quantity,
  amount,
  error,
  onSaleModeChange,
  onEntryModeChange,
  onQuantityChange,
  onAmountChange,
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
  const allowsAmountEntry = !isBundle && (product.soldBy === 'weight' || product.type === 'charcuteria')
  const enteredAmount = parseMoneyInput(amount)
  const calculatedQuantity =
    enteredAmount > 0 && unitPrice > 0 ? Number((enteredAmount / unitPrice).toFixed(3)) : 0

  function handleModeChange(mode: SaleMode) {
    onSaleModeChange(mode)
    if (mode === 'bundle') onEntryModeChange('quantity')
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

        {allowsAmountEntry && (
          <div className="pos-sale-mode-toggle pos-weight-entry-toggle">
            <button
              type="button"
              className={entryMode === 'quantity' ? 'active' : undefined}
              onClick={() => onEntryModeChange('quantity')}
            >
              Por peso
            </button>
            <button
              type="button"
              className={entryMode === 'amount' ? 'active' : undefined}
              onClick={() => onEntryModeChange('amount')}
            >
              Por importe
            </button>
          </div>
        )}

        {isBundle && (
          <p className="pos-modal-hint">
            1 al mayor = {getUnitsPerBundle(product)} {product.unitLabel}
          </p>
        )}

        {allowsAmountEntry && entryMode === 'amount' ? (
          <>
            <label className="pos-field">
              <span>Importe a cobrar</span>
              <input
                type="text"
                inputMode="decimal"
                value={amount}
                autoFocus
                placeholder="Ej. 10.000,00"
                onChange={(event) => onAmountChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    onConfirm()
                  }
                }}
              />
            </label>
            <p className="pos-modal-hint pos-weight-equivalence">
              {enteredAmount > 0
                ? `${formatBaseMoney(enteredAmount)} equivale a ${formatQuantity(calculatedQuantity, product.unitLabel)}.`
                : `Ingresa el importe para calcular los ${product.unitLabel}.`}
            </p>
          </>
        ) : (
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
        )}

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
