import { useEffect, useMemo, useState, type FormEvent } from 'react'
import type { Product } from '../../types/product'
import type { StockCategory } from '../../types/stockCategory'
import type { CreateWasteInput, WasteReason } from '../../types/inventory'
import { wasteReasonLabels } from '../../types/inventory'
import { MoneyInput } from '../ui/MoneyInput'
import { formatBaseMoney, parseMoneyInput } from '../../utils/formatMoney'
import { computeWasteLineCost } from '../../utils/wasteCost'
import { ModalFrame } from '../ui/ModalFrame'

interface WasteFormModalProps {
  open: boolean
  products: Product[]
  categories: StockCategory[]
  submitting: boolean
  onClose: () => void
  onSubmit: (values: CreateWasteInput) => void
}

const wasteReasons = Object.keys(wasteReasonLabels) as WasteReason[]

export function WasteFormModal({
  open,
  products,
  categories,
  submitting,
  onClose,
  onSubmit,
}: WasteFormModalProps) {
  const standaloneProducts = useMemo(
    () => products.filter((product) => !product.stockCategoryId),
    [products],
  )

  const [sourceType, setSourceType] = useState<'product' | 'category'>('product')
  const [productId, setProductId] = useState('')
  const [stockCategoryId, setStockCategoryId] = useState('')
  const [relatedProductId, setRelatedProductId] = useState('')
  const [unitCost, setUnitCost] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [reason, setReason] = useState<WasteReason>('spoiled')
  const [notes, setNotes] = useState('')

  const categoryLinkedProducts = useMemo(
    () => products.filter((product) => product.stockCategoryId === stockCategoryId),
    [products, stockCategoryId],
  )

  useEffect(() => {
    if (!open) return

    const hasCategories = categories.length > 0
    const hasStandalone = standaloneProducts.length > 0
    const initialCategoryId = categories[0]?.id ?? ''
    const initialLinked = products.filter((product) => product.stockCategoryId === initialCategoryId)

    setSourceType(hasCategories ? 'category' : 'product')
    setProductId(standaloneProducts[0]?.id ?? '')
    setStockCategoryId(initialCategoryId)
    setRelatedProductId(initialLinked[0]?.id ?? '')
    setUnitCost('')
    setQuantity('1')
    setReason('spoiled')
    setNotes('')

    if (!hasCategories && hasStandalone) {
      setSourceType('product')
    }
  }, [open, standaloneProducts, categories, products])

  useEffect(() => {
    if (sourceType !== 'category') return
    const stillValid = categoryLinkedProducts.some((product) => product.id === relatedProductId)
    if (!stillValid) {
      setRelatedProductId(categoryLinkedProducts[0]?.id ?? '')
    }
  }, [sourceType, stockCategoryId, categoryLinkedProducts, relatedProductId])

  const selectedProduct = standaloneProducts.find((product) => product.id === productId)
  const selectedCategory = categories.find((category) => category.id === stockCategoryId)

  const estimatedUnitCost = useMemo(() => {
    if (sourceType === 'product') {
      return selectedProduct?.costPrice ?? 0
    }
    return parseMoneyInput(unitCost)
  }, [sourceType, selectedProduct, unitCost])

  const parsedQuantity = Number(quantity)
  const estimatedLineCost =
    parsedQuantity > 0 && estimatedUnitCost > 0
      ? computeWasteLineCost(parsedQuantity, estimatedUnitCost)
      : 0

  if (!open) return null

  function handleSubmit(event: FormEvent) {
    event.preventDefault()

    onSubmit({
      sourceType,
      productId: sourceType === 'product' ? productId : undefined,
      stockCategoryId: sourceType === 'category' ? stockCategoryId : undefined,
      relatedProductId:
        sourceType === 'category' && relatedProductId ? relatedProductId : undefined,
      unitCost: sourceType === 'category' ? parseMoneyInput(unitCost) : undefined,
      quantity: Number(quantity),
      reason,
      notes: notes.trim() || undefined,
    })
  }

  const unitLabel =
    sourceType === 'product' ? selectedProduct?.unitLabel ?? 'und' : selectedCategory?.unitLabel ?? 'kg'

  const currentStock =
    sourceType === 'product' ? selectedProduct?.stock ?? 0 : selectedCategory?.stock ?? 0

  const canUseCategory = categories.length > 0
  const canUseProduct = standaloneProducts.length > 0
  const requiresRelatedProduct = sourceType === 'category' && categoryLinkedProducts.length > 0

  return (
    <ModalFrame onClose={onClose}>
      <div className="finance-modal-header">
        <h2>Registrar merma</h2>
        <p>
          Categoría: indica qué producto se perdió e ingresa el costo manualmente. Producto propio:
          usa el costo del catálogo.
        </p>
      </div>

      <form className="finance-form" onSubmit={handleSubmit}>
        <div className="finance-form-grid">
          <label className="finance-field finance-field-full">
            <span>Origen del stock</span>
            <select
              value={sourceType}
              onChange={(event) => setSourceType(event.target.value as 'product' | 'category')}
            >
              <option value="category" disabled={!canUseCategory}>
                Categoría compartida
              </option>
              <option value="product" disabled={!canUseProduct}>
                Producto con stock propio
              </option>
            </select>
          </label>

          {sourceType === 'category' ? (
            <>
              <label className="finance-field finance-field-full">
                <span>Categoría</span>
                <select
                  value={stockCategoryId}
                  onChange={(event) => setStockCategoryId(event.target.value)}
                  required
                >
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name} · {category.stock} {category.unitLabel}
                    </option>
                  ))}
                </select>
              </label>

              {requiresRelatedProduct ? (
                <label className="finance-field finance-field-full">
                  <span>Producto perdido</span>
                  <select
                    value={relatedProductId}
                    onChange={(event) => setRelatedProductId(event.target.value)}
                    required
                  >
                    {categoryLinkedProducts.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name}
                      </option>
                    ))}
                  </select>
                  <small className="finance-field-hint">
                    Qué pieza o corte se perdió (el stock se descuenta de la categoría).
                  </small>
                </label>
              ) : null}

              <label className="finance-field">
                <span>Costo unitario ({unitLabel})</span>
                <MoneyInput
                  showCurrencyPrefix
                  min="0"
                  value={unitCost}
                  onChange={setUnitCost}
                  required
                />
                <small className="finance-field-hint">
                  Ingresa cuánto te costó cada {unitLabel} perdido (se congela al guardar).
                </small>
              </label>
            </>
          ) : (
            <label className="finance-field finance-field-full">
              <span>Producto</span>
              <select value={productId} onChange={(event) => setProductId(event.target.value)} required>
                {standaloneProducts.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name} · {product.stock} {product.unitLabel} · costo{' '}
                    {formatBaseMoney(product.costPrice)}
                  </option>
                ))}
              </select>
              <small className="finance-field-hint">
                Solo productos con stock propio (no compartido con categoría).
              </small>
            </label>
          )}

          <label className="finance-field">
            <span>Cantidad perdida ({unitLabel})</span>
            <input
              type="number"
              step="0.001"
              min="0.001"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
              required
            />
            <small className="finance-field-hint">Stock actual: {currentStock} {unitLabel}</small>
          </label>

          {estimatedLineCost > 0 ? (
            <div className="finance-field finance-field-full">
              <span>Valor de la pérdida</span>
              <p className="finance-field-hint">
                {formatBaseMoney(estimatedUnitCost)} / {unitLabel} × {parsedQuantity || 0}{' '}
                {unitLabel} = <strong className="expense-negative">{formatBaseMoney(estimatedLineCost)}</strong>
              </p>
            </div>
          ) : sourceType === 'category' ? (
            <div className="finance-field finance-field-full">
              <span>Valor de la pérdida</span>
              <p className="finance-field-hint">Ingresa el costo unitario para calcular el valor.</p>
            </div>
          ) : null}

          <label className="finance-field">
            <span>Motivo</span>
            <select
              value={reason}
              onChange={(event) => setReason(event.target.value as WasteReason)}
            >
              {wasteReasons.map((wasteReason) => (
                <option key={wasteReason} value={wasteReason}>
                  {wasteReasonLabels[wasteReason]}
                </option>
              ))}
            </select>
          </label>

          <label className="finance-field finance-field-full">
            <span>Notas (opcional)</span>
            <input
              type="text"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Detalle adicional, lote, responsable..."
            />
          </label>
        </div>

        <div className="finance-form-actions">
          <button type="button" className="finance-btn finance-btn-secondary" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="submit"
            className="finance-btn finance-btn-primary"
            disabled={submitting || (requiresRelatedProduct && !relatedProductId)}
          >
            {submitting ? 'Guardando...' : 'Registrar merma'}
          </button>
        </div>
      </form>
    </ModalFrame>
  )
}
