import {
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import type { Business } from '../types/business'

function mapBusiness(id: string, data: Record<string, unknown>): Business {
  const createdAt = data.createdAt as { toDate?: () => Date } | string | undefined
  const updatedAt = data.updatedAt as { toDate?: () => Date } | string | undefined
  const toIso = (value: typeof createdAt) =>
    typeof value === 'object' && value?.toDate
      ? value.toDate().toISOString()
      : String(value ?? '')

  return {
    id,
    name: String(data.name ?? id),
    status: data.status === 'inactive' ? 'inactive' : 'active',
    createdAt: toIso(createdAt),
    updatedAt: updatedAt ? toIso(updatedAt) : undefined,
  }
}

export async function listBusinesses(): Promise<Business[]> {
  const snapshot = await getDocs(collection(db, 'businesses'))
  return snapshot.docs
    .map((item) => mapBusiness(item.id, item.data()))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'))
}

export async function listBusinessesById(ids: string[]): Promise<Business[]> {
  const uniqueIds = [...new Set(ids.filter(Boolean))]
  const snapshots = await Promise.all(uniqueIds.map((id) => getDoc(doc(db, 'businesses', id))))
  return snapshots
    .filter((snapshot) => snapshot.exists())
    .map((snapshot) => mapBusiness(snapshot.id, snapshot.data()))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'))
}

export async function createBusiness(id: string, name: string, creatorUserId: string) {
  const businessId = id.trim().toLowerCase()
  const businessName = name.trim()
  if (!/^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/.test(businessId)) {
    throw new Error('El identificador debe tener entre 3 y 64 caracteres, usando letras, números y guiones.')
  }
  if (!businessName) throw new Error('El nombre del comercio es obligatorio.')

  const businessRef = doc(db, 'businesses', businessId)
  if ((await getDoc(businessRef)).exists()) throw new Error('Ya existe una empresa con ese identificador.')

  const userRef = doc(db, 'users', creatorUserId)
  const userSnapshot = await getDoc(userRef)
  if (!userSnapshot.exists()) throw new Error('No se encontró el perfil del usuario actual.')

  const batch = writeBatch(db)
  batch.set(businessRef, {
    name: businessName,
    status: 'active',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdBy: creatorUserId,
  })
  batch.update(userRef, {
    businessIds: arrayUnion(businessId),
    currentBusinessId: userSnapshot.data().currentBusinessId ?? businessId,
    updatedAt: serverTimestamp(),
  })
  await batch.commit()
  return businessId
}

export async function setBusinessStatus(id: string, active: boolean) {
  await updateDoc(doc(db, 'businesses', id), {
    status: active ? 'active' : 'inactive',
    updatedAt: serverTimestamp(),
  })
}

export async function setUserBusinessMembership(
  userId: string,
  businessId: string,
  assigned: boolean,
) {
  const userRef = doc(db, 'users', userId)
  const snapshot = await getDoc(userRef)
  if (!snapshot.exists()) throw new Error('Usuario no encontrado.')

  const currentIds: string[] = Array.isArray(snapshot.data().businessIds)
    ? snapshot.data().businessIds.map(String)
    : []
  const businessIds = assigned
    ? [...new Set([...currentIds, businessId])]
    : currentIds.filter((id) => id !== businessId)
  const currentBusinessId = snapshot.data().currentBusinessId

  await updateDoc(userRef, {
    businessIds,
    currentBusinessId:
      currentBusinessId === businessId && !assigned
        ? (businessIds[0] ?? null)
        : (currentBusinessId ?? (assigned ? businessId : null)),
    updatedAt: serverTimestamp(),
  })
}

export async function switchCurrentBusiness(userId: string, businessId: string) {
  const userRef = doc(db, 'users', userId)
  const snapshot = await getDoc(userRef)
  if (!snapshot.exists()) throw new Error('Usuario no encontrado.')
  const businessIds = Array.isArray(snapshot.data().businessIds)
    ? snapshot.data().businessIds.map(String)
    : []
  if (!businessIds.includes(businessId)) throw new Error('No tienes acceso a esa empresa.')

  await setDoc(
    userRef,
    { currentBusinessId: businessId, updatedAt: serverTimestamp() },
    { merge: true },
  )
}
