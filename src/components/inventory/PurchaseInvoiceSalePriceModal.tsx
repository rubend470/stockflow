import { useEffect, useMemo, useState, type FormEvent } from 'react'
import type { ReceivedProductLine } from '../../types/purchaseInvoice'
import { formatMoney, roundMoney } from '../../utils/formatMoney'
import { MoneyInput } from '../ui/MoneyInput'
import { ModalFrame } from '../ui/ModalFrame'

interface PurchaseInvoiceSalePriceModalProps {
  open: boolean
  invoiceNumber: string
  lines: ReceivedProductLine[]
  submitting?: boolean
  onClose: () => void
  onApply: (updates: Array<{ productId: string; salePrice: number }>) => void
  onSkip: () => void
}

export function PurchaseInvoiceSalePriceModal({
  open,
  invoiceNumber,
  lines,
  submitting = false,
  onClose,
  onApply,
  onSkip,
}: PurchaseInvoiceSalePriceModalProps) {
  const [marginPercent, setMarginPercent] = useState('30')
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const [salePrices, setSalePrices] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!open) return

    const nextSelected: Record<string, boolean> = {}
    const nextPrices: Record<string, string> = {}

    lines.forEach((line) => {
      nextSelected[line.productId] = false
      nextPrices[line.productId] = String(line.previousSalePrice)
    })

    setSelected(nextSelected)
    setSalePrices(nextPrices)
    setMarginPercent('30')
  }, [open, lines])

  const margin = Number(marginPercent) || 0

  function suggestWithMargin() {
    setSalePrices((current) => {
      const next = { ...current }
      lines.forEach((line) => {
        if (!selected[line.productId]) return
        const suggested = roundMoney(line.newCostPrice * (1 + margin / 100))
        next[line.productId] = String(suggested)
      })
      return next
    })
  }

  const selectedCount = useMemo(
    () => lines.filter((line) => selected[line.productId]).length,
    [lines, selected],
  )

  if (!open) return null

  function handleSubmit(event: FormEvent) {
    event.preventDefault()

    const updates = lines
      .filter((line) => selected[line.productId])
      .map((line) => ({
        productId: line.productId,
        salePrice: Number(salePrices[line.productId] ?? line.previousSalePrice),
      }))
      .filter((item) => item.salePrice >= 0)

    onApply(updates)
  }

  return (
    <ModalFrame wide onClose={onClose} closeDisabled={submitting}>
      <div className="finance-modal-header">
        <h2>Actualizar precios de venta</h2>
        <p>
          Factura {invoiceNumber} registrada e inventario actualizado. ¿Quieres ajustar precios de
          venta de los productos recibidos?
        </p>
      </div>

      <form className="finance-form" onSubmit={handleSubmit}>
        <div className="purchase-sale-price-toolbar">
          <label className="finance-field">
            <span>Margen sugerido (%)</span>
            <input
              type="number"
              min="0"
              step="1"
              value={marginPercent}
              onChange={(event) => setMarginPercent(event.target.value)}
              disabled={submitting}
            />
          </label>
          <button
            type="button"
            className="finance-btn finance-btn-secondary"
            onClick={suggestWithMargin}
            disabled={submitting || selectedCount === 0}
          >
            Sugerir con margen
          </button>
        </div>

        <div className="finance-table-wrap">
          <table className="finance-table">
            <thead>
              <tr>
                <th>Actualizar</th>
                <th>Producto</th>
                <th>Costo nuevo</th>
                <th>Venta actual</th>
                <th>Venta nueva</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => (
                <tr key={line.productId}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selected[line.productId] ?? false}
                      onChange={(event) =>
                        setSelected((current) => ({
                          ...current,
                          [line.productId]: event.target.checked,
                        }))
                      }
                      disabled={submitting}
                    />
                  </td>
                  <td>
                    <strong>{line.productName}</strong>
                    <small className="exchange-method-hint">{line.unitLabel}</small>
                  </td>
                  <td>
                    {formatMoney(line.newCostPrice, line.currencyCode)}
                  </td>
                  <td>
                    {formatMoney(line.previousSalePrice, line.currencyCode)}
                  </td>
                  <td>
                    <MoneyInput
                      value={salePrices[line.productId] ?? ''}
                      onChange={(next) =>
                        setSalePrices((current) => ({
                          ...current,
                          [line.productId]: next,
                        }))
                      }
                      disabled={submitting || !selected[line.productId]}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="finance-form-actions">
          <button
            type="button"
            className="finance-btn finance-btn-secondary"
            onClick={onSkip}
            disabled={submitting}
          >
            No cambiar precios
          </button>
          <button
            type="submit"
            className="finance-btn finance-btn-primary"
            disabled={submitting || selectedCount === 0}
          >
            {submitting ? 'Guardando...' : `Actualizar ${selectedCount} precio(s)`}
          </button>
        </div>
      </form>
    </ModalFrame>
  )
}
