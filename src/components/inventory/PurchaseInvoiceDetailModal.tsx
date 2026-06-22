import { useEffect, useMemo, useState, type FormEvent } from 'react'
import type { Product } from '../../types/product'
import { emptyProductForm } from '../../types/product'
import type { StockCategory } from '../../types/stockCategory'
import {
  emptyPurchaseInvoiceLine,
  type PurchaseInvoice,
  type PurchaseInvoiceLineInput,
  type UpdatePurchaseInvoiceInput,
} from '../../types/purchaseInvoice'
import { purchaseInvoiceStatusLabels } from '../../types/purchaseInvoice'
import { invoiceDateFromIso } from '../../utils/invoiceDate'
import { formatMoney, parseMoneyInput } from '../../utils/formatMoney'
import {
  categorySelectionPatch,
  getPurchaseLinePreview,
  productSelectionPatch,
  purchaseLineToInput,
  validatePurchaseInvoiceLines,
} from '../../utils/purchaseInvoiceLine'
import { MoneyInput } from '../ui/MoneyInput'
import { ModalFrame } from '../ui/ModalFrame'
import { SupplierNameField } from '../suppliers/SupplierNameField'
import type { Supplier } from '../../types/supplier'
import { ProductFormModal } from './ProductFormModal'
import { PurchaseInvoiceLineRow } from './PurchaseInvoiceLineRow'

interface PurchaseInvoiceDetailModalProps {
  open: boolean
  invoice: PurchaseInvoice | null
  products: Product[]
  suppliers: Supplier[]
  stockCategories: StockCategory[]
  canViewCost: boolean
  submitting?: boolean
  creatingProduct?: boolean
  onClose: () => void
  onSave: (invoiceId: string, values: UpdatePurchaseInvoiceInput) => void
  onPayment: (invoiceId: string, amount: number) => void
  onMarkPaid: (invoiceId: string) => void
  onCreateProduct: (values: ReturnType<typeof emptyProductForm>) => Promise<string | null>
  onReceive?: (invoice: PurchaseInvoice) => void
  onCancel?: (invoice: PurchaseInvoice) => void
}

