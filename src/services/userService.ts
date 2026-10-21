import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  updateDoc,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import type { AppUser, UserPresence, UserRole } from '../types/user'
import { normalizeMenuPermissions } from '../utils/menuPermissions'

export interface UpdateUserInput {
  name: string
  role: UserRole
  active: boolean
  menuPermissions: string[]
}

function mapMenuPermissions(data: Record<string, unknown>): string[] | undefined {
  if (!Array.isArray(data.menuPermissions)) return undefined
  return normalizeMenuPermissions(data.menuPermissions.map(String))
}

function mapTimestamp(value: unknown) {
  const typed = value as { toDate?: () => Date } | string | undefined
  if (typeof typed === 'object' && typed?.toDate) {
    return typed.toDate().toISOString()
  }
  if (typeof typed === 'string') return typed
  return ''
}

function mapPresence(data: Record<string, unknown>): UserPresence | undefined {
  if (!data.presence || typeof data.presence !== 'object') return undefined

  const presence = data.presence as Record<string, unknown>
  const lastSeenAt = mapTimestamp(presence.lastSeenAt)

  return {
    state: presence.state === 'offline' ? 'offline' : 'online',
    lastSeenAt,
    activePath: presence.activePath ? String(presence.activePath) : undefined,
  }
}

function mapUserDoc(uid: string, data: Record<string, unknown>): AppUser {
  const createdAt = data.createdAt as { toDate?: () => Date } | string | undefined

  return {
    uid,
    name: String(data.name ?? ''),
    email: String(data.email ?? ''),
    role: (data.role as UserRole) ?? 'cashier',
    active: data.active !== false,
    menuPermissions: mapMenuPermissions(data),
    businessIds: Array.isArray(data.businessIds) ? data.businessIds.map(String) : undefined,
    currentBusinessId: data.currentBusinessId ? String(data.currentBusinessId) : undefined,
    presence: mapPresence(data),
    createdAt:
      typeof createdAt === 'object' && createdAt?.toDate
        ? createdAt.toDate().toISOString()
        : String(createdAt ?? ''),
  }
}

export async function listUsers(): Promise<AppUser[]> {
  const snapshot = await getDocs(collection(db, 'users'))

  return snapshot.docs
    .map((item) => mapUserDoc(item.id, item.data({ serverTimestamps: 'estimate' })))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'))
}

export function subscribeToUsers(
  onUsers: (users: AppUser[]) => void,
  onError: () => void,
): Unsubscribe {
  return onSnapshot(
    collection(db, 'users'),
    (snapshot) => {
      const users = snapshot.docs
        .map((item) => mapUserDoc(item.id, item.data({ serverTimestamps: 'estimate' })))
        .sort((a, b) => a.name.localeCompare(b.name, 'es'))

      onUsers(users)
    },
    onError,
  )
}

export async function updateUserRole(uid: string, role: UserRole) {
  await updateDoc(doc(db, 'users', uid), { role })
}

export async function updateUserActive(uid: string, active: boolean) {
  await updateDoc(doc(db, 'users', uid), { active })
}

export async function updateUser(uid: string, input: UpdateUserInput) {
  const name = input.name.trim()
  if (!name) {
    throw new Error('El nombre es obligatorio.')
  }

  await updateDoc(doc(db, 'users', uid), {
    name,
    role: input.role,
    active: input.active,
    menuPermissions: normalizeMenuPermissions(input.menuPermissions),
  })
}

export async function updateUserPresence(
  uid: string,
  input: {
    state: UserPresence['state']
    activePath?: string
  },
) {
  await updateDoc(doc(db, 'users', uid), {
    presence: {
      state: input.state,
      activePath: input.activePath ?? null,
      lastSeenAt: serverTimestamp(),
    },
    updatedAt: serverTimestamp(),
  })
}

export async function deleteUser(uid: string) {
  await deleteDoc(doc(db, 'users', uid))
}

export async function getUserById(uid: string): Promise<AppUser | null> {
  const snapshot = await getDoc(doc(db, 'users', uid))
  if (!snapshot.exists()) return null
  return mapUserDoc(snapshot.id, snapshot.data())
}
