import {
  doc,
  getDoc,
  getDocs,
  increment,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import { tenantCollectionRef, tenantDocumentRef } from '../lib/tenantFirestore'
import type {
  CreateCategoryLossInput,
  CreateCategoryMovementInput,
  StockCategory,
  StockCategoryFormInput,
} from '../types/stockCategory'
import { roundMoney } from '../utils/formatMoney'
import { computeWasteLineCost } from '../utils/wasteCost'

function mapTimestamp(value: unknown) {
  const typed = value as { toDate?: () => Date } | string | undefined
  if (typeof typed === 'object' && typed?.toDate) {
    return typed.toDate().toISOString()
  }
  if (typeof typed === 'string') return typed
  return undefined
}

function mapCategory(id: string, data: Record<string, unknown>): StockCategory {
  return {
    id,
    name: String(data.name ?? ''),
    unitLabel: String(data.unitLabel ?? 'kg'),
    costPrice: Number(data.costPrice ?? 0),
    stock: Number(data.stock ?? 0),
    minStock: Number(data.minStock ?? 0),
    active: data.active !== false,
    createdAt: mapTimestamp(data.createdAt),
    updatedAt: mapTimestamp(data.updatedAt),
  }
}

function resolveCategoryStockDelta(input: CreateCategoryMovementInput) {
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

export async function listStockCategories(): Promise<StockCategory[]> {
  const snapshot = await getDocs(tenantCollectionRef('stock_categories'))
  return snapshot.docs
    .map((item) => mapCategory(item.id, item.data()))
    .filter((category) => category.active)
    .sort((a, b) => a.name.localeCompare(b.name, 'es'))
}

export async function listAllStockCategories(): Promise<StockCategory[]> {
  const snapshot = await getDocs(tenantCollectionRef('stock_categories'))
  return snapshot.docs
    .map((item) => mapCategory(item.id, item.data()))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'))
}

export async function getStockCategoryById(id: string): Promise<StockCategory | null> {
  const snapshot = await getDoc(tenantDocumentRef('stock_categories', id))
  if (!snapshot.exists()) return null
  return mapCategory(snapshot.id, snapshot.data())
}

export async function createStockCategory(input: StockCategoryFormInput, userId: string) {
  if (!input.name.trim()) {
    throw new Error('El nombre de la categoría es obligatorio.')
  }

  if (input.stock < 0 || input.minStock < 0 || input.costPrice < 0) {
    throw new Error('El stock no puede ser negativo.')
  }

  const ref = doc(tenantCollectionRef('stock_categories'))
  await setDoc(ref, {
    name: input.name.trim(),
    unitLabel: input.unitLabel || 'kg',
    costPrice: input.costPrice,
    stock: input.stock,
    minStock: input.minStock,
    active: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdBy: userId,
  })

  return ref.id
}

export async function updateStockCategory(id: string, input: StockCategoryFormInput) {
  if (!input.name.trim()) {
    throw new Error('El nombre de la categoría es obligatorio.')
  }

  if (input.stock < 0 || input.minStock < 0 || input.costPrice < 0) {
    throw new Error('Los valores numéricos no pueden ser negativos.')
  }

  await updateDoc(tenantDocumentRef('stock_categories', id), {
    name: input.name.trim(),
    unitLabel: input.unitLabel || 'kg',
    costPrice: input.costPrice,
    stock: input.stock,
    minStock: input.minStock,
    updatedAt: serverTimestamp(),
  })
}

export async function setStockCategoryActive(id: string, active: boolean) {
  await updateDoc(tenantDocumentRef('stock_categories', id), {
    active,
    updatedAt: serverTimestamp(),
  })
}

export async function createCategoryMovement(
  input: CreateCategoryMovementInput,
  userId: string,
  userName: string,
) {
  const category = await getStockCategoryById(input.stockCategoryId)
  if (!category) {
    throw new Error('Categoría no encontrada.')
  }

  const stockDelta = resolveCategoryStockDelta(input)

  if (category.stock + stockDelta < 0) {
    throw new Error(
      `Stock insuficiente en ${category.name}. Disponible: ${category.stock} ${category.unitLabel}.`,
    )
  }

  const batch = writeBatch(db)
  const movementRef = doc(tenantCollectionRef('inventory_movements'))

  batch.set(movementRef, {
    productId: null,
    stockCategoryId: category.id,
    productName: category.name,
    type: input.type,
    quantity: stockDelta,
    notes: input.notes?.trim() || null,
    referenceType: null,
    referenceId: null,
    createdAt: serverTimestamp(),
    createdBy: userId,
    createdByName: userName,
  })

  batch.update(tenantDocumentRef('stock_categories', category.id), {
    stock: increment(stockDelta),
    updatedAt: serverTimestamp(),
  })

  await batch.commit()
  return movementRef.id
}

export async function createCategoryLoss(
  input: CreateCategoryLossInput,
  userId: string,
  userName: string,
) {
  if (input.quantity <= 0) {
    throw new Error('La cantidad perdida debe ser mayor a cero.')
  }

  const category = await getStockCategoryById(input.stockCategoryId)
  if (!category) {
    throw new Error('Categoría no encontrada.')
  }

  const stockDelta = -input.quantity
  if (category.stock + stockDelta < 0) {
    throw new Error(
      `Stock insuficiente en ${category.name}. Disponible: ${category.stock} ${category.unitLabel}.`,
    )
  }

  const unitCost = roundMoney(category.costPrice)
  const lineCost = computeWasteLineCost(stockDelta, unitCost)
  const batch = writeBatch(db)
  const movementRef = doc(tenantCollectionRef('inventory_movements'))

  batch.set(movementRef, {
    productId: null,
    stockCategoryId: category.id,
    productName: category.name,
    type: 'waste',
    quantity: stockDelta,
    unitCost,
    lineCost,
    wasteReason: 'other',
    notes: input.notes?.trim() || 'Pérdida registrada desde categoría',
    referenceType: 'category-loss',
    referenceId: category.id,
    createdAt: serverTimestamp(),
    createdBy: userId,
    createdByName: userName,
  })

  batch.update(tenantDocumentRef('stock_categories', category.id), {
    stock: increment(stockDelta),
    updatedAt: serverTimestamp(),
  })

  await batch.commit()
  return movementRef.id
}
