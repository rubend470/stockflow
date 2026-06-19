import { useEffect, useMemo, useRef } from 'react'
import type { Product } from '../../types/product'
import { barcodeMatches, isLikelyBarcode, normalizeBarcode } from '../../utils/barcode'
import { formatProductPrices } from '../../utils/productUnits'

interface ProductSearchFieldProps {
  value: string
  products: Product[]
  loading?: boolean
  onChange: (value: string) => void
  onSubmit: () => void
  onSelectProduct: (product: Product) => void
}

export function ProductSearchField({
  value,
  products,
  loading,
  onChange,
  onSubmit,
  onSelectProduct,
}: ProductSearchFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const lastAutoSelectedBarcodeRef = useRef('')
  const query = value.trim().toLowerCase()
  const barcodeQuery = normalizeBarcode(value)

  const exactBarcodeProduct = useMemo(() => {
    if (!isLikelyBarcode(barcodeQuery)) return undefined
    return products.find((product) => barcodeMatches(product.barcode, barcodeQuery))
  }, [products, barcodeQuery])

  const suggestions = useMemo(() => {
    if (!query) return []

    return products
      .filter(
        (product) =>
          product.name.toLowerCase().includes(query) ||
          normalizeBarcode(product.barcode).toLowerCase().includes(query) ||
          product.sku?.toLowerCase().includes(query),
      )
      .slice(0, 8)
  }, [products, query])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    if (!exactBarcodeProduct || exactBarcodeProduct.stock <= 0) return
    if (lastAutoSelectedBarcodeRef.current === barcodeQuery) return

    const timeoutId = window.setTimeout(() => {
      lastAutoSelectedBarcodeRef.current = barcodeQuery
      onSelectProduct(exactBarcodeProduct)
    }, 120)

    return () => window.clearTimeout(timeoutId)
  }, [barcodeQuery, exactBarcodeProduct, onSelectProduct])

  useEffect(() => {
    if (!barcodeQuery) {
      lastAutoSelectedBarcodeRef.current = ''
    }
  }, [barcodeQuery])

  return (
    <div className="pos-search-inner">
      <div className="pos-search-label-row">
        <label htmlFor="pos-barcode">Código o nombre del producto</label>
        <span className={exactBarcodeProduct ? 'pos-scan-badge ready' : 'pos-scan-badge'}>
          {exactBarcodeProduct ? 'Código encontrado' : 'Lector activo'}
        </span>
      </div>
      <div className="pos-search-row">
        <div className="pos-autocomplete">
          <input
            id="pos-barcode"
            ref={inputRef}
            type="text"
            value={value}
            placeholder="Escanea código o escribe nombre..."
            autoComplete="off"
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                if (exactBarcodeProduct) {
                  onSelectProduct(exactBarcodeProduct)
                  return
                }
                if (suggestions.length === 1) {
                  onSelectProduct(suggestions[0])
                  return
                }
                onSubmit()
              }
            }}
          />
        </div>

        <button type="button" className="pos-btn pos-btn-primary" onClick={onSubmit} disabled={loading}>
          Agregar
        </button>
      </div>

      {suggestions.length > 0 && (
        <ul className="pos-autocomplete-list pos-autocomplete-list-below">
          {suggestions.map((product) => (
            <li key={product.id}>
              <button
                type="button"
                className="pos-autocomplete-item"
                onClick={() => onSelectProduct(product)}
                disabled={product.stock <= 0}
              >
                <span>
                  <strong>{product.name}</strong>
                  <small>
                    {formatProductPrices(product)}
                    {product.barcode ? ` · ${product.barcode}` : ''}
                  </small>
                </span>
                <span className={product.stock <= 0 ? 'pos-stock-out' : undefined}>
                  {product.stock <= 0 ? 'Agotado' : `${product.stock} ${product.unitLabel}`}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="pos-search-hint">
        Escanea el código; si coincide con un producto se agregará automáticamente. También puedes
        presionar Enter o elegirlo de la lista.
      </p>
    </div>
  )
}
