import {
  createUserWithEmailAndPassword,
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
import { auth, db } from '../lib/firebase'
import type { AppUser, UserRole } from '../types/user'

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
