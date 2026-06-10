import {
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import { getProductById } from './productService'
import type {
  CreatePurchaseInvoiceInput,
  PurchaseInvoice,
  PurchaseInvoiceLine,
  PurchaseInvoiceLineInput,
} from '../types/purchaseInvoice'

function mapTimestamp(value: unknown) {
  const typed = value as { toDate?: () => Date } | string | undefined
  if (typeof typed === 'object' && typed?.toDate) {
    return typed.toDate().toISOString()
  }
  if (typeof typed === 'string') return typed
  return undefined
}

function mapLine(data: Record<string, unknown>): PurchaseInvoiceLine {
  return {
    productId: data.productId ? String(data.productId) : undefined,
    description: String(data.description ?? ''),
    quantity: Number(data.quantity ?? 0),
    unitLabel: String(data.unitLabel ?? 'und'),
    unitCost: Number(data.unitCost ?? 0),
    lineTotal: Number(data.lineTotal ?? 0),
  }
}

function mapPurchaseInvoice(id: string, data: Record<string, unknown>): PurchaseInvoice {
  const lines = Array.isArray(data.lines) ? data.lines.map((line) => mapLine(line as Record<string, unknown>)) : []

  return {
    id,
    number: String(data.number ?? ''),
    supplierName: String(data.supplierName ?? ''),
    status: (data.status as PurchaseInvoice['status']) ?? 'pending',
    totalAmount: Number(data.totalAmount ?? 0),
    amountPaid: Number(data.amountPaid ?? 0),
    amountDue: Number(data.amountDue ?? 0),
    notes: data.notes ? String(data.notes) : undefined,
    expectedDate: data.expectedDate ? String(data.expectedDate) : undefined,
    lines,
    createdAt: mapTimestamp(data.createdAt) ?? new Date().toISOString(),
    updatedAt: mapTimestamp(data.updatedAt),
  }
}

function normalizeLines(lines: PurchaseInvoiceLineInput[]): PurchaseInvoiceLine[] {
  if (lines.length === 0) {
    throw new Error('Agrega al menos una línea a la factura.')
  }

  return lines.map((line) => {
    if (!line.description.trim()) {
      throw new Error('Cada línea debe tener una descripción.')
    }
    if (line.quantity <= 0) {
      throw new Error('La cantidad debe ser mayor a cero.')
    }
    if (line.unitCost < 0) {
      throw new Error('El costo no puede ser negativo.')
    }

    return {
      productId: line.productId?.trim() || undefined,
      description: line.description.trim(),
      quantity: line.quantity,
      unitLabel: line.unitLabel || 'und',
      unitCost: line.unitCost,
      lineTotal: Number((line.quantity * line.unitCost).toFixed(2)),
    }
  })
}

async function getNextInvoiceNumber() {
  const counterRef = doc(db, 'settings', 'purchase_invoices')

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

export async function listPurchaseInvoices(): Promise<PurchaseInvoice[]> {
  const snapshot = await getDocs(collection(db, 'purchase_invoices'))
  return snapshot.docs
    .map((item) => mapPurchaseInvoice(item.id, item.data()))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function listOpenPurchaseInvoices(invoices: PurchaseInvoice[]) {
  return invoices.filter(
    (invoice) =>
      invoice.status !== 'paid' &&
      invoice.status !== 'cancelled' &&
      (invoice.status === 'pending' || invoice.amountDue > 0.01),
  )
}

export async function getPurchaseInvoiceById(id: string): Promise<PurchaseInvoice | null> {
  const snapshot = await getDoc(doc(db, 'purchase_invoices', id))
  if (!snapshot.exists()) return null
  return mapPurchaseInvoice(snapshot.id, snapshot.data())
}

export async function createPurchaseInvoice(input: CreatePurchaseInvoiceInput, userId: string) {
  if (!input.supplierName.trim()) {
    throw new Error('El proveedor es obligatorio.')
  }

  const lines = normalizeLines(input.lines)
  const totalAmount = lines.reduce((sum, line) => sum + line.lineTotal, 0)
  const amountPaid = Math.max(input.amountPaid ?? 0, 0)

  if (amountPaid > totalAmount + 0.01) {
    throw new Error('El monto pagado no puede superar el total de la factura.')
  }

  const amountDue = Number((totalAmount - amountPaid).toFixed(2))
  const number = await getNextInvoiceNumber()
  const ref = doc(collection(db, 'purchase_invoices'))

  await setDoc(ref, {
    number,
    supplierName: input.supplierName.trim(),
    status: 'pending',
    totalAmount,
    amountPaid,
    amountDue,
    notes: input.notes?.trim() || null,
    expectedDate: input.expectedDate || null,
    lines,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdBy: userId,
  })

  return ref.id
}

export async function registerPurchaseInvoicePayment(id: string, amount: number) {
  if (amount <= 0) {
    throw new Error('El monto debe ser mayor a cero.')
  }

  const invoice = await getPurchaseInvoiceById(id)
  if (!invoice) {
    throw new Error('Factura no encontrada.')
  }

  if (invoice.status === 'cancelled') {
    throw new Error('No puedes pagar una factura anulada.')
  }

  const nextPaid = Number((invoice.amountPaid + amount).toFixed(2))
  if (nextPaid > invoice.totalAmount + 0.01) {
    throw new Error('El pago supera el total de la factura.')
  }

  const amountDue = Number((invoice.totalAmount - nextPaid).toFixed(2))
  let status = invoice.status
  if (amountDue <= 0.01) {
    status = 'paid'
  } else if (invoice.status === 'received' || invoice.status === 'partial') {
    status = 'partial'
  }

  await updateDoc(doc(db, 'purchase_invoices', id), {
    amountPaid: nextPaid,
    amountDue: Math.max(amountDue, 0),
    status,
    updatedAt: serverTimestamp(),
  })
}

export async function receivePurchaseInvoice(id: string, userId: string, userName: string) {
  const invoice = await getPurchaseInvoiceById(id)
  if (!invoice) {
    throw new Error('Factura no encontrada.')
  }

  if (invoice.status !== 'pending') {
    throw new Error('Solo puedes registrar entrada en facturas pendientes.')
  }

  const batch = writeBatch(db)

  for (const line of invoice.lines) {
    if (!line.productId) continue

    const product = await getProductById(line.productId)
    if (!product) continue

    const movementRef = doc(collection(db, 'inventory_movements'))
    batch.set(movementRef, {
      productId: product.id,
      productName: product.name,
      type: 'purchase',
      quantity: line.quantity,
      unitCost: line.unitCost,
      referenceType: 'purchase_invoice',
      referenceId: id,
      notes: `Entrada factura ${invoice.number} · ${invoice.supplierName}`,
      createdAt: serverTimestamp(),
      createdBy: userId,
      createdByName: userName,
    })

    batch.update(doc(db, 'products', product.id), {
      stock: increment(line.quantity),
      costPrice: line.unitCost,
      updatedAt: serverTimestamp(),
    })
  }

  const status = invoice.amountDue <= 0.01 ? 'paid' : invoice.amountPaid > 0.01 ? 'partial' : 'received'

  batch.update(doc(db, 'purchase_invoices', id), {
    status,
    updatedAt: serverTimestamp(),
    receivedAt: serverTimestamp(),
    receivedBy: userId,
  })

  await batch.commit()
}

export async function cancelPurchaseInvoice(id: string) {
  const invoice = await getPurchaseInvoiceById(id)
  if (!invoice) {
    throw new Error('Factura no encontrada.')
  }

  if (invoice.status !== 'pending') {
    throw new Error('Solo puedes anular facturas que aún no han entrado al inventario.')
  }

  await updateDoc(doc(db, 'purchase_invoices', id), {
    status: 'cancelled',
    updatedAt: serverTimestamp(),
  })
}
