import type { ChangeEvent, KeyboardEvent } from 'react'
import type { Product } from '../../types/product'
import type { PurchaseInvoiceLineInput } from '../../types/purchaseInvoice'
import type { StockCategory } from '../../types/stockCategory'
import { formatMoney, parseMoneyInput } from '../../utils/formatMoney'
import {
  categorySelectionPatch,
  getPurchaseLinePreview,
  productSelectionPatch,
  switchReceiveMode,
} from '../../utils/purchaseInvoiceLine'
import { productAllowsBundle } from '../../utils/productUnits'
import { MoneyInput } from '../ui/MoneyInput'

export interface PurchaseInvoiceLineRowProps {
  index: number
  line: PurchaseInvoiceLineInput
  products: Product[]
  stockCategories: StockCategory[]
  currencyCode: string
  canRemove: boolean
  onChange: (patch: Partial<PurchaseInvoiceLineInput>) => void
  onRemove: () => void
  onCreateProduct: () => void
}

export function PurchaseInvoiceLineRow({
  index,
  line,
  products,
  stockCategories,
  currencyCode,
  canRemove,
  onChange,
  onRemove,
  onCreateProduct,
}: PurchaseInvoiceLineRowProps) {
  const isCategoryLine = line.lineType === 'category'
  const product = !isCategoryLine ? products.find((entry) => entry.id === line.productId) : undefined
  const category = isCategoryLine
    ? stockCategories.find((entry) => entry.id === line.stockCategoryId)
    : undefined
  const allowsBundle = product ? productAllowsBundle(product) : false
  const preview = getPurchaseLinePreview(line, product, category)
  const unitLabel = isCategoryLine
    ? category?.unitLabel ?? line.unitLabel
    : product?.unitLabel ?? line.unitLabel
  const isPendingNewProduct = !isCategoryLine && line.isNewProduct && !line.productId

  function handleCatalogSelect(event: ChangeEvent<HTMLSelectElement>) {
    const value = event.target.value

    if (!value) {
      onChange({
        isNewProduct: false,
        productId: '',
        description: '',
      })
      return
    }

    const selected = products.find((entry) => entry.id === value)
    if (!selected) return

    onChange({
      isNewProduct: false,
      productId: value,
      description: selected.name,
      ...productSelectionPatch(selected),
    })
  }

  function handleCategorySelect(event: ChangeEvent<HTMLSelectElement>) {
    const value = event.target.value

    if (!value) {
      onChange({
        stockCategoryId: '',
        description: '',
      })
      return
    }

    const selected = stockCategories.find((entry) => entry.id === value)
    if (!selected) return

    onChange(categorySelectionPatch(selected))
  }

  function handleNewNameChange(event: ChangeEvent<HTMLInputElement>) {
    onChange({ description: event.target.value, productId: '' })
  }

  function handleNewNameKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault()
      onCreateProduct()
    }
  }

  function switchLineType(nextType: 'product' | 'category') {
    if (nextType === line.lineType) return

    if (nextType === 'category') {
      onChange({
        lineType: 'category',
        productId: '',
        isNewProduct: false,
        stockCategoryId: '',
        description: '',
        receiveMode: 'units',
      })
      return
    }

    onChange({
      lineType: 'product',
      stockCategoryId: '',
      productId: '',
      description: '',
      isNewProduct: false,
    })
  }

  const hasSelection = isCategoryLine ? Boolean(category) : Boolean(product)

  return (
    <article className="purchase-line-card">
      <header className="purchase-line-card-header">
        <span className="purchase-line-badge">Línea {index + 1}</span>
        {hasSelection && (
          <span className="purchase-line-stock-preview">
            {isCategoryLine ? 'Entra al stock global:' : 'Entra al inventario:'}{' '}
            <strong>
              {preview.stockUnits} {unitLabel}
            </strong>
          </span>
        )}
        {canRemove && (
          <button type="button" className="purchase-line-remove" onClick={onRemove}>
            Quitar
          </button>
        )}
      </header>

      <div className="purchase-line-card-body">
        <div className="purchase-field purchase-field-full purchase-receive-field">
          <div className="inventory-stock-mode-toggle purchase-receive-toggle">
            <button
              type="button"
              className={line.lineType === 'product' ? 'active' : undefined}
              onClick={() => switchLineType('product')}
            >
              Producto
            </button>
            <button
              type="button"
              className={line.lineType === 'category' ? 'active' : undefined}
              onClick={() => switchLineType('category')}
            >
              Categoría global
            </button>
          </div>
          {isCategoryLine && (
            <small className="purchase-field-hint-muted">
              Ej. pollo comprado en bloque; los cortes derivados descuentan de aquí al vender.
            </small>
          )}
        </div>

        {isCategoryLine ? (
          <label className="purchase-field purchase-field-product">
            <span>Categoría</span>
            <select
              className="finance-select"
              value={line.stockCategoryId}
              onChange={handleCategorySelect}
              required
            >
              <option value="">Selecciona categoría global</option>
              {stockCategories.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.name} ({entry.stock} {entry.unitLabel} actuales)
                </option>
              ))}
            </select>
          </label>
        ) : isPendingNewProduct ? (
          <div className="purchase-new-product-panel">
            <button
              type="button"
              className="purchase-back-to-catalog"
              onClick={() =>
                onChange({ isNewProduct: false, productId: '', description: '' })
              }
            >
              ← Elegir producto existente
            </button>

            <button
              type="button"
              className="purchase-new-product-trigger"
              onClick={onCreateProduct}
            >
              <label className="purchase-field purchase-field-product">
                <span>Nombre del producto nuevo</span>
                <input
                  type="text"
                  value={line.description}
                  onChange={handleNewNameChange}
                  onClick={(event) => event.stopPropagation()}
                  onKeyDown={handleNewNameKeyDown}
                  placeholder="Ej. Arroz Premium 1 kg"
                  required
                />
              </label>
              <span className="purchase-new-product-cta">
                Pulsa aquí para registrar categoría, precios, bultos y demás datos →
              </span>
            </button>
          </div>
        ) : (
          <label className="purchase-field purchase-field-product">
            <span>Producto</span>
            <div className="purchase-product-row">
              <select
                className="finance-select"
                value={line.productId}
                onChange={handleCatalogSelect}
                required={!line.isNewProduct}
              >
                <option value="">Selecciona producto del catálogo</option>
                {products.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.name}
                    {entry.stockCategoryId ? ' · descuenta categoría' : ''}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="finance-btn finance-btn-secondary"
                onClick={() =>
                  onChange({ isNewProduct: true, productId: '', description: '' })
                }
              >
                + Nuevo
              </button>
            </div>
          </label>
        )}

        {product && allowsBundle && (
          <div className="purchase-field purchase-field-full purchase-receive-field">
            <div className="inventory-stock-mode-toggle purchase-receive-toggle">
              <button
                type="button"
                className={line.receiveMode === 'units' ? 'active' : undefined}
                onClick={() => onChange(switchReceiveMode(line, 'units', product))}
              >
                Por {unitLabel}
              </button>
              <button
                type="button"
                className={line.receiveMode === 'bundles' ? 'active' : undefined}
                onClick={() => onChange(switchReceiveMode(line, 'bundles', product))}
              >
                Por bulto ({preview.unitsPerBundle} {unitLabel}/bulto)
              </button>
            </div>
          </div>
        )}

        {hasSelection && (
          <div className="purchase-line-entry">
            <div className="purchase-line-inputs">
              <label className="purchase-field">
                <span>
                  {!isCategoryLine && line.receiveMode === 'bundles' && allowsBundle
                    ? 'Bultos'
                    : `Cantidad (${unitLabel})`}
                </span>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={line.inputQuantity > 0 ? line.inputQuantity : ''}
                  placeholder="0"
                  onChange={(event) => {
                    const raw = event.target.value
                    onChange({ inputQuantity: raw === '' ? 0 : Number(raw) })
                  }}
                  required
                />
              </label>

              <label className="purchase-field">
                <span>
                  {!isCategoryLine && line.receiveMode === 'bundles' && allowsBundle
                    ? 'Costo / bulto'
                    : `Costo / ${unitLabel}`}
                </span>
                <MoneyInput
                  showCurrencyPrefix={false}
                  blankWhenZero
                  min="0"
                  value={
                    !isCategoryLine && line.receiveMode === 'bundles' && allowsBundle
                      ? line.bundleCost
                      : line.unitCost
                  }
                  onChange={(next) => {
                    const parsed = parseMoneyInput(next)
                    if (!isCategoryLine && line.receiveMode === 'bundles' && allowsBundle) {
                      onChange({ bundleCost: parsed ?? 0 })
                    } else {
                      onChange({ unitCost: parsed ?? 0 })
                    }
                  }}
                  required
                />
              </label>
            </div>

            <div className="purchase-line-total-row">
              <span>Subtotal</span>
              <strong>{formatMoney(preview.lineTotal, currencyCode)}</strong>
            </div>
          </div>
        )}
      </div>
    </article>
  )
}
