import {
  collection,
  doc,
  getDocs,
  increment,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import { getProductById, listAllProducts } from './productService'
import { getStockCategoryById } from './stockCategoryService'
import type {
  CreateMovementInput,
  CreateWasteInput,
  InventoryMovement,
  MovementType,
  WasteReason,
} from '../types/inventory'
import { wasteReasonLabels } from '../types/inventory'
import { computeWasteLineCost } from '../utils/wasteCost'
import { roundMoney } from '../utils/formatMoney'

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
    lineCost: data.lineCost !== undefined ? Number(data.lineCost) : undefined,
    wasteReason: data.wasteReason ? (data.wasteReason as WasteReason) : undefined,
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

export async function listWasteMovements(limit = 200): Promise<InventoryMovement[]> {
  const movements = await listMovements(limit * 2)
  return movements.filter((movement) => movement.type === 'waste').slice(0, limit)
}

function buildWasteNotes(reason: WasteReason, notes?: string) {
  const parts = [`Motivo: ${wasteReasonLabels[reason]}`]
  if (notes?.trim()) parts.push(notes.trim())
  return parts.join(' · ')
}

export async function createWaste(input: CreateWasteInput, userId: string, userName: string) {
  if (input.quantity <= 0) {
    throw new Error('La cantidad debe ser positiva.')
  }

  const notes = buildWasteNotes(input.reason, input.notes)

  if (input.sourceType === 'product') {
    if (!input.productId) throw new Error('Selecciona un producto.')
    const product = await getProductById(input.productId)
    if (!product) throw new Error('Producto no encontrado.')
    if (product.stockCategoryId) {
      throw new Error(
        'Este producto comparte stock con una categoría. Registra la merma en la categoría compartida.',
      )
    }
    return createMovement(
      { productId: input.productId, type: 'waste', quantity: input.quantity, notes },
      userId,
      userName,
      input.reason,
    )
  }

  if (!input.stockCategoryId) throw new Error('Selecciona una categoría de inventario.')

  const category = await getStockCategoryById(input.stockCategoryId)
  if (!category) throw new Error('Categoría no encontrada.')

  const allProducts = await listAllProducts()
  const linkedProducts = allProducts.filter(
    (product) => product.stockCategoryId === category.id && product.active !== false,
  )

  if (linkedProducts.length > 0 && !input.relatedProductId) {
    throw new Error('Selecciona el producto que se perdió.')
  }

  const unitCost =
    input.unitCost !== undefined ? roundMoney(input.unitCost) : 0
  if (unitCost <= 0) {
    throw new Error('Ingresa el costo unitario de la pérdida para esta categoría.')
  }

  let movementProductId: string | null = null
  let movementName = category.name

  if (input.relatedProductId) {
    const relatedProduct = await getProductById(input.relatedProductId)
    if (!relatedProduct) {
      throw new Error('Producto no encontrado.')
    }
    if (relatedProduct.stockCategoryId !== category.id) {
      throw new Error('El producto seleccionado no pertenece a esta categoría.')
    }
    movementProductId = relatedProduct.id
    movementName = `${category.name} — ${relatedProduct.name}`
  }

  const lineCost = computeWasteLineCost(input.quantity, unitCost)

  const stockDelta = -input.quantity
  if (category.stock + stockDelta < 0) {
    throw new Error(
      `Stock insuficiente en ${category.name}. Disponible: ${category.stock} ${category.unitLabel}.`,
    )
  }

  const batch = writeBatch(db)
  const movementRef = doc(collection(db, 'inventory_movements'))

  batch.set(movementRef, {
    productId: movementProductId,
    stockCategoryId: category.id,
    productName: movementName,
    type: 'waste',
    quantity: stockDelta,
    unitCost,
    lineCost,
    wasteReason: input.reason,
    notes: notes || null,
    referenceType: null,
    referenceId: null,
    createdAt: serverTimestamp(),
    createdBy: userId,
    createdByName: userName,
  })

  batch.update(doc(db, 'stock_categories', category.id), {
    stock: increment(stockDelta),
    updatedAt: serverTimestamp(),
  })

  await batch.commit()
  return movementRef.id
}

export async function createMovement(
  input: CreateMovementInput,
  userId: string,
  userName: string,
  wasteReason?: WasteReason,
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
  const unitCost = roundMoney(input.unitCost ?? product.costPrice)
  const lineCost =
    input.type === 'waste' ? computeWasteLineCost(stockDelta, unitCost) : undefined

  batch.set(movementRef, {
    productId: product.id,
    productName: product.name,
    type: input.type,
    quantity: stockDelta,
    unitCost,
    lineCost: lineCost && lineCost > 0 ? lineCost : null,
    wasteReason: input.type === 'waste' ? wasteReason ?? null : null,
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
