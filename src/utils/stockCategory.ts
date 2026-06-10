import type { Product } from '../types/product'
import type { StockCategory } from '../types/stockCategory'

export function getCategoryMap(categories: StockCategory[]) {
  return new Map(categories.map((category) => [category.id, category]))
}

export function getEffectiveStock(
  product: Pick<Product, 'stock' | 'stockCategoryId'>,
  categoryMap: Map<string, StockCategory>,
) {
  if (!product.stockCategoryId) return product.stock
  return categoryMap.get(product.stockCategoryId)?.stock ?? 0
}

export function enrichProductWithCategoryStock(
  product: Product,
  categoryMap: Map<string, StockCategory>,
): Product {
  if (!product.stockCategoryId) return product

  const category = categoryMap.get(product.stockCategoryId)
  return {
    ...product,
    stock: category?.stock ?? 0,
    minStock: category?.minStock ?? product.minStock,
  }
}

export function enrichProductsWithCategoryStock(
  products: Product[],
  categories: StockCategory[],
) {
  const categoryMap = getCategoryMap(categories)
  return products.map((product) => enrichProductWithCategoryStock(product, categoryMap))
}
