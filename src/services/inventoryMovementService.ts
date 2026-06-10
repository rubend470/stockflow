import {
  collection,
  doc,
  getDocs,
  increment,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import { getProductById } from './productService'
import type { CreateMovementInput, InventoryMovement, MovementType } from '../types/inventory'

function mapMovement(id: string, data: Record<string, unknown>): InventoryMovement {
  const createdAt = data.createdAt as { toDate?: () => Date } | string | undefined

  return {
    id,
    productId: data.productId ? String(data.productId) : undefined,
    stockCategoryId: data.stockCategoryId ? String(data.stockCategoryId) : undefined,
    productName: String(data.productName ?? ''),
    type: (data.type as MovementType) ?? 'adjustment',
    quantity: Number(data.quantity ?? 0),
    unitCost: data.unitCost !== undefined ? Number(data.unitCost) : undefined,
    notes: data.notes ? String(data.notes) : undefined,
    referenceType: data.referenceType ? String(data.referenceType) : undefined,
    referenceId: data.referenceId ? String(data.referenceId) : undefined,
    createdAt:
      typeof createdAt === 'object' && createdAt?.toDate
        ? createdAt.toDate().toISOString()
        : typeof createdAt === 'string'
          ? createdAt
          : new Date().toISOString(),
    createdBy: String(data.createdBy ?? ''),
    createdByName: data.createdByName ? String(data.createdByName) : undefined,
  }
}

function resolveStockDelta(input: CreateMovementInput) {
  if (input.quantity === 0) {
    throw new Error('La cantidad no puede ser cero.')
  }

  if (input.type === 'purchase' || input.type === 'return') {
    if (input.quantity <= 0) throw new Error('La cantidad debe ser positiva.')
    return input.quantity
  }

  if (input.type === 'waste') {
    if (input.quantity <= 0) throw new Error('La cantidad debe ser positiva.')
    return -input.quantity
  }

  return input.quantity
}

export async function listMovements(limit = 200): Promise<InventoryMovement[]> {
  const snapshot = await getDocs(collection(db, 'inventory_movements'))

  return snapshot.docs
    .map((item) => mapMovement(item.id, item.data()))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit)
}

export async function createMovement(
  input: CreateMovementInput,
  userId: string,
  userName: string,
) {
  const product = await getProductById(input.productId)
  if (!product) {
    throw new Error('Producto no encontrado.')
  }

  const stockDelta = resolveStockDelta(input)

  if (product.stock + stockDelta < 0) {
    throw new Error(`Stock insuficiente. Disponible: ${product.stock} ${product.unitLabel}.`)
  }

  const batch = writeBatch(db)
  const movementRef = doc(collection(db, 'inventory_movements'))

  batch.set(movementRef, {
    productId: product.id,
    productName: product.name,
    type: input.type,
    quantity: stockDelta,
    unitCost: input.unitCost ?? product.costPrice,
    notes: input.notes?.trim() || null,
    referenceType: null,
    referenceId: null,
    createdAt: serverTimestamp(),
    createdBy: userId,
    createdByName: userName,
  })

  batch.update(doc(db, 'products', product.id), {
    stock: increment(stockDelta),
    updatedAt: serverTimestamp(),
  })

  await batch.commit()
  return movementRef.id
}
