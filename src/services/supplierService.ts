import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import type { Supplier, SupplierFormInput } from '../types/supplier'

function mapSupplier(id: string, data: Record<string, unknown>): Supplier {
  const createdAt = data.createdAt as { toDate?: () => Date } | string | undefined
  const updatedAt = data.updatedAt as { toDate?: () => Date } | string | undefined

  return {
    id,
    name: String(data.name ?? ''),
    phone: data.phone ? String(data.phone) : undefined,
    email: data.email ? String(data.email) : undefined,
    taxId: data.taxId ? String(data.taxId) : undefined,
    notes: data.notes ? String(data.notes) : undefined,
    active: data.active !== false,
    createdAt:
      typeof createdAt === 'object' && createdAt?.toDate
        ? createdAt.toDate().toISOString()
        : typeof createdAt === 'string'
          ? createdAt
          : new Date().toISOString(),
    updatedAt:
      typeof updatedAt === 'object' && updatedAt?.toDate
        ? updatedAt.toDate().toISOString()
        : typeof updatedAt === 'string'
          ? updatedAt
          : undefined,
  }
}

export async function listSuppliers(): Promise<Supplier[]> {
  const snapshot = await getDocs(collection(db, 'suppliers'))
  return snapshot.docs
    .map((item) => mapSupplier(item.id, item.data()))
    .filter((supplier) => supplier.active)
    .sort((a, b) => a.name.localeCompare(b.name, 'es'))
}

export async function listAllSuppliers(): Promise<Supplier[]> {
  const snapshot = await getDocs(collection(db, 'suppliers'))
  return snapshot.docs
    .map((item) => mapSupplier(item.id, item.data()))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'))
}

export async function getSupplierById(id: string): Promise<Supplier | null> {
  const snapshot = await getDoc(doc(db, 'suppliers', id))
  if (!snapshot.exists()) return null
  return mapSupplier(snapshot.id, snapshot.data())
}

export async function findSupplierByName(name: string, suppliers?: Supplier[]): Promise<Supplier | null> {
  const trimmed = name.trim().toLowerCase()
  if (!trimmed) return null

  const source = suppliers ?? (await listSuppliers())
  return source.find((supplier) => supplier.name.toLowerCase() === trimmed) ?? null
}

export async function createSupplier(input: SupplierFormInput) {
  if (!input.name.trim()) {
    throw new Error('El nombre del proveedor es obligatorio.')
  }

  const ref = doc(collection(db, 'suppliers'))
  await setDoc(ref, {
    name: input.name.trim(),
    phone: input.phone.trim() || null,
    email: input.email.trim() || null,
    taxId: input.taxId.trim() || null,
    notes: input.notes.trim() || null,
    active: input.active,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })

  return ref.id
}

export async function updateSupplier(id: string, input: SupplierFormInput) {
  if (!input.name.trim()) {
    throw new Error('El nombre del proveedor es obligatorio.')
  }

  await updateDoc(doc(db, 'suppliers', id), {
    name: input.name.trim(),
    phone: input.phone.trim() || null,
    email: input.email.trim() || null,
    taxId: input.taxId.trim() || null,
    notes: input.notes.trim() || null,
    active: input.active,
    updatedAt: serverTimestamp(),
  })
}

export async function deleteSupplier(id: string) {
  await deleteDoc(doc(db, 'suppliers', id))
}

export async function findOrCreateSupplierByName(
  name: string,
  suppliers?: Supplier[],
): Promise<Supplier> {
  const trimmed = name.trim()
  if (!trimmed) {
    throw new Error('El proveedor es obligatorio.')
  }

  const existing = await findSupplierByName(trimmed, suppliers)
  if (existing) return existing

  const id = await createSupplier({
    name: trimmed,
    phone: '',
    email: '',
    taxId: '',
    notes: '',
    active: true,
  })

  const created = await getSupplierById(id)
  if (!created) {
    throw new Error('No se pudo registrar el proveedor.')
  }

  return created
}