export function PurchaseInvoiceDetailModal({
  open,
  invoice,
  products,
  suppliers,
  stockCategories,
  canViewCost,
  submitting = false,
  creatingProduct = false,
  onClose,
  onSave,
  onPayment,
  onMarkPaid,
  onCreateProduct,
  onReceive,
  onCancel,
}: PurchaseInvoiceDetailModalProps) {
  const [supplierName, setSupplierName] = useState('')
  const [supplierId, setSupplierId] = useState('')
  const [supplierInvoiceNumber, setSupplierInvoiceNumber] = useState('')
  const [invoiceDate, setInvoiceDate] = useState('')
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<PurchaseInvoiceLineInput[]>([])
  const [paymentAmount, setPaymentAmount] = useState('')
  const [formError, setFormError] = useState('')
  const [productModalOpen, setProductModalOpen] = useState(false)
  const [productModalLineIndex, setProductModalLineIndex] = useState(0)

  useEffect(() => {
    if (!open || !invoice) return

    setSupplierName(invoice.supplierName)
    setSupplierId(invoice.supplierId ?? '')
    setSupplierInvoiceNumber(invoice.supplierInvoiceNumber ?? '')
    setInvoiceDate(invoiceDateFromIso(invoice.invoiceDate ?? invoice.createdAt))
    setNotes(invoice.notes ?? '')
    setLines(
      invoice.lines.length > 0
        ? invoice.lines.map((line) =>
            purchaseLineToInput(
              line,
              stockCategories.find((category) => category.id === line.stockCategoryId),
            ),
          )
        : [emptyPurchaseInvoiceLine()],
    )
    setPaymentAmount('')
    setFormError('')
  }, [open, invoice, products, stockCategories])

  const totalAmount = useMemo(() => {
    return lines.reduce((sum, line) => {
      const product =
        line.lineType === 'product'
          ? products.find((entry) => entry.id === line.productId)
          : undefined
      const category =
        line.lineType === 'category'
          ? stockCategories.find((entry) => entry.id === line.stockCategoryId)
          : undefined
      return sum + getPurchaseLinePreview(line, product, category).lineTotal
    }, 0)
  }, [lines, products, stockCategories])

  const quickProductInitial = useMemo(() => {
    const line = lines[productModalLineIndex]
    return {
      ...emptyProductForm(),
      stock: 0,
      costPrice: line?.unitCost ?? 0,
      name: line?.description?.trim() ?? '',
    }
  }, [lines, productModalLineIndex])

  if (!open || !invoice) return null

  const invoiceId = invoice.id
  const canPay = invoice.status !== 'cancelled' && invoice.status !== 'pending' && invoice.amountDue > 0.01
  const isLegacyPending = invoice.status === 'pending'
  const isCancelled = invoice.status === 'cancelled'
  const canEditLines = !isCancelled

  function updateLine(index: number, patch: Partial<PurchaseInvoiceLineInput>) {
    setLines((current) =>
      current.map((line, lineIndex) => {
        if (lineIndex !== index) return line

        const next = { ...line, ...patch }
        if (patch.productId) {
          const product = products.find((entry) => entry.id === patch.productId)
          if (product) {
            Object.assign(next, productSelectionPatch(product))
          }
        }
        if (patch.stockCategoryId) {
          const category = stockCategories.find((entry) => entry.id === patch.stockCategoryId)
          if (category) {
            Object.assign(next, categorySelectionPatch(category))
          }
        }
        return next
      }),
    )
  }

  async function handleCreateProduct(values: ReturnType<typeof emptyProductForm>) {
    const productId = await onCreateProduct(values)
    if (productId) {
      const created = products.find((entry) => entry.id === productId)
      const currentLine = lines[productModalLineIndex]
      const unitCost = currentLine?.unitCost || values.costPrice || 0
      updateLine(productModalLineIndex, {
        productId,
        isNewProduct: false,
        description: values.name.trim(),
        ...(created ? productSelectionPatch(created) : {}),
        unitCost,
        bundleCost: currentLine?.bundleCost ?? 0,
      })
      setProductModalOpen(false)
    }
  }

  function handleSave(event: FormEvent) {
    event.preventDefault()
    setFormError('')

    if (!supplierName.trim()) {
      setFormError('El proveedor es obligatorio.')
      return
    }

    if (!invoiceDate) {
      setFormError('La fecha es obligatoria.')
      return
    }

    const lineError = validatePurchaseInvoiceLines(lines, products, stockCategories)
    if (lineError) {
      setFormError(lineError)
      return
    }

    onSave(invoiceId, {
      supplierId: supplierId || undefined,
      supplierName,
      supplierInvoiceNumber: supplierInvoiceNumber.trim() || undefined,
      invoiceDate,
      notes,
      lines,
    })
  }

  function handlePayment() {
    const amount = parseMoneyInput(paymentAmount)
    if (!amount || amount <= 0) {
      setFormError('Ingresa un monto válido para el abono.')
      return
    }

    setFormError('')
    onPayment(invoiceId, amount)
  }

  function handleMarkPaid() {
    setFormError('')
    onMarkPaid(invoiceId)
  }

  return (
    <>
      <ModalFrame
        wide
        className="purchase-invoice-detail-modal"
        onClose={onClose}
        closeDisabled={submitting}
      >
        <div className="finance-modal-header">
          <h2>Factura {invoice.number}</h2>
          <p>{purchaseInvoiceStatusLabels[invoice.status]}</p>
        </div>

        {formError && <div className="alert alert-error">{formError}</div>}

        <div className="finance-detail-grid purchase-invoice-detail-summary">
          <article>
            <span>Moneda</span>
            <strong>{invoice.currencyCode}</strong>
          </article>
          <article>
            <span>Total</span>
            <strong>{formatMoney(totalAmount, invoice.currencyCode)}</strong>
          </article>
          <article>
            <span>Pagado</span>
            <strong>{formatMoney(invoice.amountPaid, invoice.currencyCode)}</strong>
          </article>
          <article>
            <span>Por pagar</span>
            <strong>{formatMoney(invoice.amountDue, invoice.currencyCode)}</strong>
          </article>
        </div>

        <form className="purchase-invoice-detail-form" onSubmit={handleSave}>
          <section className="finance-detail-section">
            <h3>Datos del proveedor</h3>
            <div className="purchase-invoice-grid">
              <label className="purchase-field">
                <span>Fecha</span>
                <input
                  type="date"
                  value={invoiceDate}
                  onChange={(event) => setInvoiceDate(event.target.value)}
                  disabled={submitting || isCancelled}
                  required
                />
              </label>

              <SupplierNameField
                value={supplierName}
                suppliers={suppliers}
                disabled={submitting || isCancelled}
                onChange={(name, id) => {
                  setSupplierName(name)
                  setSupplierId(id ?? '')
                }}
              />

              <label className="purchase-field">
                <span>Nº factura proveedor</span>
                <input
                  type="text"
                  value={supplierInvoiceNumber}
                  onChange={(event) => setSupplierInvoiceNumber(event.target.value)}
                  disabled={submitting || isCancelled}
                  placeholder="Opcional"
                />
              </label>

              <label className="purchase-field purchase-field-full">
                <span>Notas</span>
                <input
                  type="text"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  disabled={submitting || isCancelled}
                  placeholder="Observaciones"
                />
              </label>
            </div>
          </section>

          <section className="finance-detail-section">
            <div className="purchase-invoice-section-head">
              <h3>Productos y categorías</h3>
              {canEditLines && (
                <button
                  type="button"
                  className="finance-btn finance-btn-secondary"
                  disabled={submitting}
                  onClick={() => setLines((current) => [...current, emptyPurchaseInvoiceLine()])}
                >
                  + Agregar línea
                </button>
              )}
            </div>

            <div className="purchase-lines-stack">
              {lines.map((line, index) => (
                <PurchaseInvoiceLineRow
                  key={index}
                  index={index}
                  line={line}
                  products={products}
                  stockCategories={stockCategories}
                  currencyCode={invoice.currencyCode}
                  canRemove={canEditLines && lines.length > 1}
                  onChange={(patch) => updateLine(index, patch)}
                  onRemove={() => setLines((current) => current.filter((_, i) => i !== index))}
                  onCreateProduct={() => {
                    setProductModalLineIndex(index)
                    setProductModalOpen(true)
                  }}
                />
              ))}
            </div>
          </section>

          {canPay && (
            <section className="finance-detail-section">
              <h3>Pago al proveedor</h3>
              <div className="purchase-invoice-payment-panel">
                <label className="purchase-field">
                  <span>Monto del abono ({invoice.currencyCode})</span>
                  <MoneyInput
                    showCurrencyPrefix={false}
                    blankWhenZero
                    value={paymentAmount}
                    onChange={setPaymentAmount}
                    disabled={submitting}
                    placeholder="0"
                  />
                </label>
                <div className="purchase-invoice-payment-actions">
                  <button
                    type="button"
                    className="finance-btn finance-btn-secondary"
                    disabled={submitting}
                    onClick={handlePayment}
                  >
                    Registrar abono
                  </button>
                  <button
                    type="button"
                    className="finance-btn finance-btn-primary"
                    disabled={submitting}
                    onClick={handleMarkPaid}
                  >
                    Marcar como pagada
                  </button>
                </div>
              </div>
            </section>
          )}

          {isLegacyPending && (
            <section className="finance-detail-section">
              <h3>Entrada pendiente</h3>
              <p className="finance-detail-hint">
                Esta factura es anterior al flujo actual. Regístrala al inventario o anúlala si no
                aplica.
              </p>
              <div className="purchase-invoice-payment-actions">
                {onReceive && (
                  <button
                    type="button"
                    className="finance-btn finance-btn-primary"
                    disabled={submitting}
                    onClick={() => onReceive(invoice)}
                  >
                    Registrar entrada al inventario
                  </button>
                )}
                {onCancel && (
                  <button
                    type="button"
                    className="finance-btn finance-btn-secondary"
                    disabled={submitting}
                    onClick={() => onCancel(invoice)}
                  >
                    Anular factura
                  </button>
                )}
              </div>
            </section>
          )}

          <div className="finance-form-actions">
            <button
              type="button"
              className="finance-btn finance-btn-secondary"
              onClick={onClose}
              disabled={submitting}
            >
              Cerrar
            </button>
            {!isCancelled && (
              <button type="submit" className="finance-btn finance-btn-primary" disabled={submitting}>
                {submitting ? 'Guardando...' : 'Guardar cambios'}
              </button>
            )}
          </div>
        </form>
      </ModalFrame>

      <ProductFormModal
        open={productModalOpen}
        mode="create"
        nested
        fromPurchaseEntry
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
