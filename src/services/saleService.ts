import {
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  query,
  runTransaction,
  serverTimestamp,
  where,
  writeBatch,
} from 'firebase/firestore'
import { DEFAULT_BASE_CURRENCY_CODE } from '../constants/currency'
import { db } from '../lib/firebase'
import { getClientById } from './clientService'
import { getStockCategoryById } from './stockCategoryService'
import type { CreateSaleInput, Sale, SaleItem, SalePayment, SalePaymentInput, SaleResult } from '../types/sale'
import type { SaleMode, SoldBy } from '../types/product'

async function getNextSaleNumber() {
  const counterRef = doc(db, 'settings', 'sales')

  return runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(counterRef)
    const lastNumber = snapshot.exists() ? Number(snapshot.data().lastNumber ?? 0) : 0
    const nextNumber = lastNumber + 1

    transaction.set(
      counterRef,
      {
        lastNumber: nextNumber,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    )

    return String(nextNumber).padStart(5, '0')
  })
}

function mapTimestamp(value: unknown) {
  const typed = value as { toDate?: () => Date } | string | undefined
  if (typeof typed === 'object' && typed?.toDate) {
    return typed.toDate().toISOString()
  }
  if (typeof typed === 'string') return typed
  return ''
}

function mapSale(id: string, data: Record<string, unknown>): Sale {
  return {
    id,
    number: String(data.number ?? ''),
    status: String(data.status ?? 'completed'),
    cashierId: String(data.cashierId ?? ''),
    cashierName: String(data.cashierName ?? ''),
    cashSessionId: data.cashSessionId ? String(data.cashSessionId) : undefined,
    clientId: data.clientId ? String(data.clientId) : undefined,
    clientName: data.clientName ? String(data.clientName) : undefined,
    subtotal: Number(data.subtotal ?? 0),
    discount: Number(data.discount ?? 0),
    tax: Number(data.tax ?? 0),
    total: Number(data.total ?? 0),
    baseCurrency: String(data.baseCurrency ?? DEFAULT_BASE_CURRENCY_CODE),
    exchangeRateSnapshot:
      data.exchangeRateSnapshot && typeof data.exchangeRateSnapshot === 'object'
        ? (data.exchangeRateSnapshot as Record<string, number>)
        : {},
    profitTotal: data.profitTotal === null ? null : Number(data.profitTotal ?? 0),
    paymentStatus: String(data.paymentStatus ?? 'paid'),
    cashPaid: data.cashPaid !== undefined ? Number(data.cashPaid) : undefined,
    creditPaid: data.creditPaid !== undefined ? Number(data.creditPaid) : undefined,
    createdAt: mapTimestamp(data.createdAt),
  }
}

function mapSaleItem(id: string, data: Record<string, unknown>): SaleItem {
  return {
    id,
    productId: String(data.productId ?? ''),
    productName: String(data.productName ?? ''),
    isQuickItem: data.isQuickItem === true,
    barcode: data.barcode ? String(data.barcode) : undefined,
    soldBy: (data.soldBy as SoldBy) ?? 'unit',
    saleMode: (data.saleMode as SaleMode) ?? 'retail',
    quantity: Number(data.quantity ?? 0),
    unit: String(data.unit ?? 'und'),
    unitsPerBundle: data.unitsPerBundle ? Number(data.unitsPerBundle) : undefined,
    stockQuantity: Number(data.stockQuantity ?? 0),
    unitCost: Number(data.unitCost ?? 0),
    unitPrice: Number(data.unitPrice ?? 0),
    lineCost: Number(data.lineCost ?? 0),
    lineRevenue: Number(data.lineRevenue ?? 0),
    lineProfit: Number(data.lineProfit ?? 0),
  }
}

