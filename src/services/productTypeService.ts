import {
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore'
import { tenantCollectionRef, tenantDocumentRef } from '../lib/tenantFirestore'
import {
  defaultProductTypes,
  type ProductTypeFormInput,
  type ProductTypeOption,
} from '../types/product'

function mapTimestamp(value: unknown) {
  const typed = value as { toDate?: () => Date } | string | undefined
  if (typeof typed === 'object' && typed?.toDate) return typed.toDate().toISOString()
  if (typeof typed === 'string') return typed
  return undefined
}

function mapProductType(id: string, data: Record<string, unknown>): ProductTypeOption {
  return {
    id,
    name: String(data.name ?? id),
    active: data.active !== false,
    createdAt: mapTimestamp(data.createdAt),
    updatedAt: mapTimestamp(data.updatedAt),
  }
}

function slugify(value: string) {
  return (
    value
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 40) || `tipo_${Date.now()}`
  )
}

export async function ensureDefaultProductTypes(userId: string) {
  const snapshot = await getDocs(tenantCollectionRef('product_types'))
  if (!snapshot.empty) return

  await Promise.all(
    defaultProductTypes.map((type) =>
      setDoc(tenantDocumentRef('product_types', type.id), {
        name: type.name,
        active: true,
        createdBy: userId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    ),
  )
}

export async function listProductTypes(): Promise<ProductTypeOption[]> {
  const snapshot = await getDocs(tenantCollectionRef('product_types'))
  const remote = snapshot.docs.map((item) => mapProductType(item.id, item.data()))
  const merged = new Map(defaultProductTypes.map((type) => [type.id, type]))
  remote.forEach((type) => merged.set(type.id, type))
  return [...merged.values()].sort(
    (a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name, 'es'),
  )
}

export async function createProductType(input: ProductTypeFormInput, userId: string) {
  const name = input.name.trim()
  if (!name) throw new Error('Ingresa el nombre del tipo de producto.')

  const id = slugify(name)
  const ref = tenantDocumentRef('product_types', id)
  await setDoc(ref, {
    name,
    active: input.active,
    createdBy: userId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return id
}

export async function updateProductType(id: string, input: ProductTypeFormInput) {
  const name = input.name.trim()
  if (!name) throw new Error('Ingresa el nombre del tipo de producto.')

  await updateDoc(tenantDocumentRef('product_types', id), {
    name,
    active: input.active,
    updatedAt: serverTimestamp(),
  })
}
