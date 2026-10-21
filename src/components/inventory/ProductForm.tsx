import { useMemo, useState, type FormEvent } from 'react'
import { defaultProductTypes, type ProductFormInput, type ProductTypeOption } from '../../types/product'
import type { StockCategory } from '../../types/stockCategory'
import { isLikelyBarcode, normalizeBarcode } from '../../utils/barcode'
import {
  formatStockSummary,
  getStockInputStep,
  resolveProductStock,
  stockBundlesFromUnits,
  type StockInputMode,
} from '../../utils/productUnits'
import { DEFAULT_BASE_CURRENCY_CODE } from '../../constants/currency'
import { MoneyInput } from '../ui/MoneyInput'
import { formatBaseMoney, parseMoneyInput } from '../../utils/formatMoney'
import { BarcodeScannerButton } from '../ui/BarcodeScannerButton'

interface ProductFormProps {
  initialValues: ProductFormInput
  stockCategories?: StockCategory[]
  productTypes?: ProductTypeOption[]
  canViewCost: boolean
  submitting: boolean
  submitLabel: string
  secondaryLabel?: string
  omitStockFields?: boolean
  onCancel?: () => void
  onSubmit: (values: ProductFormInput) => void
  onSecondarySubmit?: (values: ProductFormInput) => void
}