function mapSalePayment(id: string, data: Record<string, unknown>): SalePayment {
  return {
    id,
    methodId: String(data.methodId ?? ''),
    methodName: String(data.methodName ?? ''),
    currencyCode: String(data.currencyCode ?? ''),
    amount: Number(data.amount ?? 0),
    amountInBase: Number(data.amountInBase ?? 0),
    reference: data.reference ? String(data.reference) : undefined,
    isCredit: data.isCredit === true,
    isDebtCollection: data.isDebtCollection === true,
    debtPaymentId: data.debtPaymentId ? String(data.debtPaymentId) : undefined,
    clientId: data.clientId ? String(data.clientId) : undefined,
    clientName: data.clientName ? String(data.clientName) : undefined,
    createdAt: mapTimestamp(data.createdAt) || undefined,
    createdBy: data.createdBy ? String(data.createdBy) : undefined,
    createdByName: data.createdByName ? String(data.createdByName) : undefined,
  }
}

function groupCreditByClient(payments: SalePaymentInput[]) {
  const groups = new Map<string, number>()

  payments
    .filter((payment) => payment.isCredit)
    .forEach((payment) => {
      if (!payment.clientId) {
        throw new Error('El pago a crédito debe tener un cliente asignado.')
      }
      const current = groups.get(payment.clientId) ?? 0
      groups.set(payment.clientId, current + payment.amountInBase)
    })

  return groups
}

async function validateCreditLimits(creditByClient: Map<string, number>) {
  for (const [clientId, amount] of creditByClient) {
    const client = await getClientById(clientId)
    if (!client) {
      throw new Error('Cliente no encontrado para el crédito.')
    }
    if (client.creditLimit > 0 && client.balance + amount > client.creditLimit + 0.01) {
      throw new Error(
        `El crédito de ${client.name} excede su límite disponible (${(client.creditLimit - client.balance).toFixed(2)}).`,
      )
    }
  }
}

export async function listSales(limit = 200): Promise<Sale[]> {
  const snapshot = await getDocs(collection(db, 'sales'))

  return snapshot.docs
    .map((item) => mapSale(item.id, item.data()))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit)
}

export async function getSaleById(id: string): Promise<Sale | null> {
  const snapshot = await getDoc(doc(db, 'sales', id))
  if (!snapshot.exists()) return null
  return mapSale(snapshot.id, snapshot.data())
}

export async function getSaleItems(saleId: string): Promise<SaleItem[]> {
  const snapshot = await getDocs(collection(db, 'sales', saleId, 'items'))
  return snapshot.docs.map((item) => mapSaleItem(item.id, item.data()))
}

export async function getSalePayments(saleId: string): Promise<SalePayment[]> {
  const snapshot = await getDocs(collection(db, 'sales', saleId, 'payments'))
  return snapshot.docs
    .map((item) => mapSalePayment(item.id, item.data()))
    .sort((a, b) => (a.createdAt ?? '').localeCompare(b.createdAt ?? ''))
}

