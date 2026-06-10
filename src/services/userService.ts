import {
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import type { AppUser, UserRole } from '../types/user'

function mapUserDoc(uid: string, data: Record<string, unknown>): AppUser {
  const createdAt = data.createdAt as { toDate?: () => Date } | string | undefined

  return {
    uid,
    name: String(data.name ?? ''),
    email: String(data.email ?? ''),
    role: (data.role as UserRole) ?? 'cashier',
    active: data.active !== false,
    createdAt:
      typeof createdAt === 'object' && createdAt?.toDate
        ? createdAt.toDate().toISOString()
        : String(createdAt ?? ''),
  }
}

export async function listUsers(): Promise<AppUser[]> {
  const snapshot = await getDocs(collection(db, 'users'))

  return snapshot.docs
    .map((item) => mapUserDoc(item.id, item.data()))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'))
}

export async function updateUserRole(uid: string, role: UserRole) {
  await updateDoc(doc(db, 'users', uid), { role })
}

export async function updateUserActive(uid: string, active: boolean) {
  await updateDoc(doc(db, 'users', uid), { active })
}

export async function getUserById(uid: string): Promise<AppUser | null> {
  const snapshot = await getDoc(doc(db, 'users', uid))
  if (!snapshot.exists()) return null
  return mapUserDoc(snapshot.id, snapshot.data())
}
