export type MovementType = 'purchase' | 'adjustment' | 'waste' | 'return' | 'sale'

export type WasteReason =
  | 'expired'
  | 'spoiled'
  | 'preparation_error'
  | 'breakage'
  | 'sample'
  | 'other'

export interface InventoryMovement {
  id: string
  productId?: string
  stockCategoryId?: string
  productName: string
  type: MovementType
  quantity: number
  unitCost?: number
  lineCost?: number
  wasteReason?: WasteReason
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

export const wasteReasonLabels: Record<WasteReason, string> = {
  expired: 'Vencimiento',
  spoiled: 'Deterioro / mala conservación',
  preparation_error: 'Error de preparación',
  breakage: 'Rotura / daño',
  sample: 'Muestreo / degustación',
  other: 'Otro',
}

export interface CreateWasteInput {
  sourceType: 'product' | 'category'
  productId?: string
  stockCategoryId?: string
  /** Producto de la categoría que se perdió (solo trazabilidad; el costo es manual). */
  relatedProductId?: string
  /** Costo unitario manual (COP) al registrar merma de categoría compartida. */
  unitCost?: number
  quantity: number
  reason: WasteReason
  notes?: string
}