export async function createSale(input: CreateSaleInput): Promise<SaleResult> {
  const subtotal = input.items.reduce((sum, item) => sum + item.lineRevenue, 0)
  const profitTotal = input.items.reduce((sum, item) => sum + item.lineProfit, 0)
  const paidInBase = input.payments.reduce((sum, payment) => sum + payment.amountInBase, 0)
  const cashPaid = input.payments
    .filter((payment) => !payment.isCredit)
    .reduce((sum, payment) => sum + payment.amountInBase, 0)
  const creditPaid = input.payments
    .filter((payment) => payment.isCredit)
    .reduce((sum, payment) => sum + payment.amountInBase, 0)

  if (paidInBase + 0.001 < subtotal) {
    throw new Error('El monto pagado y acreditado es menor al total de la venta.')
  }

  const saleRef = input.clientRequestId
    ? doc(db, 'sales', input.clientRequestId)
    : doc(collection(db, 'sales'))
  const existingSale = input.clientRequestId ? await getDoc(saleRef) : null
  if (existingSale?.exists()) {
    const sale = mapSale(existingSale.id, existingSale.data())
    return {
      saleId: sale.id,
      saleNumber: sale.number,
      total: sale.total,
      profitTotal: sale.profitTotal ?? 0,
    }
  }

  const creditByClient = groupCreditByClient(input.payments)
  if (creditByClient.size > 0) {
    await validateCreditLimits(creditByClient)
  }

  const primaryCreditClient = input.payments.find((payment) => payment.isCredit && payment.clientId)
  let paymentStatus = 'paid'
  if (creditPaid > 0.001) {
    paymentStatus = cashPaid > 0.001 ? 'partial' : 'pending'
  }

  const categoryUsage = new Map<string, number>()
  input.items.forEach((item) => {
    if (!item.stockCategoryId) return
    const current = categoryUsage.get(item.stockCategoryId) ?? 0
    categoryUsage.set(item.stockCategoryId, current + item.stockQuantity)
  })

  for (const [categoryId, needed] of categoryUsage) {
    const category = await getStockCategoryById(categoryId)
    if (!category) {
      throw new Error('La categoría de inventario ya no existe.')
    }
    if (category.stock + 0.001 < needed) {
      throw new Error(
        `Stock insuficiente en ${category.name}. Disponible: ${category.stock} ${category.unitLabel}.`,
      )
    }
  }

  const batch = writeBatch(db)
  const saleNumber = await getNextSaleNumber()

  batch.set(saleRef, {
    number: saleNumber,
    status: 'completed',
    cashierId: input.cashierId,
    cashierName: input.cashierName,
    cashSessionId: input.cashSessionId ?? null,
    clientId: input.clientId ?? primaryCreditClient?.clientId ?? null,
    clientName: input.clientName ?? primaryCreditClient?.clientName ?? null,
    subtotal,
    discount: 0,
    tax: 0,
    total: subtotal,
    baseCurrency: input.baseCurrency,
    exchangeRateSnapshot: input.exchangeRateSnapshot,
    profitTotal,
    paymentStatus,
    cashPaid,
    creditPaid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })

  input.items.forEach((item) => {
    const itemRef = doc(collection(db, 'sales', saleRef.id, 'items'))
    batch.set(itemRef, {
      productId: item.productId,
      productName: item.productName,
      isQuickItem: item.isQuickItem === true,
      barcode: item.barcode ?? null,
      soldBy: item.soldBy,
      saleMode: item.saleMode,
      quantity: item.quantity,
      unit: item.unitLabel,
      unitsPerBundle: item.unitsPerBundle ?? null,
      stockQuantity: item.stockQuantity,
      unitCost: item.unitCost,
      unitPrice: item.unitPrice,
      lineCost: item.lineCost,
      lineRevenue: item.lineRevenue,
      lineProfit: item.lineProfit,
      createdAt: serverTimestamp(),
    })

    if (item.isQuickItem) return

    const movementRef = doc(collection(db, 'inventory_movements'))
    batch.set(movementRef, {
      productId: item.stockCategoryId ? null : item.productId,
      stockCategoryId: item.stockCategoryId ?? null,
      productName: item.stockCategoryName ?? item.productName,
      type: 'sale',
      quantity: -item.stockQuantity,
      unitCost: item.unitCost,
      referenceType: 'sale',
      referenceId: saleRef.id,
      notes: item.stockCategoryId
        ? `Venta ${saleNumber} · ${item.productName}`
        : `Venta ${saleNumber}`,
      createdAt: serverTimestamp(),
      createdBy: input.cashierId,
    })

    if (item.stockCategoryId) {
      batch.update(doc(db, 'stock_categories', item.stockCategoryId), {
        stock: increment(-item.stockQuantity),
        updatedAt: serverTimestamp(),
      })
    } else {
      batch.update(doc(db, 'products', item.productId), {
        stock: increment(-item.stockQuantity),
        updatedAt: serverTimestamp(),
      })
    }
  })

  input.payments.forEach((payment) => {
    const paymentRef = doc(collection(db, 'sales', saleRef.id, 'payments'))
    batch.set(paymentRef, {
      methodId: payment.methodId,
      methodName: payment.methodName,
      currencyCode: payment.currencyCode,
      amount: payment.amount,
      amountInBase: payment.amountInBase,
      reference: payment.reference ?? null,
      isCredit: payment.isCredit === true,
      clientId: payment.clientId ?? null,
      clientName: payment.clientName ?? null,
      createdAt: serverTimestamp(),
      createdBy: input.cashierId,
      createdByName: input.cashierName,
    })
  })

  for (const [clientId, amount] of creditByClient) {
    const client = await getClientById(clientId)
    if (!client) continue

    const debtRef = doc(collection(db, 'debts'))
    batch.set(debtRef, {
      clientId: client.id,
      clientName: client.name,
      saleId: saleRef.id,
      originalAmount: amount,
      balance: amount,
      status: 'active',
      dueDate: null,
      notes: `Venta ${saleNumber}`,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })

    batch.update(doc(db, 'clients', client.id), {
      balance: increment(amount),
      updatedAt: serverTimestamp(),
    })
  }

  await batch.commit()

  return {
    saleId: saleRef.id,
    saleNumber,
    total: subtotal,
    profitTotal,
  }
}

