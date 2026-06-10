import { deleteApp, initializeApp } from 'firebase/app'
import {
  createUserWithEmailAndPassword,
  getAuth,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth'
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore'
import { auth, db, firebaseConfig } from '../lib/firebase'
import type { AppUser, UserRole } from '../types/user'

export interface CreateUserByAdminInput {
  name: string
  email: string
  password: string
  role: UserRole
  active: boolean
}

export async function login(email: string, password: string) {
  const credential = await signInWithEmailAndPassword(auth, email, password)
  const profile = await getUserProfile(credential.user.uid)

  if (profile && !profile.active) {
    await signOut(auth)
    throw { code: 'auth/user-disabled' }
  }

  return { user: credential.user, profile }
}

export async function register(name: string, email: string, password: string) {
  const credential = await createUserWithEmailAndPassword(auth, email, password)
  await updateProfile(credential.user, { displayName: name })

  const role = await resolveInitialRole()
  const profile: AppUser = {
    uid: credential.user.uid,
    name,
    email,
    role,
    active: true,
    createdAt: new Date().toISOString(),
  }

  await setDoc(doc(db, 'users', credential.user.uid), {
    name,
    email,
    role,
    active: true,
    createdAt: serverTimestamp(),
  })

  return { user: credential.user, profile }
}

export async function logout() {
  await signOut(auth)
}

export async function createUserByAdmin(input: CreateUserByAdminInput): Promise<AppUser> {
  const name = input.name.trim()
  const email = input.email.trim().toLowerCase()

  if (!name || !email) {
    throw new Error('Nombre y correo son obligatorios.')
  }

  if (input.password.length < 6) {
    throw new Error('La contraseña debe tener al menos 6 caracteres.')
  }

  const secondaryApp = initializeApp(firebaseConfig, `admin-create-${Date.now()}`)
  const secondaryAuth = getAuth(secondaryApp)

  try {
    const credential = await createUserWithEmailAndPassword(secondaryAuth, email, input.password)
    await updateProfile(credential.user, { displayName: name })

    await setDoc(doc(db, 'users', credential.user.uid), {
      name,
      email,
      role: input.role,
      active: input.active,
      createdAt: serverTimestamp(),
    })

    return {
      uid: credential.user.uid,
      name,
      email,
      role: input.role,
      active: input.active,
      createdAt: new Date().toISOString(),
    }
  } finally {
    await signOut(secondaryAuth).catch(() => undefined)
    await deleteApp(secondaryApp)
  }
}

export async function sendPasswordReset(email: string) {
  await sendPasswordResetEmail(auth, email.trim().toLowerCase())
}

export async function getUserProfile(uid: string): Promise<AppUser | null> {
  const snapshot = await getDoc(doc(db, 'users', uid))
  if (!snapshot.exists()) return null

  const data = snapshot.data()
  return {
    uid,
    name: data.name,
    email: data.email,
    role: data.role as UserRole,
    active: data.active !== false,
    createdAt: data.createdAt?.toDate?.()?.toISOString() ?? data.createdAt,
  }
}

async function resolveInitialRole(): Promise<UserRole> {
  const usersQuery = query(collection(db, 'users'), limit(1))
  const snapshot = await getDocs(usersQuery)
  return snapshot.empty ? 'super_admin' : 'cashier'
}

export function mapFirebaseUser(user: User, profile: AppUser | null) {
  return profile ?? {
    uid: user.uid,
    name: user.displayName ?? user.email ?? 'Usuario',
    email: user.email ?? '',
    role: 'cashier' as UserRole,
    active: true,
    createdAt: new Date().toISOString(),
  }
}
