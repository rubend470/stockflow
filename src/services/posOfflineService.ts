import type { Client } from '../types/client'
import type { Currency, ExchangeRate, PaymentMethod } from '../types/finance'
import type { Product } from '../types/product'
import type { SalesOffer } from '../types/offer'
import type { CreateSaleInput, SaleResult } from '../types/sale'
import type { StockCategory } from '../types/stockCategory'
import { getActiveBusinessId } from '../lib/tenantScope'

const POS_CACHE_VERSION = 1
const POS_QUEUE_VERSION = 1

export interface PosOfflineCache {
  version: typeof POS_CACHE_VERSION
  savedAt: string
  products: Product[]
  categories: StockCategory[]
  currencies: Currency[]
  paymentMethods: PaymentMethod[]
  exchangeRates: ExchangeRate[]
  clients: Client[]
  offers?: SalesOffer[]
}

export interface OfflineQueuedSale {
  id: string
  businessId?: string
  createdAt: string
  updatedAt: string
  status: 'pending' | 'syncing' | 'failed'
  attempts: number
  lastError?: string
  input: CreateSaleInput
}

interface OfflineQueuePayload {
  version: typeof POS_QUEUE_VERSION
  sales: OfflineQueuedSale[]
}

function storageOwnerKey(userId: string) {
  return `${userId}:${getActiveBusinessId() ?? 'legacy'}`
}

function posCacheKey(userId: string) {
  return `stockflow:pos-cache:v${POS_CACHE_VERSION}:${storageOwnerKey(userId)}`
}

function posQueueKey(userId: string) {
  return `stockflow:offline-sales:v${POS_QUEUE_VERSION}:${storageOwnerKey(userId)}`
}

function hasStorage() {
  return typeof window !== 'undefined' && Boolean(window.localStorage)
}

function createOfflineSaleId() {
  return `offline-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function isNetworkError(error: unknown) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase()
  return (
    message.includes('offline') ||
    message.includes('network') ||
    message.includes('unavailable') ||
    message.includes('failed to fetch')
  )
}

export function savePosOfflineCache(userId: string, cache: Omit<PosOfflineCache, 'version' | 'savedAt'>) {
  if (!hasStorage()) return

  try {
    const payload: PosOfflineCache = {
      version: POS_CACHE_VERSION,
      savedAt: new Date().toISOString(),
      ...cache,
    }
    window.localStorage.setItem(posCacheKey(userId), JSON.stringify(payload))
  } catch {
    // El POS puede continuar aunque el navegador bloquee almacenamiento local.
  }
}

export function loadPosOfflineCache(userId: string): PosOfflineCache | null {
  if (!hasStorage()) return null

  try {
    const raw = window.localStorage.getItem(posCacheKey(userId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<PosOfflineCache>

    if (
      parsed.version !== POS_CACHE_VERSION ||
      !Array.isArray(parsed.products) ||
      !Array.isArray(parsed.categories) ||
      !Array.isArray(parsed.currencies) ||
      !Array.isArray(parsed.paymentMethods) ||
      !Array.isArray(parsed.exchangeRates) ||
      !Array.isArray(parsed.clients)
    ) {
      return null
    }

    return parsed as PosOfflineCache
  } catch {
    return null
  }
}

export function listOfflineQueuedSales(userId: string): OfflineQueuedSale[] {
  if (!hasStorage()) return []

  try {
    const raw = window.localStorage.getItem(posQueueKey(userId))
    if (!raw) return []
    const parsed = JSON.parse(raw) as Partial<OfflineQueuePayload>
    if (parsed.version !== POS_QUEUE_VERSION || !Array.isArray(parsed.sales)) return []
    return parsed.sales.filter((sale): sale is OfflineQueuedSale => {
      return Boolean(sale?.id && sale.input && sale.status)
    })
  } catch {
    return []
  }
}

function saveOfflineQueuedSales(userId: string, sales: OfflineQueuedSale[]) {
  if (!hasStorage()) return

  const payload: OfflineQueuePayload = {
    version: POS_QUEUE_VERSION,
    sales,
  }
  window.localStorage.setItem(posQueueKey(userId), JSON.stringify(payload))
}

export function enqueueOfflineSale(userId: string, input: CreateSaleInput) {
  const now = new Date().toISOString()
  const id = createOfflineSaleId()
  const queuedSale: OfflineQueuedSale = {
    id,
    businessId: getActiveBusinessId(),
    createdAt: now,
    updatedAt: now,
    status: 'pending',
    attempts: 0,
    input: {
      ...input,
      clientRequestId: id,
    },
  }

  const current = listOfflineQueuedSales(userId)
  saveOfflineQueuedSales(userId, [...current, queuedSale])
  return queuedSale
}

export async function syncOfflineQueuedSales(
  userId: string,
  createOnlineSale: (input: CreateSaleInput) => Promise<SaleResult>,
) {
  const queuedSales = listOfflineQueuedSales(userId)
  if (queuedSales.length === 0) return []

  const synced: SaleResult[] = []
  let workingQueue = [...queuedSales]

  for (const queuedSale of queuedSales) {
    const now = new Date().toISOString()
    workingQueue = workingQueue.map((item) =>
      item.id === queuedSale.id
        ? { ...item, status: 'syncing', attempts: item.attempts + 1, updatedAt: now }
        : item,
    )
    saveOfflineQueuedSales(userId, workingQueue)

    try {
      const result = await createOnlineSale(queuedSale.input)
      synced.push(result)
      workingQueue = workingQueue.filter((item) => item.id !== queuedSale.id)
      saveOfflineQueuedSales(userId, workingQueue)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo sincronizar la venta.'
      workingQueue = workingQueue.map((item) =>
        item.id === queuedSale.id
          ? {
              ...item,
              status: 'failed',
              updatedAt: new Date().toISOString(),
              lastError: message,
            }
          : item,
      )
      saveOfflineQueuedSales(userId, workingQueue)

      if (isNetworkError(error)) break
    }
  }

  return synced
}