/** Solo para pruebas: elimina la venta y revierte stock/deudas vinculadas. */
export async function deleteSale(saleId: string) {
  const sale = await getSaleById(saleId)
  if (!sale) {
    throw new Error('Venta no encontrada.')
  }

  const [itemsSnap, paymentsSnap, movementsSnap, debtsSnap] = await Promise.all([
    getDocs(collection(db, 'sales', saleId, 'items')),
    getDocs(collection(db, 'sales', saleId, 'payments')),
    getDocs(
      query(
        collection(db, 'inventory_movements'),
        where('referenceType', '==', 'sale'),
        where('referenceId', '==', saleId),
      ),
    ),
    getDocs(query(collection(db, 'debts'), where('saleId', '==', saleId))),
  ])

  const batch = writeBatch(db)

  for (const movementDoc of movementsSnap.docs) {
    const data = movementDoc.data()
    const quantity = Math.abs(Number(data.quantity ?? 0))

    if (data.stockCategoryId) {
      const categoryRef = doc(db, 'stock_categories', String(data.stockCategoryId))
      const categorySnap = await getDoc(categoryRef)
      if (categorySnap.exists()) {
        batch.update(categoryRef, {
          stock: increment(quantity),
          updatedAt: serverTimestamp(),
        })
      }
    } else if (data.productId) {
      const productRef = doc(db, 'products', String(data.productId))
      const productSnap = await getDoc(productRef)
      if (productSnap.exists()) {
        batch.update(productRef, {
          stock: increment(quantity),
          updatedAt: serverTimestamp(),
        })
      }
    }

    batch.delete(movementDoc.ref)
  }

  for (const debtDoc of debtsSnap.docs) {
    const data = debtDoc.data()
    const balance = Number(data.balance ?? 0)
    const clientId = data.clientId ? String(data.clientId) : ''

    if (clientId && balance > 0) {
      const clientRef = doc(db, 'clients', clientId)
      const clientSnap = await getDoc(clientRef)
      if (clientSnap.exists()) {
        batch.update(clientRef, {
          balance: increment(-balance),
          updatedAt: serverTimestamp(),
        })
      }
    }

    batch.delete(debtDoc.ref)
  }

  itemsSnap.docs.forEach((itemDoc) => batch.delete(itemDoc.ref))
  paymentsSnap.docs.forEach((paymentDoc) => batch.delete(paymentDoc.ref))
  batch.delete(doc(db, 'sales', saleId))

  await batch.commit()
}
