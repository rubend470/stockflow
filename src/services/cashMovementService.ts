import {
  addDoc,
  deleteDoc,
  getDocs,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore'
import { tenantCollectionRef, tenantDocumentRef } from '../lib/tenantFirestore'
import { DEFAULT_BASE_CURRENCY_CODE } from '../constants/currency'
import type {
  CashMovement,
  CashMovementFormInput,
  CashMovementType,
} from '../types/cashMovement'
import { parseMoneyInput, roundMoney } from '../utils/formatMoney'

function mapTimestamp(value: unknown) {
  const typed = value as { toDate?: () => Date } | string | undefined
  if (typeof typed === 'object' && typed?.toDate) {
    return typed.toDate().toISOString()
  }
  if (typeof typed === 'string') return typed
  return ''
}

function normalizeType(value: unknown): CashMovementType {
  if (value === 'opening' || value === 'in' || value === 'out') return value
  return 'in'
}

function mapCashMovement(id: string, data: Record<string, unknown>): CashMovement {
  return {
    id,
    type: normalizeType(data.type),
    description: String(data.description ?? ''),
    currencyCode: String(data.currencyCode ?? DEFAULT_BASE_CURRENCY_CODE).toUpperCase(),
    amount: Number(data.amount ?? data.amountInBase ?? 0),
    amountInBase: Number(data.amountInBase ?? data.amount ?? 0),
    methodId: String(data.methodId ?? ''),
    methodName: String(data.methodName ?? 'Caja'),
    reference: data.reference ? String(data.reference) : undefined,
    movementDate: String(data.movementDate ?? ''),
    notes: data.notes ? String(data.notes) : undefined,
    createdBy: String(data.createdBy ?? ''),
    createdByName: String(data.createdByName ?? ''),
    createdAt: mapTimestamp(data.createdAt),
    updatedAt: data.updatedAt ? mapTimestamp(data.updatedAt) : undefined,
  }
}

function assertValidCashMovementInput(input: CashMovementFormInput) {
  const description = input.description.trim()
  if (!description) {
    throw new Error('Ingresa una descripción del movimiento.')
  }

  const amount = parseMoneyInput(input.amount)
  if (amount <= 0) {
    throw new Error('Ingresa un monto mayor a cero.')
  }

  const currencyCode = input.currencyCode.trim().toUpperCase()
  if (!currencyCode) {
    throw new Error('Selecciona la moneda del movimiento.')
  }

  if (!input.methodId.trim() || !input.methodName?.trim()) {
    throw new Error('Selecciona la forma de pago del movimiento.')
  }

  if (!input.movementDate) {
    throw new Error('Selecciona la fecha del movimiento.')
  }

  if (!['opening', 'in', 'out'].includes(input.type)) {
    throw new Error('Selecciona un tipo de movimiento válido.')
  }

  return {
    description,
    amount,
    currencyCode,
    amountInBase: roundMoney(input.amountInBase ?? amount),
    methodId: input.methodId.trim(),
    methodName: input.methodName.trim(),
  }
}

export async function listCashMovements(): Promise<CashMovement[]> {
  const snapshot = await getDocs(tenantCollectionRef('cash_movements'))
  return snapshot.docs
    .map((item) => mapCashMovement(item.id, item.data()))
    .sort((a, b) => b.movementDate.localeCompare(a.movementDate) || b.createdAt.localeCompare(a.createdAt))
}

export async function listCashMovementsByDate(movementDate: string): Promise<CashMovement[]> {
  const movements = await listCashMovements()
  return movements.filter((movement) => movement.movementDate === movementDate)
}

export async function createCashMovement(
  input: CashMovementFormInput,
  user: { uid: string; name: string },
) {
  const { description, amount, currencyCode, amountInBase, methodId, methodName } =
    assertValidCashMovementInput(input)

  await addDoc(tenantCollectionRef('cash_movements'), {
    type: input.type,
    description,
    currencyCode,
    amount: roundMoney(amount),
    amountInBase,
    methodId,
    methodName,
    reference: input.reference.trim() || null,
    movementDate: input.movementDate,
    notes: input.notes.trim() || null,
    createdBy: user.uid,
    createdByName: user.name,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

export async function updateCashMovement(id: string, input: CashMovementFormInput) {
  const { description, amount, currencyCode, amountInBase, methodId, methodName } =
    assertValidCashMovementInput(input)

  await updateDoc(tenantDocumentRef('cash_movements', id), {
    type: input.type,
    description,
    currencyCode,
    amount: roundMoney(amount),
    amountInBase,
    methodId,
    methodName,
    reference: input.reference.trim() || null,
    movementDate: input.movementDate,
    notes: input.notes.trim() || null,
    updatedAt: serverTimestamp(),
  })
}

export async function deleteCashMovement(id: string) {
  await deleteDoc(tenantDocumentRef('cash_movements', id))
}
