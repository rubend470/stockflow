import type { Product } from '../../types/product'
import { formatProductPrices, formatStockSummary } from '../../utils/productUnits'

interface ProductCatalogProps {
  products: Product[]
  query: string
  onSelect: (product: Product) => void
}

export function ProductCatalog({ products, query, onSelect }: ProductCatalogProps) {
  const normalizedQuery = query.trim().toLowerCase()

  const filtered = products.filter((product) => {
    if (!normalizedQuery) return true

    return (
      product.name.toLowerCase().includes(normalizedQuery) ||
      product.barcode?.includes(normalizedQuery) ||
      product.sku?.toLowerCase().includes(normalizedQuery)
    )
  })

  if (filtered.length === 0) {
    return (
      <div className="pos-empty">
        <strong>Sin productos para mostrar</strong>
        <p>Agrega productos en Inventario o usa los datos de ejemplo si eres Super Admin.</p>
      </div>
    )
  }

  return (
    <div className="pos-catalog">
      {filtered.map((product) => (
        <button
          key={product.id}
          type="button"
          className={`pos-product-card ${product.stock <= 0 ? 'out-of-stock' : ''}`}
          onClick={() => onSelect(product)}
          disabled={product.stock <= 0}
        >
          <span className={`pos-product-type ${product.type}`}>
            {product.type === 'charcuteria' ? 'Charcutería' : 'Abasto'}
          </span>
          <strong>{product.name}</strong>
          <span className="pos-product-price">{formatProductPrices(product)}</span>
          <span className="pos-product-meta">
            {formatStockSummary(product)}
            {product.barcode ? ` · ${product.barcode}` : ''}
          </span>
        </button>
      ))}
    </div>
  )
}
