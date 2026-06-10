export interface StockCategory {
  id: string
  name: string
  unitLabel: string
  stock: number
  minStock: number
  active: boolean
  createdAt?: string
  updatedAt?: string
}

export interface StockCategoryFormInput {
  name: string
  unitLabel: string
  stock: number
  minStock: number
}

export interface CreateCategoryMovementInput {
  stockCategoryId: string
  type: 'purchase' | 'adjustment' | 'waste' | 'return'
  quantity: number
  notes?: string
}

export const emptyStockCategoryForm = (): StockCategoryFormInput => ({
  name: '',
  unitLabel: 'kg',
  stock: 0,
  minStock: 5,
})

export function getCategoryStockStatus(category: Pick<StockCategory, 'stock' | 'minStock'>) {
  if (category.stock <= 0) return 'out'
  if (category.stock <= category.minStock) return 'low'
  return 'ok'
}

export function getCategoryStockStatusLabel(status: ReturnType<typeof getCategoryStockStatus>) {
  if (status === 'out') return 'Agotado'
  if (status === 'low') return 'Stock bajo'
  return 'Disponible'
}
