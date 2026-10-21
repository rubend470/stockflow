export type CashMovementType = 'opening' | 'in' | 'out'

export interface CashMovement {
  id: string
  type: CashMovementType
  description: string
  currencyCode: string
  amount: number
  amountInBase: number
  methodId: string
  methodName: string
  reference?: string
  movementDate: string
  notes?: string
  createdBy: string
  createdByName: string
  createdAt: string
  updatedAt?: string
}

export interface CashMovementFormInput {
  type: CashMovementType
  description: string
  amount: string
  currencyCode: string
  amountInBase?: number
  methodId: string
  methodName?: string
  reference: string
  movementDate: string
  notes: string
}

function dateInputValue(reference = new Date()) {
  const year = reference.getFullYear()
  const month = String(reference.getMonth() + 1).padStart(2, '0')
  const day = String(reference.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function emptyCashMovementForm(
  type: CashMovementType = 'in',
  today = new Date(),
): CashMovementFormInput {
  return {
    type,
    description: type === 'opening' ? 'Base inicial de caja' : '',
    amount: '',
    currencyCode: 'COP',
    methodId: '',
    reference: '',
    movementDate: dateInputValue(today),
    notes: '',
  }
}

export function cashMovementFormFromMovement(movement: CashMovement): CashMovementFormInput {
  return {
    type: movement.type,
    description: movement.description,
    amount: String(movement.amount),
    currencyCode: movement.currencyCode,
    amountInBase: movement.amountInBase,
    methodId: movement.methodId,
    methodName: movement.methodName,
    reference: movement.reference ?? '',
    movementDate: movement.movementDate,
    notes: movement.notes ?? '',
  }
}

export const cashMovementTypeLabels: Record<CashMovementType, string> = {
  opening: 'Base inicial',
  in: 'Entrada',
  out: 'Salida',
}
