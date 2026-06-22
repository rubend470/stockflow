import type { InventoryMovement } from '../types/inventory'
import type { Product } from '../types/product'
import { roundMoney } from './formatMoney'

export function resolveCategoryUnitCost(categoryId: string, products: Product[]) {
  const linked = products.filter(
    (product) => product.stockCategoryId === categoryId && product.active !== false,
  )
  if (linked.length === 0) return 0

  const total = linked.reduce((sum, product) => sum + (product.costPrice ?? 0), 0)
  return roundMoney(total / linked.length)
}

export function computeWasteLineCost(quantity: number, unitCost: number) {
  return roundMoney(Math.abs(quantity) * unitCost)
}

export function getMovementWasteCost(
  movement: Pick<InventoryMovement, 'quantity' | 'unitCost' | 'lineCost'>,
) {
  if (movement.lineCost !== undefined && movement.lineCost > 0) {
    return movement.lineCost
  }

  if (movement.unitCost !== undefined && movement.unitCost > 0) {
    return computeWasteLineCost(movement.quantity, movement.unitCost)
  }

  return 0
}
