import { useEffect, useState, type FormEvent } from 'react'
import type { Product } from '../../types/product'
import type { CreateMovementInput, ManualMovementType } from '../../types/inventory'
import { movementTypeLabels } from '../../types/inventory'
import { MoneyInput } from '../ui/MoneyInput'
import { ModalFrame } from '../ui/ModalFrame'

interface MovementFormModalProps {
  open: boolean
  products: Product[]
  submitting: boolean
  onClose: () => void
  onSubmit: (values: CreateMovementInput) => void
}

const manualTypes: ManualMovementType[] = ['purchase', 'adjustment', 'waste', 'return']

export function MovementFormModal({
  open,
  products,
  submitting,
  onClose,
  onSubmit,
}: MovementFormModalProps) {
  const [productId, setProductId] = useState('')
  const [type, setType] = useState<ManualMovementType>('purchase')
  const [quantity, setQuantity] = useState('1')
  const [unitCost, setUnitCost] = useState('')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    if (open) {
      const first = products[0]
      setProductId(first?.id ?? '')
      setType('purchase')
      setQuantity('1')
      setUnitCost(first ? String(first.costPrice) : '')
      setNotes('')
    }
  }, [open, products])

  const selectedProduct = products.find((product) => product.id === productId)

  useEffect(() => {
    if (selectedProduct && type === 'purchase') {
      setUnitCost(String(selectedProduct.costPrice))
    }
  }, [selectedProduct, type])

  if (!open) return null

  function handleSubmit(event: FormEvent) {
    event.preventDefault()

    onSubmit({
      productId,
      type,
      quantity: Number(quantity),
      unitCost: unitCost ? Number(unitCost) : undefined,
      notes: notes.trim() || undefined,
    })
  }

  return (
    <ModalFrame onClose={onClose}>
        <div className="finance-modal-header">
          <h2>Registrar movimiento</h2>
          <p>Entradas, ajustes, mermas o devoluciones con trazabilidad.</p>
        </div>

        <form className="finance-form" onSubmit={handleSubmit}>
          <div className="finance-form-grid">
            <label className="finance-field finance-field-full">
              <span>Producto</span>
              <select value={productId} onChange={(event) => setProductId(event.target.value)} required>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name} · {product.stock} {product.unitLabel}
                  </option>
                ))}
              </select>
            </label>

            <label className="finance-field">
              <span>Tipo</span>
              <select
                value={type}
                onChange={(event) => setType(event.target.value as ManualMovementType)}
              >
                {manualTypes.map((movementType) => (
                  <option key={movementType} value={movementType}>
                    {movementTypeLabels[movementType]}
                  </option>
                ))}
              </select>
            </label>

            <label className="finance-field">
              <span>
                Cantidad {selectedProduct ? `(${selectedProduct.unitLabel})` : ''}
                {type === 'adjustment' ? ' (+/-)' : ''}
              </span>
              <input
                type="number"
                step="0.001"
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
                required
              />
            </label>

            {(type === 'purchase' || type === 'return') && (
              <label className="finance-field">
                <span>Costo unitario (COP)</span>
                <MoneyInput
                  showCurrencyPrefix
                  min="0"
                  value={unitCost}
                  onChange={setUnitCost}
                />
              </label>
            )}

            <label className="finance-field finance-field-full">
              <span>Notas</span>
              <input
                type="text"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Motivo o referencia"
              />
            </label>
          </div>

          <div className="finance-form-actions">
            <button type="button" className="finance-btn finance-btn-secondary" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="finance-btn finance-btn-primary" disabled={submitting}>
              {submitting ? 'Guardando...' : 'Registrar movimiento'}
            </button>
          </div>
        </form>
    </ModalFrame>
  )
}
