import type { CartItem } from '../../types/sale'
import { formatCartQuantity } from '../../utils/cart'
import { MoneyText } from '../ui/MoneyText'

interface CartPanelProps {
  items: CartItem[]
  onIncrease: (key: string) => void
  onDecrease: (key: string) => void
  onRemove: (key: string) => void
  subtotal: number
}

export function CartPanel({
  items,
  onIncrease,
  onDecrease,
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
              <div className="pos-cart-item-top">
                <strong>{item.productName}</strong>
                <button type="button" className="pos-link-btn" onClick={() => onRemove(item.key)}>
                  Quitar
                </button>
              </div>
              <div className="pos-cart-item-meta">
                <span>{formatCartQuantity(item)}</span>
                <div className="pos-cart-item-price">
                  <MoneyText amount={item.lineRevenue} />
                  <span className="pos-cart-item-unit">
                    <MoneyText amount={item.unitPrice} /> c/u
                  </span>
                </div>
              </div>
              <div className="pos-qty-controls">
                <button type="button" onClick={() => onDecrease(item.key)} aria-label="Disminuir">
                  −
                </button>
                <span>{item.quantity}</span>
                <button type="button" onClick={() => onIncrease(item.key)} aria-label="Aumentar">
                  +
                </button>
              </div>
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
