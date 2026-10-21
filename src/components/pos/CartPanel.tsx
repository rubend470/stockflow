import type { CartItem } from '../../types/sale'
import { formatCartQuantity } from '../../utils/cart'
import { MoneyText } from '../ui/MoneyText'

interface CartPanelProps {
  items: CartItem[]
  onIncrease: (key: string) => void
  onDecrease: (key: string) => void
  onToggleBundle: (key: string, enabled: boolean) => void
  onEdit: (key: string) => void
  onRemove: (key: string) => void
  subtotal: number
}

export function CartPanel({
  items,
  onIncrease,
  onDecrease,
  onToggleBundle,
  onEdit,
  onRemove,
  subtotal,
}: CartPanelProps) {
  return (
    <div className="pos-cart">
      {items.length === 0 ? (
        <div className="pos-cart-empty">
          <strong>Carrito listo</strong>
          <p>Agrega productos escaneando o buscando por nombre o código.</p>
        </div>
      ) : (
        <ul className="pos-cart-list">
          {items.map((item) => (
            <li key={item.key} className="pos-cart-item">
              {(() => {
                const canSellBundle = !item.isQuickItem && item.offerType !== 'combo' && Boolean(item.unitsPerBundle)

                return canSellBundle ? (
                  <label className="pos-cart-bundle-toggle">
                    <input
                      type="checkbox"
                      checked={item.saleMode === 'bundle'}
                      onChange={(event) => onToggleBundle(item.key, event.target.checked)}
                    />
                    <span>Al mayor</span>
                  </label>
                ) : null
              })()}
              <div className="pos-cart-item-top">
                <strong>{item.productName}</strong>
                <div className="pos-cart-item-actions">
                  {!item.isQuickItem && item.offerType !== 'combo' && (
                    <button type="button" className="pos-link-btn" onClick={() => onEdit(item.key)}>
                      Editar
                    </button>
                  )}
                  <button type="button" className="pos-link-btn" onClick={() => onRemove(item.key)}>
                    Quitar
                  </button>
                </div>
              </div>
              <div className="pos-cart-item-meta">
                <span>{formatCartQuantity(item)}</span>
                <div className="pos-cart-item-price">
                  <MoneyText amount={item.lineRevenue} />
                  <span className="pos-cart-item-unit">
                    <MoneyText amount={item.unitPrice} />{' '}
                    {item.saleMode === 'bundle'
                      ? `x ${item.unitLabel} · ${item.unitsPerBundle ?? 1} ${item.unitLabel}/mayor`
                      : 'c/u'}
                  </span>
                </div>
              </div>
              {item.isQuickItem ? (
                <span className="pos-quick-item-badge">Sin inventario</span>
              ) : item.offerType === 'combo' ? (
                <span className="pos-quick-item-badge">Combo</span>
              ) : (
                <div className="pos-qty-controls">
                  <button type="button" onClick={() => onDecrease(item.key)} aria-label="Disminuir">
                    −
                  </button>
                  <span>{item.quantity}</span>
                  <button type="button" onClick={() => onIncrease(item.key)} aria-label="Aumentar">
                    +
                  </button>
                </div>
              )}
              {item.offerType === 'promotion' && (
                <span className="pos-quick-item-badge">Promoción aplicada</span>
              )}
              {item.manualUnitPrice && (
                <span className="pos-quick-item-badge">Precio manual</span>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="pos-cart-summary">
        <div>
          <span>Subtotal</span>
          <strong>
            <MoneyText amount={subtotal} />
          </strong>
        </div>
      </div>
    </div>
  )
}
