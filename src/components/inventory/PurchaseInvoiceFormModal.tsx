import { useEffect, useMemo, useState, type FormEvent } from 'react'
import type { Currency } from '../../types/finance'
import type { Product } from '../../types/product'
import { emptyProductForm } from '../../types/product'
import type { StockCategory } from '../../types/stockCategory'
import {
  emptyPurchaseInvoiceLine,
  type CreatePurchaseInvoiceInput,
  type PurchaseInvoiceLineInput,
} from '../../types/purchaseInvoice'
import { DEFAULT_BASE_CURRENCY_CODE } from '../../constants/currency'
import { formatMoney, parseMoneyInput } from '../../utils/formatMoney'
import { MoneyInput } from '../ui/MoneyInput'
import { ModalFrame } from '../ui/ModalFrame'
import { ProductFormModal } from './ProductFormModal'

interface PurchaseInvoiceFormModalProps {
  open: boolean
  products: Product[]
  currencies: Currency[]
  stockCategories: StockCategory[]
  canViewCost: boolean
  submitting: boolean
  creatingProduct?: boolean
  onClose: () => void
  onSubmit: (values: CreatePurchaseInvoiceInput) => void
  onCreateProduct: (values: ReturnType<typeof emptyProductForm>) => Promise<string | null>
}

export function PurchaseInvoiceFormModal({
  open,
  products,
  currencies,
  stockCategories,
  canViewCost,
  submitting,
  creatingProduct = false,
  onClose,
  onSubmit,
  onCreateProduct,
}: PurchaseInvoiceFormModalProps) {
  const [supplierName, setSupplierName] = useState('')
  const [supplierInvoiceNumber, setSupplierInvoiceNumber] = useState('')
  const [currencyCode, setCurrencyCode] = useState(DEFAULT_BASE_CURRENCY_CODE)
  const [notes, setNotes] = useState('')
  const [amountPaid, setAmountPaid] = useState('0')
  const [lines, setLines] = useState<PurchaseInvoiceLineInput[]>([emptyPurchaseInvoiceLine()])
  const [productModalOpen, setProductModalOpen] = useState(false)
  const [productModalLineIndex, setProductModalLineIndex] = useState(0)
  const [formError, setFormError] = useState('')

  useEffect(() => {
    if (open) {
      setSupplierName('')
      setSupplierInvoiceNumber('')
      setCurrencyCode(
        currencies.find((currency) => currency.isBase)?.code ?? DEFAULT_BASE_CURRENCY_CODE,
      )
      setNotes('')
      setAmountPaid('0')
      setLines([emptyPurchaseInvoiceLine()])
      setFormError('')
    }
  }, [open, currencies])

  const totalAmount = useMemo(
    () => lines.reduce((sum, line) => sum + line.quantity * line.unitCost, 0),
    [lines],
  )

  const currencyMeta = currencies.find((currency) => currency.code === currencyCode)

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

  function openProductModalForLine(index: number) {
    setProductModalLineIndex(index)
    setProductModalOpen(true)
  }

  async function handleCreateProduct(values: ReturnType<typeof emptyProductForm>) {
    const productId = await onCreateProduct(values)
    if (productId) {
      updateLine(productModalLineIndex, { productId })
      setProductModalOpen(false)
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setFormError('')

    if (!supplierName.trim()) {
      setFormError('El proveedor es obligatorio.')
      return
    }

    if (lines.some((line) => !line.productId)) {
      setFormError('Cada línea debe tener un producto. Crea uno nuevo si no existe en el catálogo.')
      return
    }

    onSubmit({
      supplierName,
      supplierInvoiceNumber: supplierInvoiceNumber.trim() || undefined,
      currencyCode,
      notes,
      amountPaid: parseMoneyInput(amountPaid) ?? 0,
      lines,
    })
  }

  const quickProductInitial = {
    ...emptyProductForm(),
    stock: 0,
    costPrice: lines[productModalLineIndex]?.unitCost ?? 0,
    name: lines[productModalLineIndex]?.description ?? '',
  }

  return (
    <>
      <ModalFrame wide onClose={onClose} closeDisabled={submitting}>
        <div className="finance-modal-header">
          <h2>Registrar entrada de mercancía</h2>
          <p>
            Indica lo que llegó del proveedor. Al guardar, el inventario se actualiza de inmediato.
          </p>
        </div>

        <form className="inventory-form" onSubmit={handleSubmit}>
          {formError && <div className="alert alert-error">{formError}</div>}

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
              <span>Nº factura proveedor</span>
              <input
                type="text"
                value={supplierInvoiceNumber}
                onChange={(event) => setSupplierInvoiceNumber(event.target.value)}
                placeholder="Opcional"
              />
            </label>

            <label className="inventory-field">
              <span>Moneda de la factura</span>
              <select
                className="finance-select"
                value={currencyCode}
                onChange={(event) => setCurrencyCode(event.target.value)}
                required
              >
                {currencies.map((currency) => (
                  <option key={currency.id} value={currency.code}>
                    {currency.code} · {currency.name}
                  </option>
                ))}
              </select>
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
            <div className="purchase-invoice-lines-header">
              <h3>Productos recibidos</h3>
              <button
                type="button"
                className="inventory-btn inventory-btn-secondary"
                onClick={() => setLines((current) => [...current, emptyPurchaseInvoiceLine()])}
              >
                Agregar línea
              </button>
            </div>

            {lines.map((line, index) => (
              <div key={index} className="purchase-invoice-line">
                <label className="inventory-field">
                  <span>Producto</span>
                  <select
                    className="finance-select"
                    value={line.productId}
                    onChange={(event) => updateLine(index, { productId: event.target.value })}
                    required
                  >
                    <option value="">Selecciona producto</option>
                    {products.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name}
                      </option>
                    ))}
                  </select>
                </label>

                <button
                  type="button"
                  className="inventory-link-btn purchase-invoice-new-product"
                  onClick={() => openProductModalForLine(index)}
                >
                  + Nuevo producto
                </button>

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
                  <span>Costo unit. ({currencyCode})</span>
                  <MoneyInput
                    showCurrencyPrefix={false}
                    min="0"
                    value={line.unitCost}
                    onChange={(next) => {
                      const parsed = parseMoneyInput(next)
                      updateLine(index, {
                        unitCost: parsed ?? 0,
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
          </div>

          <div className="inventory-form-grid">
            <label className="inventory-field">
              <span>Anticipo pagado ({currencyCode})</span>
              <MoneyInput
                showCurrencyPrefix={false}
                min="0"
                value={amountPaid}
                onChange={setAmountPaid}
              />
            </label>

            <div className="inventory-field">
              <span>Total factura</span>
              <strong className="purchase-invoice-total">
                {formatMoney(totalAmount, currencyCode, currencyMeta?.symbol)}
              </strong>
            </div>
          </div>

          <div className="finance-form-actions">
            <button type="button" className="finance-btn finance-btn-secondary" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="finance-btn finance-btn-primary" disabled={submitting}>
              {submitting ? 'Registrando...' : 'Guardar y actualizar inventario'}
            </button>
          </div>
        </form>
      </ModalFrame>

      <ProductFormModal
        open={productModalOpen}
        mode="create"
        initialValues={quickProductInitial}
        stockCategories={stockCategories}
        canViewCost={canViewCost}
        submitting={creatingProduct}
        onClose={() => setProductModalOpen(false)}
        onSubmit={handleCreateProduct}
      />
    </>
  )
}