export function ProductForm({
  initialValues,
  stockCategories = [],
  productTypes = defaultProductTypes,
  canViewCost,
  submitting,
  submitLabel,
  secondaryLabel,
  omitStockFields = false,
  onCancel,
  onSubmit,
  onSecondarySubmit,
}: ProductFormProps) {
  const [values, setValues] = useState<ProductFormInput>(initialValues)
  const [stockInputMode, setStockInputMode] = useState<StockInputMode>('units')
  const [stockBundles, setStockBundles] = useState(() =>
    stockBundlesFromUnits(initialValues.stock, initialValues.unitsPerBundle),
  )
  const typeSource = productTypes.length > 0 ? productTypes : defaultProductTypes
  const typeOptions = typeSource.filter((type) => type.active || type.id === values.type)
  const usesCategoryStock = Boolean(values.stockCategoryId)
  const effectiveStock = values.allowsBundle
    ? resolveProductStock(values.stock, stockInputMode, stockBundles, values.unitsPerBundle)
    : values.stock

  const retailMargin = useMemo(() => {
    if (!canViewCost || usesCategoryStock || values.salePrice <= 0) return null
    return ((values.salePrice - values.costPrice) / values.salePrice) * 100
  }, [canViewCost, usesCategoryStock, values.costPrice, values.salePrice])

  const bundleMargin = useMemo(() => {
    if (!canViewCost || !values.allowsBundle || !values.bundleSalePrice || values.bundleSalePrice <= 0) {
      return null
    }
    const cost = values.bundleCostPrice ?? 0
    return ((values.bundleSalePrice - cost) / values.bundleSalePrice) * 100
  }, [canViewCost, values.allowsBundle, values.bundleCostPrice, values.bundleSalePrice])

  const stockSummary = useMemo(
    () =>
      formatStockSummary({
        stock: effectiveStock,
        allowsBundle: values.allowsBundle,
        unitsPerBundle: values.unitsPerBundle,
        unitLabel: values.soldBy === 'weight' ? values.unitLabel : values.unitLabel || 'und',
      }),
    [
      effectiveStock,
      values.allowsBundle,
      values.soldBy,
      values.unitLabel,
      values.unitsPerBundle,
    ],
  )

  function buildSubmitValues(): ProductFormInput {
    return {
      ...values,
      stock: effectiveStock,
    }
  }

  function handleSoldByChange(soldBy: ProductFormInput['soldBy']) {
    setValues((current) => ({
      ...current,
      soldBy,
      unitLabel: soldBy === 'weight' ? 'kg' : 'und',
      hasSaleLoss: soldBy === 'weight' ? current.hasSaleLoss : false,
      saleLossPerUnit: soldBy === 'weight' ? current.saleLossPerUnit : 0,
    }))
  }

  function handleBarcodeChange(value: string) {
    setValues((current) => ({ ...current, barcode: value }))
  }

  function commitBarcode() {
    setValues((current) => ({ ...current, barcode: normalizeBarcode(current.barcode) }))
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    onSubmit(buildSubmitValues())
  }

  const unitLabel = values.soldBy === 'weight' ? values.unitLabel : values.unitLabel || 'und'
  const linkedCategory = stockCategories.find((category) => category.id === values.stockCategoryId)

  return (
    <form className="inventory-form inventory-form-page" onSubmit={handleSubmit}>
      <div className="inventory-form-section">
        <h3>Información básica</h3>
        <div className="inventory-form-grid">
          <label className="inventory-field inventory-field-full">
            <span>Nombre del producto</span>
            <input
              type="text"
              value={values.name}
              onChange={(event) => setValues((current) => ({ ...current, name: event.target.value }))}
              placeholder="Ej. Arroz Premium"
              required
            />
          </label>

          <label className="inventory-field">
            <span>Código de barras</span>
            <div className="barcode-input-row">
              <input
                type="text"
                value={values.barcode ?? ''}
                inputMode="numeric"
                autoComplete="off"
                onChange={(event) => handleBarcodeChange(event.target.value)}
                onBlur={commitBarcode}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter') return
                  event.preventDefault()
                  commitBarcode()
                }}
                placeholder="Escanea o escribe el código"
              />
              <BarcodeScannerButton
                label="Cámara"
                onDetected={(barcode) =>
                  setValues((current) => ({ ...current, barcode: normalizeBarcode(barcode) }))
                }
              />
            </div>
            <small className="inventory-hint">
              El lector funciona como teclado. Escanea aquí y el código queda listo para vender por
              POS.
              {isLikelyBarcode(values.barcode) ? ' Código detectado.' : ''}
            </small>
          </label>

          <label className="inventory-field">
            <span>Tipo de producto</span>
            <select
              value={values.type}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  type: event.target.value as ProductFormInput['type'],
                }))
              }
            >
              {typeOptions.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.name}
                </option>
              ))}
            </select>
          </label>

          <label className="inventory-field inventory-field-full">
            <span>Categoría de inventario (opcional)</span>
            <select
              value={values.stockCategoryId ?? ''}
              onChange={(event) => {
                const stockCategoryId = event.target.value
                setValues((current) => ({
                  ...current,
                  stockCategoryId,
                  soldBy: stockCategoryId ? 'weight' : current.soldBy,
                  unitLabel: stockCategoryId ? 'kg' : current.unitLabel,
                  allowsBundle: stockCategoryId ? false : current.allowsBundle,
                  costPrice: stockCategoryId ? 0 : current.costPrice,
                  bundleCostPrice: stockCategoryId ? 0 : current.bundleCostPrice,
                }))
              }}
            >
              <option value="">Stock propio del producto</option>
              {stockCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name} ({category.stock} {category.unitLabel} disponibles)
                </option>
              ))}
            </select>
            <small className="inventory-hint">
              Usa una categoría cuando varios productos comparten el mismo inventario (ej. patas y
              pulpa de pollo restan del total de pollo).
            </small>
          </label>
        </div>
      </div>

      <div className="inventory-form-section">
        <h3>Unidad al detal</h3>
        <div className="inventory-form-grid">
          <label className="inventory-field">
            <span>Vender al detal por</span>
            <select
              value={values.soldBy}
              onChange={(event) =>
                handleSoldByChange(event.target.value as ProductFormInput['soldBy'])
              }
            >
              <option value="unit">Unidad</option>
              <option value="weight">Peso</option>
            </select>
          </label>

          <label className="inventory-field">
            <span>Unidad</span>
            <select
              value={values.unitLabel}
              onChange={(event) =>
                setValues((current) => ({ ...current, unitLabel: event.target.value }))
              }
            >
              {values.soldBy === 'unit' ? (
                <>
                  <option value="und">Unidad (und)</option>
                  <option value="paq">Paquete (paq)</option>
                </>
              ) : (
                <>
                  <option value="kg">Kilogramo (kg)</option>
                  <option value="lb">Libra (lb)</option>
                </>
              )}
            </select>
          </label>

          {!usesCategoryStock && (
            <label className="inventory-field inventory-field-full">
              <span className="inventory-checkbox-label">
                <input
                  type="checkbox"
                  checked={values.allowsBundle}
                  onChange={(event) => {
                    const checked = event.target.checked
                    if (!checked) {
                      setStockInputMode('units')
                    } else {
                      setStockBundles(
                        stockBundlesFromUnits(values.stock, values.unitsPerBundle ?? 24),
                      )
                    }
                    setValues((current) => ({
                      ...current,
                      allowsBundle: checked,
                      unitsPerBundle: checked ? current.unitsPerBundle ?? 24 : 24,
                    }))
                  }}
                />
                También se vende al mayor
              </span>
            </label>
          )}
        </div>
      </div>

      <div className="inventory-form-section">
        <h3>{usesCategoryStock ? 'Precio de venta' : 'Precio al detal'}</h3>
        {usesCategoryStock && (
          <p className="inventory-hint">
            Los derivados solo llevan precio de venta. El costo se registra en la categoría (
            {linkedCategory?.name ?? 'inventario compartido'}).
          </p>
        )}
        <div className="inventory-form-grid">
          {canViewCost && !usesCategoryStock && (
            <label className="inventory-field">
              <span>Costo por {unitLabel}</span>
              <MoneyInput
                showCurrencyPrefix
                value={values.costPrice}
                min="0"
                required
                onChange={(next) =>
                  setValues((current) => ({ ...current, costPrice: parseMoneyInput(next) }))
                }
              />
            </label>
          )}

          <label className="inventory-field">
            <span>Precio de venta por {unitLabel}</span>
            <MoneyInput
              showCurrencyPrefix
              value={values.salePrice}
              required
              onChange={(next) =>
                setValues((current) => ({ ...current, salePrice: parseMoneyInput(next) }))
              }
            />
          </label>
        </div>

        {canViewCost && retailMargin !== null && (
          <div className="inventory-margin">
            Margen al detal: <strong>{retailMargin.toFixed(1)}%</strong> · Ganancia por {unitLabel}{' '}
            <strong>{formatBaseMoney(values.salePrice - values.costPrice)}</strong>
          </div>
        )}
      </div>

      {values.allowsBundle && !usesCategoryStock && (
        <div className="inventory-form-section">
          <h3>Precio al mayor</h3>
          <div className="inventory-form-grid">
            <label className="inventory-field">
              <span>Unidades al mayor ({unitLabel})</span>
              <input
                type="number"
                min="0.001"
                step="0.001"
                value={values.unitsPerBundle ?? 24}
                onChange={(event) =>
                  setValues((current) => ({
                    ...current,
                    unitsPerBundle: Number(event.target.value),
                  }))
                }
                placeholder="Ej. 24"
                required
              />
            </label>

            {canViewCost && (
              <label className="inventory-field">
                <span>Costo al mayor por {unitLabel}</span>
                <MoneyInput
                  showCurrencyPrefix
                  value={values.bundleCostPrice ?? 0}
                  min="0"
                  onChange={(next) =>
                    setValues((current) => ({
                      ...current,
                      bundleCostPrice: parseMoneyInput(next),
                    }))
                  }
                />
              </label>
            )}

            <label className="inventory-field">
              <span>Precio de venta al mayor por {unitLabel}</span>
              <MoneyInput
                showCurrencyPrefix
                value={values.bundleSalePrice ?? 0}
                required
                onChange={(next) =>
                  setValues((current) => ({
                    ...current,
                    bundleSalePrice: parseMoneyInput(next),
                  }))
                }
              />
            </label>
          </div>

          {values.unitsPerBundle && (
            <p className="inventory-hint">
              1 al mayor = {values.unitsPerBundle} {unitLabel}
            </p>
          )}

          {canViewCost && bundleMargin !== null && (
            <div className="inventory-margin">
              Margen al mayor: <strong>{bundleMargin.toFixed(1)}%</strong> · Ganancia por {unitLabel}{' '}
              <strong>
                {formatBaseMoney(
                  (values.bundleSalePrice ?? 0) - (values.bundleCostPrice ?? 0),
                )}
              </strong>{' '}
              · Por mayor <strong>
                {formatBaseMoney(
                  ((values.bundleSalePrice ?? 0) - (values.bundleCostPrice ?? 0)) *
                    (values.unitsPerBundle ?? 1),
                )}
              </strong>
            </div>
          )}
        </div>
      )}

      {values.soldBy === 'weight' && (
        <div className="inventory-form-section">
          <h3>Pérdida al vender</h3>
          <label className="inventory-field inventory-field-full">
            <span className="inventory-checkbox-label">
              <input
                type="checkbox"
                checked={values.hasSaleLoss}
                onChange={(event) => {
                  const checked = event.target.checked
                  setValues((current) => ({
                    ...current,
                    hasSaleLoss: checked,
                    saleLossPerUnit: checked ? current.saleLossPerUnit || 0.2 : 0,
                  }))
                }}
              />
              Este producto tiene pérdida al prepararlo
            </span>
          </label>

          {values.hasSaleLoss && (
            <div className="inventory-form-grid">
              <label className="inventory-field">
                <span>Pérdida por {unitLabel}</span>
                <input
                  type="number"
                  min="0"
                  step="0.001"
                  value={values.saleLossPerUnit}
                  onChange={(event) =>
                    setValues((current) => ({
                      ...current,
                      saleLossPerUnit: Number(event.target.value),
                    }))
                  }
                />
              </label>
              <div className="inventory-margin">
                Si vendes 1 {unitLabel}, el inventario descuenta{' '}
                <strong>{Number((1 + values.saleLossPerUnit).toFixed(3))} {unitLabel}</strong>.
              </div>
            </div>
          )}
        </div>
      )}

      <div className="inventory-form-section">
        <h3>Inventario</h3>
        {omitStockFields ? (
          <p className="inventory-hint">
            El stock inicial queda en 0. Esta entrada de mercancía lo sumará al guardar la factura.
          </p>
        ) : usesCategoryStock ? (
          <div className="inventory-margin">
            Este producto descuenta del stock de{' '}
            <strong>
              {linkedCategory?.name ?? 'la categoría'} ({linkedCategory?.stock ?? 0}{' '}
              {linkedCategory?.unitLabel ?? 'kg'})
            </strong>
            . Registra entradas en Inventario → Categorías.
          </div>
        ) : (
          <>
            <p className="inventory-hint">
              Los precios se guardan en {DEFAULT_BASE_CURRENCY_CODE}. En venta eliges la moneda y se
              convierte con la tasa del día. El stock se guarda siempre en {unitLabel}.
            </p>

            {values.allowsBundle && values.unitsPerBundle && values.unitsPerBundle > 0 && (
              <div className="inventory-stock-mode-toggle">
                <button
                  type="button"
                  className={stockInputMode === 'units' ? 'active' : undefined}
                  onClick={() => setStockInputMode('units')}
                >
                  Por {unitLabel}
                </button>
                <button
                  type="button"
                  className={stockInputMode === 'bundles' ? 'active' : undefined}
                  onClick={() => {
                    setStockBundles(stockBundlesFromUnits(values.stock, values.unitsPerBundle))
                    setStockInputMode('bundles')
                  }}
                >
                  Al mayor
                </button>
              </div>
            )}

            <div className="inventory-form-grid">
              {stockInputMode === 'bundles' && values.allowsBundle ? (
                <label className="inventory-field">
                  <span>Stock al mayor</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={stockBundles}
                    onChange={(event) => setStockBundles(Number(event.target.value))}
                    required
                  />
                  <p className="inventory-hint">
                    = {effectiveStock} {unitLabel} total (1 al mayor = {values.unitsPerBundle}{' '}
                    {unitLabel})
                  </p>
                </label>
              ) : (
                <label className="inventory-field">
                  <span>Stock ({unitLabel})</span>
                  <input
                    type="number"
                    min="0"
                    step={getStockInputStep(values.soldBy)}
                    value={values.stock}
                    onChange={(event) =>
                      setValues((current) => ({ ...current, stock: Number(event.target.value) }))
                    }
                    required
                  />
                </label>
              )}

              <label className="inventory-field">
                <span>Stock mínimo ({unitLabel})</span>
                <input
                  type="number"
                  min="0"
                  step={getStockInputStep(values.soldBy)}
                  value={values.minStock}
                  onChange={(event) =>
                    setValues((current) => ({ ...current, minStock: Number(event.target.value) }))
                  }
                  required
                />
              </label>
            </div>

            <div className="inventory-margin">
              Resumen: <strong>{stockSummary}</strong>
            </div>
          </>
        )}
      </div>

      <div className="inventory-form-actions">
        {onCancel && (
          <button type="button" className="inventory-btn inventory-btn-secondary" onClick={onCancel}>
            Cancelar
          </button>
        )}
        {secondaryLabel && onSecondarySubmit && (
          <button
            type="button"
            className="inventory-btn inventory-btn-secondary"
            disabled={submitting}
            onClick={() => onSecondarySubmit(buildSubmitValues())}
          >
            {submitting ? 'Guardando...' : secondaryLabel}
          </button>
        )}
        <button type="submit" className="inventory-btn inventory-btn-primary" disabled={submitting}>
          {submitting ? 'Guardando...' : submitLabel}
        </button>
      </div>
    </form>
  )
}
