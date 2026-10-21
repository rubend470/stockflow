import {
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore'
import { tenantCollectionRef, tenantDocumentRef } from '../lib/tenantFirestore'
import type { Client, ClientFormInput } from '../types/client'
import { isValidPhone, normalizePhone } from '../utils/phone'

function mapClient(id: string, data: Record<string, unknown>): Client {
  const createdAt = data.createdAt as { toDate?: () => Date } | string | undefined
  const updatedAt = data.updatedAt as { toDate?: () => Date } | string | undefined

  return {
    id,
    name: String(data.name ?? ''),
    phone: data.phone ? String(data.phone) : undefined,
    email: data.email ? String(data.email) : undefined,
    documentId: data.documentId ? String(data.documentId) : undefined,
    creditLimit: Number(data.creditLimit ?? 0),
    balance: Number(data.balance ?? 0),
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

export async function listClients(): Promise<Client[]> {
  const snapshot = await getDocs(tenantCollectionRef('clients'))
  return snapshot.docs
    .map((item) => mapClient(item.id, item.data()))
    .filter((client) => client.active)
    .sort((a, b) => a.name.localeCompare(b.name, 'es'))
}

export async function listAllClients(): Promise<Client[]> {
  const snapshot = await getDocs(tenantCollectionRef('clients'))
  return snapshot.docs
    .map((item) => mapClient(item.id, item.data()))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'))
}

export async function getClientById(id: string): Promise<Client | null> {
  const snapshot = await getDoc(tenantDocumentRef('clients', id))
  if (!snapshot.exists()) return null
  return mapClient(snapshot.id, snapshot.data())
}

export async function findClientByName(name: string, clients?: Client[]): Promise<Client | null> {
  const trimmed = name.trim().toLowerCase()
  if (!trimmed) return null

  const source = clients ?? (await listClients())
  return source.find((client) => client.name.toLowerCase() === trimmed) ?? null
}

export function getFrequentCreditClients(clients: Client[], limit = 10): Client[] {
  return [...clients]
    .filter((client) => client.balance > 0 || Boolean(client.phone?.trim()))
    .sort(
      (a, b) =>
        b.balance - a.balance ||
        (b.updatedAt ?? b.createdAt).localeCompare(a.updatedAt ?? a.createdAt),
    )
    .slice(0, limit)
}

export async function findOrCreateClientForCredit(
  name: string,
  phone: string,
  clients?: Client[],
): Promise<Client> {
  const trimmedName = name.trim()
  const trimmedPhone = phone.trim()

  if (!trimmedName) {
    throw new Error('El nombre es obligatorio para vender a crédito.')
  }

  if (!isValidPhone(trimmedPhone)) {
    throw new Error('Ingresa un teléfono válido para el crédito.')
  }

  const normalizedPhone = normalizePhone(trimmedPhone)
  const source = clients ?? (await listClients())

  const byPhone = source.find(
    (client) => client.phone && normalizePhone(client.phone) === normalizedPhone,
  )
  if (byPhone) {
    if (!byPhone.phone || normalizePhone(byPhone.phone) !== normalizedPhone) {
      await updateDoc(tenantDocumentRef('clients', byPhone.id), {
        phone: trimmedPhone,
        updatedAt: serverTimestamp(),
      })
    }
    return { ...byPhone, phone: trimmedPhone }
  }

  const byName = source.find(
    (client) => client.name.toLowerCase() === trimmedName.toLowerCase(),
  )
  if (byName) {
    await updateDoc(tenantDocumentRef('clients', byName.id), {
      phone: trimmedPhone,
      updatedAt: serverTimestamp(),
    })
    return { ...byName, phone: trimmedPhone }
  }

  const id = await createClient({
    name: trimmedName,
    phone: trimmedPhone,
    email: '',
    documentId: '',
    creditLimit: 0,
    active: true,
  })

  const created = await getClientById(id)
  if (!created) {
    throw new Error('No se pudo registrar el cliente del crédito.')
  }

  return created
}

export async function findOrCreateClientByName(name: string, clients?: Client[]): Promise<Client> {
  const trimmed = name.trim()
  if (!trimmed) {
    throw new Error('El nombre del cliente es obligatorio.')
  }

  const existing = await findClientByName(trimmed, clients)
  if (existing) return existing

  const id = await createClient({
    name: trimmed,
    phone: '',
    email: '',
    documentId: '',
    creditLimit: 0,
    active: true,
  })

  const created = await getClientById(id)
  if (!created) {
    throw new Error('No se pudo registrar el cliente.')
  }

  return created
}

export async function createClient(input: ClientFormInput) {
  if (!input.name.trim()) {
    throw new Error('El nombre del cliente es obligatorio.')
  }

  if (input.creditLimit < 0) {
    throw new Error('El límite de crédito no puede ser negativo.')
  }

  const ref = doc(tenantCollectionRef('clients'))
  await setDoc(ref, {
    name: input.name.trim(),
    phone: input.phone.trim() || null,
    email: input.email.trim() || null,
    documentId: input.documentId.trim() || null,
    creditLimit: input.creditLimit,
    balance: 0,
    active: input.active,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })

  return ref.id
}

export async function updateClient(id: string, input: ClientFormInput) {
  if (!input.name.trim()) {
    throw new Error('El nombre del cliente es obligatorio.')
  }

  if (input.creditLimit < 0) {
    throw new Error('El límite de crédito no puede ser negativo.')
  }

  await updateDoc(tenantDocumentRef('clients', id), {
    name: input.name.trim(),
    phone: input.phone.trim() || null,
    email: input.email.trim() || null,
    documentId: input.documentId.trim() || null,
    creditLimit: input.creditLimit,
    active: input.active,
    updatedAt: serverTimestamp(),
  })
}

export async function deleteClient(id: string) {
  const client = await getClientById(id)
  if (!client) {
    throw new Error('Cliente no encontrado.')
  }

  if (client.balance > 0) {
    throw new Error('No puedes eliminar un cliente con saldo pendiente.')
  }

  await deleteDoc(tenantDocumentRef('clients', id))
}

export async function updateClientBalance(id: string, delta: number) {
  await updateDoc(tenantDocumentRef('clients', id), {
    balance: increment(delta),
    updatedAt: serverTimestamp(),
  })
}
