import { useEffect, useMemo, useState, type FormEvent } from 'react'
import type { Product } from '../../types/product'
import {
  emptyPurchaseInvoiceLine,
  type CreatePurchaseInvoiceInput,
  type PurchaseInvoiceLineInput,
} from '../../types/purchaseInvoice'
import { formatBaseMoney } from '../../utils/formatMoney'
import { MoneyInput } from '../ui/MoneyInput'
import { ModalFrame } from '../ui/ModalFrame'

interface PurchaseInvoiceFormModalProps {
  open: boolean
  products: Product[]
  submitting: boolean
  onClose: () => void
  onSubmit: (values: CreatePurchaseInvoiceInput) => void
}

export function PurchaseInvoiceFormModal({
  open,
  products,
  submitting,
  onClose,
  onSubmit,
}: PurchaseInvoiceFormModalProps) {
  const [supplierName, setSupplierName] = useState('')
  const [notes, setNotes] = useState('')
  const [expectedDate, setExpectedDate] = useState('')
  const [amountPaid, setAmountPaid] = useState('0')
  const [lines, setLines] = useState<PurchaseInvoiceLineInput[]>([emptyPurchaseInvoiceLine()])

  useEffect(() => {
    if (open) {
      setSupplierName('')
      setNotes('')
      setExpectedDate('')
      setAmountPaid('0')
      setLines([emptyPurchaseInvoiceLine()])
    }
  }, [open])

  const totalAmount = useMemo(
    () => lines.reduce((sum, line) => sum + line.quantity * line.unitCost, 0),
    [lines],
  )

  if (!open) return null

  function updateLine(index: number, patch: Partial<PurchaseInvoiceLineInput>) {
    setLines((current) =>
      current.map((line, lineIndex) => {
        if (lineIndex !== index) return line

        const next = { ...line, ...patch }
        if (patch.productId) {
          const product = products.find((entry) => entry.id === patch.productId)
          if (product) {
            next.description = product.name
            next.unitLabel = product.unitLabel
            next.unitCost = product.costPrice
          }
        }
        return next
      }),
    )
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    onSubmit({
      supplierName,
      notes,
      expectedDate: expectedDate || undefined,
      amountPaid: Number(amountPaid) || 0,
      lines,
    })
  }

  return (
    <ModalFrame wide onClose={onClose}>
        <div className="finance-modal-header">
          <h2>Nueva factura de entrada</h2>
          <p>Registra mercancía que aún no ha ingresado al inventario.</p>
        </div>

        <form className="inventory-form" onSubmit={handleSubmit}>
          <div className="inventory-form-grid">
            <label className="inventory-field">
              <span>Proveedor</span>
              <input
                type="text"
                value={supplierName}
                onChange={(event) => setSupplierName(event.target.value)}
                placeholder="Ej. Distribuidora ABC"
                required
              />
            </label>

            <label className="inventory-field">
              <span>Fecha esperada</span>
              <input
                type="date"
                value={expectedDate}
                onChange={(event) => setExpectedDate(event.target.value)}
              />
            </label>

            <label className="inventory-field inventory-field-full">
              <span>Notas</span>
              <input
                type="text"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Referencia, guía, observaciones..."
              />
            </label>
          </div>

          <div className="inventory-form-section">
            <h3>Productos de la factura</h3>
            {lines.map((line, index) => (
              <div key={index} className="purchase-invoice-line">
                <label className="inventory-field">
                  <span>Producto</span>
                  <select
                    value={line.productId ?? ''}
                    onChange={(event) => updateLine(index, { productId: event.target.value })}
                  >
                    <option value="">Descripción manual</option>
                    {products.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="inventory-field">
                  <span>Descripción</span>
                  <input
                    type="text"
                    value={line.description}
                    onChange={(event) => updateLine(index, { description: event.target.value })}
                    required
                  />
                </label>

                <label className="inventory-field">
                  <span>Cantidad</span>
                  <input
                    type="number"
                    min="0.001"
                    step="0.001"
                    value={line.quantity}
                    onChange={(event) => updateLine(index, { quantity: Number(event.target.value) })}
                    required
                  />
                </label>

                <label className="inventory-field">
                  <span>Costo unit.</span>
                  <MoneyInput
                    showCurrencyPrefix
                    min="0"
                    value={line.unitCost}
                    onChange={(next) => {
                      const parsed = next.trim() === '' ? 0 : Number(next)
                      updateLine(index, {
                        unitCost: Number.isFinite(parsed) ? parsed : line.unitCost,
                      })
                    }}
                    required
                  />
                </label>

                {lines.length > 1 && (
                  <button
                    type="button"
                    className="inventory-link-btn"
                    onClick={() => setLines((current) => current.filter((_, i) => i !== index))}
                  >
                    Quitar
                  </button>
                )}
              </div>
            ))}

            <button
              type="button"
              className="inventory-btn inventory-btn-secondary"
              onClick={() => setLines((current) => [...current, emptyPurchaseInvoiceLine()])}
            >
              Agregar línea
            </button>
          </div>

          <div className="inventory-form-grid">
            <label className="inventory-field">
              <span>Anticipo pagado (pesos)</span>
              <MoneyInput
                showCurrencyPrefix
                min="0"
                value={amountPaid}
                onChange={setAmountPaid}
              />
            </label>

            <div className="inventory-field">
              <span>Total factura</span>
              <strong className="purchase-invoice-total">{formatBaseMoney(totalAmount)}</strong>
            </div>
          </div>

          <div className="finance-form-actions">
            <button type="button" className="finance-btn finance-btn-secondary" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="finance-btn finance-btn-primary" disabled={submitting}>
              {submitting ? 'Guardando...' : 'Registrar factura'}
            </button>
          </div>
        </form>
    </ModalFrame>
  )
}
