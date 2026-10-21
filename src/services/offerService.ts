import {
  addDoc,
  deleteDoc,
  getDocs,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore'
import { tenantCollectionRef, tenantDocumentRef } from '../lib/tenantFirestore'
import type { Product } from '../types/product'
import type { SalesOffer, SalesOfferFormInput, SalesOfferType } from '../types/offer'
import { parseMoneyInput, roundMoney } from '../utils/formatMoney'

function mapTimestamp(value: unknown) {
  const typed = value as { toDate?: () => Date } | string | undefined
  if (typeof typed === 'object' && typed?.toDate) {
    return typed.toDate().toISOString()
  }
  if (typeof typed === 'string') return typed
  return undefined
}

function normalizeOfferType(value: unknown): SalesOfferType {
  return value === 'promotion' ? 'promotion' : 'combo'
}

function mapOffer(id: string, data: Record<string, unknown>): SalesOffer {
  return {
    id,
    type: normalizeOfferType(data.type),
    name: String(data.name ?? ''),
    productId: String(data.productId ?? ''),
    productName: String(data.productName ?? ''),
    soldBy: data.soldBy === 'weight' ? 'weight' : 'unit',
    unitLabel: String(data.unitLabel ?? 'und'),
    quantity: Number(data.quantity ?? 0),
    price: Number(data.price ?? 0),
    active: data.active !== false,
    createdAt: mapTimestamp(data.createdAt),
    updatedAt: mapTimestamp(data.updatedAt),
  }
}

function validateOfferInput(input: SalesOfferFormInput, products: Product[]) {
  const product = products.find((entry) => entry.id === input.productId)
  if (!product) {
    throw new Error('Selecciona el producto de la oferta.')
  }

  const name = input.name.trim() || `${input.type === 'combo' ? 'Combo' : 'Promo'} ${product.name}`
  const quantity = Number(input.quantity)
  const price = parseMoneyInput(input.price)

  if (quantity <= 0) {
    throw new Error('Ingresa una cantidad mayor a cero.')
  }

  if (price <= 0) {
    throw new Error('Ingresa un precio mayor a cero.')
  }

  if (input.type !== 'combo' && input.type !== 'promotion') {
    throw new Error('Selecciona un tipo de oferta válido.')
  }

  return {
    type: input.type,
    name,
    productId: product.id,
    productName: product.name,
    soldBy: product.soldBy,
    unitLabel: product.unitLabel,
    quantity: roundMoney(quantity),
    price: roundMoney(price),
    active: input.active,
  }
}

export async function listSalesOffers(): Promise<SalesOffer[]> {
  const snapshot = await getDocs(tenantCollectionRef('offers'))
  return snapshot.docs
    .map((item) => mapOffer(item.id, item.data()))
    .sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name, 'es'))
}

export async function listActiveSalesOffers(): Promise<SalesOffer[]> {
  const offers = await listSalesOffers()
  return offers.filter((offer) => offer.active)
}

export async function createSalesOffer(input: SalesOfferFormInput, products: Product[], userId: string) {
  const payload = validateOfferInput(input, products)
  const ref = await addDoc(tenantCollectionRef('offers'), {
    ...payload,
    createdBy: userId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return ref.id
}

export async function updateSalesOffer(id: string, input: SalesOfferFormInput, products: Product[]) {
  const payload = validateOfferInput(input, products)
  await updateDoc(tenantDocumentRef('offers', id), {
    ...payload,
    updatedAt: serverTimestamp(),
  })
}

export async function setSalesOfferActive(id: string, active: boolean) {
  await updateDoc(tenantDocumentRef('offers', id), {
    active,
    updatedAt: serverTimestamp(),
  })
}

export async function deleteSalesOffer(id: string) {
  await deleteDoc(tenantDocumentRef('offers', id))
}
