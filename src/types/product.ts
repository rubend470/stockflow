export type ProductType = 'abasto' | 'charcuteria'
export type SoldBy = 'unit' | 'weight'
export type SaleMode = 'retail' | 'bundle'

export interface Product {
  id: string
  name: string
  barcode?: string
  sku?: string
  categoryId?: string
  stockCategoryId?: string
  type: ProductType
  soldBy: SoldBy
  unitLabel: string
  currencyCode: string
  allowsBundle: boolean
  unitsPerBundle?: number
  costPrice: number
  salePrice: number
  bundleCostPrice?: number
  bundleSalePrice?: number
  stock: number
  minStock: number
  active: boolean
  createdAt?: string
  updatedAt?: string
}

export interface ProductFormInput {
  name: string
  barcode?: string
  stockCategoryId?: string
  type: ProductType
  soldBy: SoldBy
  unitLabel: string
  allowsBundle: boolean
  unitsPerBundle?: number
  costPrice: number
  salePrice: number
  bundleCostPrice?: number
  bundleSalePrice?: number
  stock: number
  minStock: number
}

export interface CreateProductInput extends ProductFormInput {}

export interface UpdateProductInput extends ProductFormInput {}

export const emptyProductForm = (): ProductFormInput => ({
  name: '',
  barcode: '',
  stockCategoryId: '',
  type: 'abasto',
  soldBy: 'unit',
  unitLabel: 'und',
  allowsBundle: false,
  unitsPerBundle: 24,
  costPrice: 0,
  salePrice: 0,
  bundleCostPrice: 0,
  bundleSalePrice: 0,
  stock: 0,
  minStock: 5,
})

export function productFormFromProduct(product: Product): ProductFormInput {
  return {
    name: product.name,
    barcode: product.barcode ?? '',
    stockCategoryId: product.stockCategoryId ?? '',
    type: product.type,
    soldBy: product.soldBy,
    unitLabel: product.unitLabel,
    allowsBundle: product.allowsBundle,
    unitsPerBundle: product.unitsPerBundle ?? 24,
    costPrice: product.costPrice,
    salePrice: product.salePrice,
    bundleCostPrice: product.bundleCostPrice ?? 0,
    bundleSalePrice: product.bundleSalePrice ?? 0,
    stock: product.stock,
    minStock: product.minStock,
  }
}

export function getStockStatus(product: Pick<Product, 'stock' | 'minStock'>) {
  if (product.stock <= 0) return 'out'
  if (product.stock <= product.minStock) return 'low'
  return 'ok'
}

export function getStockStatusLabel(status: ReturnType<typeof getStockStatus>) {
  if (status === 'out') return 'Agotado'
  if (status === 'low') return 'Stock bajo'
  return 'Disponible'
}

export function getRetailUnitLabel(product: Pick<Product, 'soldBy' | 'unitLabel'>) {
  return product.unitLabel
}
