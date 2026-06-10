import { useEffect, useMemo, useRef } from 'react'
import type { Product } from '../../types/product'
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
  const query = value.trim().toLowerCase()

  const suggestions = useMemo(() => {
    if (!query) return []

    return products
      .filter(
        (product) =>
          product.name.toLowerCase().includes(query) ||
          product.barcode?.includes(query) ||
          product.sku?.toLowerCase().includes(query),
      )
      .slice(0, 8)
  }, [products, query])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  return (
    <div className="pos-search-inner">
      <label htmlFor="pos-barcode">Código o nombre del producto</label>
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
        Escanea el código y presiona Enter, o elige un producto de la lista.
      </p>
    </div>
  )
}
