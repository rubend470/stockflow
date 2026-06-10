export type MovementType = 'purchase' | 'adjustment' | 'waste' | 'return' | 'sale'

export interface InventoryMovement {
  id: string
  productId?: string
  stockCategoryId?: string
  productName: string
  type: MovementType
  quantity: number
  unitCost?: number
  notes?: string
  referenceType?: string
  referenceId?: string
  createdAt: string
  createdBy: string
  createdByName?: string
}

export type ManualMovementType = 'purchase' | 'adjustment' | 'waste' | 'return'

export interface CreateMovementInput {
  productId: string
  type: ManualMovementType
  quantity: number
  unitCost?: number
  notes?: string
}

export const movementTypeLabels: Record<MovementType, string> = {
  purchase: 'Entrada',
  adjustment: 'Ajuste',
  waste: 'Merma',
  return: 'Devolución',
  sale: 'Venta',
}
