import {
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore'
import { DEFAULT_BASE_CURRENCY_CODE } from '../constants/currency'
import { db } from '../lib/firebase'
import { tenantCollectionRef, tenantDocumentRef } from '../lib/tenantFirestore'
import { normalizeBarcode } from '../utils/barcode'
import { roundMoney } from '../utils/formatMoney'
import type { CreateProductInput, Product, UpdateProductInput } from '../types/product'
import { normalizeLegacyProduct, normalizeProductInput } from '../utils/productUnits'

function mapProduct(id: string, data: Record<string, unknown>): Product {
  const createdAt = data.createdAt as { toDate?: () => Date } | string | undefined
  const updatedAt = data.updatedAt as { toDate?: () => Date } | string | undefined
  const legacy = normalizeLegacyProduct(data)

  return {
    id,
    name: String(data.name ?? ''),
    barcode: data.barcode ? String(data.barcode) : undefined,
    sku: data.sku ? String(data.sku) : undefined,
    categoryId: data.categoryId ? String(data.categoryId) : undefined,
    stockCategoryId: data.stockCategoryId ? String(data.stockCategoryId) : undefined,
    type: (data.type as Product['type']) ?? 'abasto',
    soldBy: legacy.soldBy ?? ((data.soldBy as Product['soldBy']) ?? 'unit'),
    unitLabel: legacy.unitLabel ?? String(data.unitLabel ?? 'und'),
    currencyCode: String(data.currencyCode ?? DEFAULT_BASE_CURRENCY_CODE).toUpperCase(),
    allowsBundle: legacy.allowsBundle ?? data.allowsBundle === true,
    unitsPerBundle: legacy.unitsPerBundle ?? (data.unitsPerBundle ? Number(data.unitsPerBundle) : undefined),
    costPrice: legacy.costPrice ?? Number(data.costPrice ?? 0),
    salePrice: legacy.salePrice ?? Number(data.salePrice ?? 0),
    bundleCostPrice:
      legacy.bundleCostPrice ?? (data.bundleCostPrice ? Number(data.bundleCostPrice) : undefined),
    bundleSalePrice:
      legacy.bundleSalePrice ?? (data.bundleSalePrice ? Number(data.bundleSalePrice) : undefined),
    hasSaleLoss: data.hasSaleLoss === true,
    saleLossPerUnit: Number(data.saleLossPerUnit ?? 0),
    stock: Number(data.stock ?? 0),
    minStock: Number(data.minStock ?? 0),
    active: data.active !== false,
    createdAt:
      typeof createdAt === 'object' && createdAt?.toDate
        ? createdAt.toDate().toISOString()
        : typeof createdAt === 'string'
          ? createdAt
          : undefined,
    updatedAt:
      typeof updatedAt === 'object' && updatedAt?.toDate
        ? updatedAt.toDate().toISOString()
        : typeof updatedAt === 'string'
          ? updatedAt
          : undefined,
  }
}

export async function listProducts(): Promise<Product[]> {
  const snapshot = await getDocs(tenantCollectionRef('products'))
  return snapshot.docs
    .map((item) => mapProduct(item.id, item.data()))
    .filter((product) => product.active)
    .sort((a, b) => a.name.localeCompare(b.name, 'es'))
}

export async function listAllProducts(): Promise<Product[]> {
  const snapshot = await getDocs(tenantCollectionRef('products'))
  return snapshot.docs
    .map((item) => mapProduct(item.id, item.data()))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'))
}

export async function getProductById(id: string): Promise<Product | null> {
  const snapshot = await getDoc(tenantDocumentRef('products', id))
  if (!snapshot.exists()) return null
  return mapProduct(snapshot.id, snapshot.data())
}

async function isBarcodeTaken(barcode: string, excludeId?: string) {
  const trimmed = normalizeBarcode(barcode)
  if (!trimmed) return false

  const snapshot = await getDocs(
    query(tenantCollectionRef('products'), where('barcode', '==', trimmed)),
  )

  return snapshot.docs.some((item) => item.id !== excludeId)
}

export async function createProduct(input: CreateProductInput, userId: string) {
  if (!input.name.trim()) {
    throw new Error('El nombre del producto es obligatorio.')
  }

  if (input.salePrice < 0 || input.costPrice < 0 || input.stock < 0 || input.minStock < 0) {
    throw new Error('Los valores numéricos no pueden ser negativos.')
  }

  if (input.stockCategoryId?.trim() && input.salePrice <= 0) {
    throw new Error('Indica el precio de venta del producto derivado.')
  }

  if (input.barcode?.trim() && (await isBarcodeTaken(input.barcode))) {
    throw new Error('Ya existe un producto con ese código de barras.')
  }

  const normalized = normalizeProductInput(input)
  const prices = {
    costPrice: roundMoney(normalized.costPrice),
    salePrice: roundMoney(normalized.salePrice),
    bundleCostPrice:
      normalized.bundleCostPrice !== null && normalized.bundleCostPrice !== undefined
        ? roundMoney(normalized.bundleCostPrice)
        : normalized.bundleCostPrice,
    bundleSalePrice:
      normalized.bundleSalePrice !== null && normalized.bundleSalePrice !== undefined
        ? roundMoney(normalized.bundleSalePrice)
        : normalized.bundleSalePrice,
  }
  const ref = doc(tenantCollectionRef('products'))
  await setDoc(ref, {
    name: normalized.name.trim(),
    barcode: normalized.barcode?.trim() || null,
    stockCategoryId: normalized.stockCategoryId?.trim() || null,
    type: normalized.type,
    soldBy: normalized.soldBy,
    unitLabel: normalized.unitLabel,
    currencyCode: DEFAULT_BASE_CURRENCY_CODE,
    allowsBundle: normalized.allowsBundle,
    unitsPerBundle: normalized.unitsPerBundle,
    costPrice: prices.costPrice,
    salePrice: prices.salePrice,
    bundleCostPrice: prices.bundleCostPrice,
    bundleSalePrice: prices.bundleSalePrice,
    hasSaleLoss: normalized.hasSaleLoss === true,
    saleLossPerUnit: Number(normalized.saleLossPerUnit ?? 0),
    stock: normalized.stock,
    minStock: normalized.minStock,
    active: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdBy: userId,
  })

  return ref.id
}

export async function updateProduct(id: string, input: UpdateProductInput) {
  if (!input.name.trim()) {
    throw new Error('El nombre del producto es obligatorio.')
  }

  if (input.salePrice < 0 || input.costPrice < 0 || input.stock < 0 || input.minStock < 0) {
    throw new Error('Los valores numéricos no pueden ser negativos.')
  }

  if (input.stockCategoryId?.trim() && input.salePrice <= 0) {
    throw new Error('Indica el precio de venta del producto derivado.')
  }

  if (input.barcode?.trim() && (await isBarcodeTaken(input.barcode, id))) {
    throw new Error('Ya existe un producto con ese código de barras.')
  }

  const normalized = normalizeProductInput(input)
  const prices = {
    costPrice: roundMoney(normalized.costPrice),
    salePrice: roundMoney(normalized.salePrice),
    bundleCostPrice:
      normalized.bundleCostPrice !== null && normalized.bundleCostPrice !== undefined
        ? roundMoney(normalized.bundleCostPrice)
        : normalized.bundleCostPrice,
    bundleSalePrice:
      normalized.bundleSalePrice !== null && normalized.bundleSalePrice !== undefined
        ? roundMoney(normalized.bundleSalePrice)
        : normalized.bundleSalePrice,
  }

  await updateDoc(tenantDocumentRef('products', id), {
    name: normalized.name.trim(),
    barcode: normalized.barcode?.trim() || null,
    stockCategoryId: normalized.stockCategoryId?.trim() || null,
    type: normalized.type,
    soldBy: normalized.soldBy,
    unitLabel: normalized.unitLabel,
    currencyCode: DEFAULT_BASE_CURRENCY_CODE,
    allowsBundle: normalized.allowsBundle,
    unitsPerBundle: normalized.unitsPerBundle,
    costPrice: prices.costPrice,
    salePrice: prices.salePrice,
    bundleCostPrice: prices.bundleCostPrice,
    bundleSalePrice: prices.bundleSalePrice,
    hasSaleLoss: normalized.hasSaleLoss === true,
    saleLossPerUnit: Number(normalized.saleLossPerUnit ?? 0),
    stock: normalized.stock,
    minStock: normalized.minStock,
    updatedAt: serverTimestamp(),
  })
}

export async function setProductActive(id: string, active: boolean) {
  await updateDoc(tenantDocumentRef('products', id), {
    active,
    updatedAt: serverTimestamp(),
  })
}

export async function deleteProduct(id: string) {
  await deleteDoc(tenantDocumentRef('products', id))
}

export async function findProductByBarcode(barcode: string): Promise<Product | null> {
  const trimmed = normalizeBarcode(barcode)
  if (!trimmed) return null

  const snapshot = await getDocs(
    query(tenantCollectionRef('products'), where('barcode', '==', trimmed)),
  )

  if (snapshot.empty) return null

  const docItem = snapshot.docs.find((item) => item.data().active !== false)
  if (!docItem) return null
  return mapProduct(docItem.id, docItem.data())
}

export async function seedSampleProducts(userId: string) {
  const snapshot = await getDocs(tenantCollectionRef('products'))
  if (!snapshot.empty) return

  const samples: CreateProductInput[] = [
    {
      name: 'Arroz Premium 1kg',
      barcode: '1001',
      type: 'abasto',
      soldBy: 'unit',
      unitLabel: 'und',
      allowsBundle: false,
      costPrice: 4200,
      salePrice: 5800,
      hasSaleLoss: false,
      saleLossPerUnit: 0,
      stock: 50,
      minStock: 5,
    },
    {
      name: 'Aceite Vegetal 1L',
      barcode: '1002',
      type: 'abasto',
      soldBy: 'unit',
      unitLabel: 'und',
      allowsBundle: false,
      costPrice: 9800,
      salePrice: 13500,
      hasSaleLoss: false,
      saleLossPerUnit: 0,
      stock: 30,
      minStock: 5,
    },
    {
      name: 'Harina PAN 1kg',
      barcode: '1003',
      type: 'abasto',
      soldBy: 'unit',
      unitLabel: 'und',
      allowsBundle: false,
      costPrice: 3800,
      salePrice: 5200,
      hasSaleLoss: false,
      saleLossPerUnit: 0,
      stock: 40,
      minStock: 5,
    },
    {
      name: 'Queso Amarillo',
      barcode: '2001',
      type: 'charcuteria',
      soldBy: 'weight',
      unitLabel: 'kg',
      allowsBundle: false,
      costPrice: 28000,
      salePrice: 36000,
      hasSaleLoss: false,
      saleLossPerUnit: 0,
      stock: 25,
      minStock: 5,
    },
    {
      name: 'Arroz por Bulto 24kg',
      barcode: '1004',
      type: 'abasto',
      soldBy: 'weight',
      unitLabel: 'kg',
      allowsBundle: true,
      unitsPerBundle: 24,
      costPrice: 4200,
      salePrice: 5800,
      bundleCostPrice: 100800,
      bundleSalePrice: 139200,
      hasSaleLoss: false,
      saleLossPerUnit: 0,
      stock: 120,
      minStock: 24,
    },
    {
      name: 'Jamón Cocido',
      barcode: '2002',
      type: 'charcuteria',
      soldBy: 'weight',
      unitLabel: 'kg',
      allowsBundle: false,
      costPrice: 32000,
      salePrice: 42000,
      hasSaleLoss: false,
      saleLossPerUnit: 0,
      stock: 18,
      minStock: 5,
    },
  ]

  const batch = writeBatch(db)

  samples.forEach((product) => {
    const ref = doc(tenantCollectionRef('products'))
    const normalized = normalizeProductInput({ ...product, minStock: product.minStock ?? 5 })
    batch.set(ref, {
      name: normalized.name,
      barcode: normalized.barcode || null,
      type: normalized.type,
      soldBy: normalized.soldBy,
      unitLabel: normalized.unitLabel,
      currencyCode: DEFAULT_BASE_CURRENCY_CODE,
      allowsBundle: normalized.allowsBundle,
      unitsPerBundle: normalized.unitsPerBundle,
      costPrice: normalized.costPrice,
      salePrice: normalized.salePrice,
      bundleCostPrice: normalized.bundleCostPrice,
      bundleSalePrice: normalized.bundleSalePrice,
      stock: normalized.stock,
      minStock: normalized.minStock,
      active: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdBy: userId,
    })
  })

  await batch.commit()
}
