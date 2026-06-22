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
import {
  categorySelectionPatch,
  getPurchaseLinePreview,
  productSelectionPatch,
  validatePurchaseInvoiceLines,
} from '../../utils/purchaseInvoiceLine'
import { todayInputValue } from '../../utils/invoiceDate'
import { MoneyInput } from '../ui/MoneyInput'
import { ModalFrame } from '../ui/ModalFrame'
import { SupplierNameField } from '../suppliers/SupplierNameField'
import type { Supplier } from '../../types/supplier'
import { ProductFormModal } from './ProductFormModal'
import { PurchaseInvoiceLineRow } from './PurchaseInvoiceLineRow'

interface PurchaseInvoiceFormModalProps {
  open: boolean
  products: Product[]
  suppliers: Supplier[]
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
  suppliers,
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
  const [supplierId, setSupplierId] = useState('')
  const [supplierInvoiceNumber, setSupplierInvoiceNumber] = useState('')
  const [invoiceDate, setInvoiceDate] = useState(todayInputValue())
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
      setSupplierId('')
      setSupplierInvoiceNumber('')
      setInvoiceDate(todayInputValue())
      setCurrencyCode(
        currencies.find((currency) => currency.isBase)?.code ?? DEFAULT_BASE_CURRENCY_CODE,
      )
      setNotes('')
      setAmountPaid('0')
      setLines([emptyPurchaseInvoiceLine()])
      setFormError('')
    }
  }, [open, currencies])

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

  const currencyMeta = currencies.find((currency) => currency.code === currencyCode)
  const totalUnits = useMemo(() => {
    return lines.reduce((sum, line) => {
      const product =
        line.lineType === 'product'
          ? products.find((entry) => entry.id === line.productId)
          : undefined
      const category =
        line.lineType === 'category'
          ? stockCategories.find((entry) => entry.id === line.stockCategoryId)
          : undefined
      return sum + getPurchaseLinePreview(line, product, category).stockUnits
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

  if (!open) return null

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

  function openProductModalForLine(index: number) {
    setFormError('')
    setProductModalLineIndex(index)
    setProductModalOpen(true)
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

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setFormError('')

    if (!supplierName.trim()) {
      setFormError('El proveedor es obligatorio.')
      return
    }

    const lineError = validatePurchaseInvoiceLines(lines, products, stockCategories)
    if (lineError) {
      setFormError(lineError)
      return
    }

    onSubmit({
      supplierId: supplierId || undefined,
      supplierName,
      supplierInvoiceNumber: supplierInvoiceNumber.trim() || undefined,
      invoiceDate,
      currencyCode,
      notes,
      amountPaid: parseMoneyInput(amountPaid) ?? 0,
      lines,
    })
  }

  return (
    <>
      <ModalFrame
        wide
        className="purchase-invoice-modal"
        onClose={onClose}
        closeDisabled={submitting}
      >
        <div className="finance-modal-header purchase-invoice-header">
          <div>
            <h2>Registrar entrada de mercancía</h2>
            <p>Lo que guardes aquí actualiza el inventario al instante.</p>
          </div>
        </div>

        <form className="purchase-invoice-form" onSubmit={handleSubmit}>
          {formError && <div className="alert alert-error">{formError}</div>}

          <section className="purchase-invoice-section">
            <h3>Datos del proveedor</h3>
            <div className="purchase-invoice-grid">
              <label className="purchase-field">
                <span>Fecha</span>
                <input
                  type="date"
                  value={invoiceDate}
                  onChange={(event) => setInvoiceDate(event.target.value)}
                  required
                />
              </label>

              <SupplierNameField
                value={supplierName}
                suppliers={suppliers}
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
                  placeholder="Opcional"
                />
              </label>

              <label className="purchase-field">
                <span>Moneda</span>
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

              <label className="purchase-field purchase-field-full">
                <span>Notas</span>
                <input
                  type="text"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Guía, referencia u observación"
                />
              </label>
            </div>
          </section>

          <section className="purchase-invoice-section">
            <div className="purchase-invoice-section-head">
              <div>
                <h3>Productos y categorías</h3>
                <p className="purchase-section-hint">
                  Registra productos del catálogo o categorías globales (ej. pollo). Los derivados
                  de una categoría descuentan de su stock al vender.
                </p>
              </div>
              <button
                type="button"
                className="finance-btn finance-btn-secondary"
                onClick={() => setLines((current) => [...current, emptyPurchaseInvoiceLine()])}
              >
                + Agregar línea
              </button>
            </div>

            <div className="purchase-lines-stack">
              {lines.map((line, index) => (
                <PurchaseInvoiceLineRow
                  key={index}
                  index={index}
                  line={line}
                  products={products}
                  stockCategories={stockCategories}
                  currencyCode={currencyCode}
                  canRemove={lines.length > 1}
                  onChange={(patch) => updateLine(index, patch)}
                  onRemove={() => setLines((current) => current.filter((_, i) => i !== index))}
                  onCreateProduct={() => openProductModalForLine(index)}
                />
              ))}
            </div>
          </section>

          <footer className="purchase-invoice-footer">
            <div className="purchase-invoice-summary">
              <label className="purchase-field">
                <span>Anticipo pagado ({currencyCode})</span>
                <MoneyInput
                  showCurrencyPrefix={false}
                  min="0"
                  value={amountPaid}
                  onChange={setAmountPaid}
                />
              </label>

              <div className="purchase-invoice-totals">
                <article>
                  <span>Unidades en inventario</span>
                  <strong>{totalUnits.toLocaleString('es')}</strong>
                </article>
                <article className="purchase-invoice-total-main">
                  <span>Total factura</span>
                  <strong>
                    {formatMoney(totalAmount, currencyCode, currencyMeta?.symbol)}
                  </strong>
                </article>
              </div>
            </div>

            <div className="finance-form-actions purchase-invoice-actions">
              <button
                type="button"
                className="finance-btn finance-btn-secondary"
                onClick={onClose}
                disabled={submitting}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="finance-btn finance-btn-primary"
                disabled={submitting}
              >
                {submitting ? 'Registrando...' : 'Guardar y actualizar inventario'}
              </button>
            </div>
          </footer>
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
